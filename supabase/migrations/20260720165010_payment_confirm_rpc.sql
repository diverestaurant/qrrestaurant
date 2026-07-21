create policy session_payment_select on public.dining_sessions
for select to authenticated
using (
  app_private.has_branch_permission(branch_id, 'payment.begin')
  or app_private.has_branch_permission(branch_id, 'payment.confirm')
);

create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_cash_received_minor bigint,
  p_observed_reference text,
  p_actor_id uuid
)
returns table(payment_id uuid, state public.payment_state, change_minor bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_branch_id uuid;
  v_session_id uuid;
  v_amount_minor bigint;
  v_method public.payment_method;
  v_payment_state public.payment_state;
  v_outstanding_minor bigint;
  v_change_minor bigint;
begin
  select p.branch_id, p.session_id, p.amount_minor, p.method, p.state,
         s.total_due_minor - s.total_paid_minor
    into v_branch_id, v_session_id, v_amount_minor, v_method, v_payment_state, v_outstanding_minor
  from public.payments p
  join public.dining_sessions s on s.id = p.session_id
  where p.id = p_payment_id
  for update of p, s;

  if not found then
    return;
  end if;
  if not app_private.has_branch_permission(v_branch_id, 'payment.confirm') then
    raise exception 'Payment confirmation permission is required.' using errcode = '42501';
  end if;
  if p_actor_id is distinct from auth.uid() then
    raise exception 'The payment actor does not match the authenticated staff actor.' using errcode = '42501';
  end if;
  if v_payment_state <> 'PENDING' then
    raise exception 'This payment is no longer pending.' using errcode = 'P0001';
  end if;
  if v_amount_minor > v_outstanding_minor then
    raise exception 'The payment exceeds the current outstanding balance.' using errcode = 'P0001';
  end if;
  if v_method = 'CASH' and coalesce(p_cash_received_minor, 0) < v_amount_minor then
    raise exception 'Cash received must cover the payment amount.' using errcode = '22023';
  end if;
  if v_method <> 'CASH' and nullif(btrim(coalesce(p_observed_reference, '')), '') is null then
    raise exception 'An observed payment reference is required.' using errcode = '22023';
  end if;

  v_change_minor := case when v_method = 'CASH' then coalesce(p_cash_received_minor, 0) - v_amount_minor else 0 end;
  update public.payments
  set state = 'CONFIRMED',
      cash_received_minor = case when v_method = 'CASH' then p_cash_received_minor else null end,
      change_minor = v_change_minor,
      observed_reference = nullif(btrim(p_observed_reference), ''),
      actor_id = p_actor_id,
      confirmed_at = now()
  where id = p_payment_id;

  insert into public.payment_allocations (payment_id, session_id, amount_minor)
  values (p_payment_id, v_session_id, v_amount_minor)
  on conflict on constraint payment_allocations_pkey do nothing;

  update public.dining_sessions
  set total_paid_minor = total_paid_minor + v_amount_minor,
      version = version + 1
  where id = v_session_id;

  return query select p_payment_id, 'CONFIRMED'::public.payment_state, v_change_minor;
end;
$$;

revoke all on function public.confirm_payment(uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, bigint, text, uuid) to authenticated;
