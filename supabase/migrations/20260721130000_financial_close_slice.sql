-- Local V1 financial closure slice: authoritative discounts, multi-tender state,
-- immutable receipts, reconciliation and Session closure.

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null,
  kind text not null check (kind in ('PERCENT', 'FIXED')),
  percentage_basis_points integer,
  fixed_amount_minor bigint,
  discount_minor bigint not null check (discount_minor > 0),
  reason text not null check (length(btrim(reason)) between 1 and 240),
  actor_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  check (
    (kind = 'PERCENT' and percentage_basis_points between 1 and 10000 and fixed_amount_minor is null)
    or (kind = 'FIXED' and percentage_basis_points is null and fixed_amount_minor > 0)
  ),
  unique (restaurant_id, branch_id, id)
);

create unique index discounts_branch_idempotency_key on public.discounts(branch_id, idempotency_key);
create index discounts_session_created on public.discounts(session_id, created_at);
create unique index payments_branch_idempotency_key on public.payments(branch_id, idempotency_key);
create unique index receipts_one_original_per_session on public.receipts(session_id) where reprint_of is null;

-- The local synthetic browser fixture uses the server-only role to create and
-- remove isolated Sessions. This is never granted to anon/authenticated and
-- is not used by browser code or remote environments in this BUILD.
grant insert, delete on public.dining_sessions to service_role;

alter table public.discounts enable row level security;
revoke all on public.discounts from anon, authenticated;
grant select on public.discounts to authenticated;
grant select on public.discounts to service_role;

create policy discounts_staff_select on public.discounts
for select to authenticated
using (
  app_private.has_branch_permission(branch_id, 'discount.apply')
  or app_private.has_branch_permission(branch_id, 'payment.begin')
  or app_private.has_branch_permission(branch_id, 'receipt.issue')
);

-- Every committed order contributes to the authoritative Session bill. This
-- keeps customer and waiter order paths on the same server-side total.
create or replace function app_private.sync_order_total_to_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  update public.dining_sessions
  set total_due_minor = total_due_minor + new.total_minor
  where id = new.session_id;
  return new;
end;
$$;

revoke all on function app_private.sync_order_total_to_session() from public, anon, authenticated;

drop trigger if exists orders_sync_session_total on public.orders;
create trigger orders_sync_session_total
after insert on public.orders
for each row
execute function app_private.sync_order_total_to_session();

create or replace function public.begin_payment(
  p_session_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_method public.payment_method,
  p_expected_session_version integer,
  p_idempotency_key uuid,
  p_actor_id uuid
)
returns table(payment_id uuid, state public.payment_state, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_currency char(3);
  v_state public.session_state;
  v_version integer;
  v_outstanding_minor bigint;
  v_payment_id uuid := gen_random_uuid();
  v_new_version integer;
begin
  if p_actor_id is distinct from v_actor_id then
    raise exception 'The payment actor does not match the authenticated staff actor.' using errcode = '42501';
  end if;
  if p_amount_minor <= 0 or length(btrim(coalesce(p_currency, ''))) <> 3 then
    raise exception 'Payment amount or currency is invalid.' using errcode = '22023';
  end if;
  select s.restaurant_id, s.branch_id, s.currency, s.state, s.version, s.total_due_minor - s.total_paid_minor
    into v_restaurant_id, v_branch_id, v_currency, v_state, v_version, v_outstanding_minor
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'payment.begin') then raise exception 'Payment begin permission is required.' using errcode = '42501'; end if;
  if v_state in ('PAID', 'CLOSED', 'CANCELLED') then raise exception 'This Session cannot accept another payment.' using errcode = 'P0001'; end if;
  if v_version <> p_expected_session_version then raise exception 'The bill changed. Refresh before taking payment.' using errcode = 'P0003'; end if;
  if upper(btrim(p_currency)) <> upper(v_currency::text) or p_amount_minor > v_outstanding_minor then raise exception 'Payment amount must match the current outstanding balance.' using errcode = '22023'; end if;

  insert into public.payments (id, restaurant_id, branch_id, session_id, state, method, amount_minor, currency, idempotency_key, actor_id)
  values (v_payment_id, v_restaurant_id, v_branch_id, p_session_id, 'PENDING', p_method, p_amount_minor, v_currency, p_idempotency_key, v_actor_id);
  v_new_version := v_version + 1;
  update public.dining_sessions set state = 'PAYMENT_PENDING', version = v_new_version where id = p_session_id;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'payment.started', 'payment', v_payment_id, jsonb_build_object('amountMinor', p_amount_minor, 'method', p_method, 'sessionId', p_session_id), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'payment.started', 'payment', v_payment_id, v_new_version, jsonb_build_object('paymentId', v_payment_id, 'sessionId', p_session_id, 'amountMinor', p_amount_minor, 'version', v_new_version));
  return query select v_payment_id, 'PENDING'::public.payment_state, v_new_version;
end;
$$;

revoke all on function public.begin_payment(uuid, bigint, text, public.payment_method, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_payment(uuid, bigint, text, public.payment_method, integer, uuid, uuid) to authenticated;

create or replace function public.apply_session_discount(
  p_session_id uuid,
  p_kind text,
  p_percentage_basis_points integer,
  p_fixed_amount_minor bigint,
  p_reason text,
  p_expected_session_version integer,
  p_idempotency_key uuid,
  p_actor_id uuid
)
returns table(discount_id uuid, discount_minor bigint, total_due_minor bigint, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_version integer;
  v_total_due_minor bigint;
  v_total_paid_minor bigint;
  v_outstanding_minor bigint;
  v_discount_minor bigint;
  v_discount_id uuid := gen_random_uuid();
  v_new_version integer;
begin
  if p_actor_id is distinct from v_actor_id then
    raise exception 'The discount actor does not match the authenticated staff actor.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 240 then
    raise exception 'A discount reason is required.' using errcode = '22023';
  end if;
  if upper(p_kind) not in ('PERCENT', 'FIXED') then
    raise exception 'Discount type is invalid.' using errcode = '22023';
  end if;

  select s.restaurant_id, s.branch_id, s.state, s.version, s.total_due_minor, s.total_paid_minor
    into v_restaurant_id, v_branch_id, v_state, v_version, v_total_due_minor, v_total_paid_minor
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if not app_private.has_branch_permission(v_branch_id, 'discount.apply') then
    raise exception 'Discount permission is required.' using errcode = '42501';
  end if;
  if v_state in ('PAID', 'CLOSED', 'CANCELLED') then
    raise exception 'This Session cannot accept a discount.' using errcode = 'P0001';
  end if;
  if v_version <> p_expected_session_version then
    raise exception 'The Session changed. Refresh before applying the discount.' using errcode = 'P0003';
  end if;
  v_outstanding_minor := v_total_due_minor - v_total_paid_minor;
  if v_outstanding_minor <= 0 then
    raise exception 'The Session has no outstanding balance.' using errcode = 'P0001';
  end if;

  if upper(p_kind) = 'PERCENT' then
    if p_percentage_basis_points is null or p_percentage_basis_points < 1 or p_percentage_basis_points > 10000 or p_fixed_amount_minor is not null then
      raise exception 'Percentage discount details are invalid.' using errcode = '22023';
    end if;
    v_discount_minor := floor((v_total_due_minor::numeric * p_percentage_basis_points) / 10000)::bigint;
  else
    if p_fixed_amount_minor is null or p_fixed_amount_minor <= 0 or p_percentage_basis_points is not null then
      raise exception 'Fixed discount details are invalid.' using errcode = '22023';
    end if;
    v_discount_minor := p_fixed_amount_minor;
  end if;
  if v_discount_minor <= 0 then
    raise exception 'The discount is smaller than one minor currency unit.' using errcode = '22023';
  end if;
  if v_discount_minor > v_outstanding_minor then
    raise exception 'The discount exceeds the outstanding balance.' using errcode = 'P0001';
  end if;

  insert into public.discounts (id, restaurant_id, branch_id, session_id, kind, percentage_basis_points, fixed_amount_minor, discount_minor, reason, actor_id, idempotency_key)
  values (v_discount_id, v_restaurant_id, v_branch_id, p_session_id, upper(p_kind), p_percentage_basis_points, p_fixed_amount_minor, v_discount_minor, btrim(p_reason), v_actor_id, p_idempotency_key);

  v_new_version := v_version + 1;
  update public.dining_sessions
  set total_due_minor = public.dining_sessions.total_due_minor - v_discount_minor,
      version = v_new_version
  where id = p_session_id;

  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'session.discount_applied', 'discount', v_discount_id, btrim(p_reason), jsonb_build_object('totalDueMinor', v_total_due_minor, 'version', v_version), jsonb_build_object('discountMinor', v_discount_minor, 'totalDueMinor', v_total_due_minor - v_discount_minor, 'version', v_new_version), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'session.discount_applied', 'dining_session', p_session_id, v_new_version, jsonb_build_object('discountId', v_discount_id, 'discountMinor', v_discount_minor, 'totalDueMinor', v_total_due_minor - v_discount_minor, 'version', v_new_version));

  return query select v_discount_id, v_discount_minor, v_total_due_minor - v_discount_minor, v_new_version;
end;
$$;

revoke all on function public.apply_session_discount(uuid, text, integer, bigint, text, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_session_discount(uuid, text, integer, bigint, text, integer, uuid, uuid) to authenticated;

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
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_session_id uuid;
  v_amount_minor bigint;
  v_method public.payment_method;
  v_payment_state public.payment_state;
  v_outstanding_minor bigint;
  v_total_due_minor bigint;
  v_total_paid_minor bigint;
  v_change_minor bigint;
  v_new_session_state public.session_state;
begin
  select p.restaurant_id, p.branch_id, p.session_id, p.amount_minor, p.method, p.state,
         s.total_due_minor - s.total_paid_minor, s.total_due_minor, s.total_paid_minor
    into v_restaurant_id, v_branch_id, v_session_id, v_amount_minor, v_method, v_payment_state,
         v_outstanding_minor, v_total_due_minor, v_total_paid_minor
  from public.payments p
  join public.dining_sessions s on s.id = p.session_id
  where p.id = p_payment_id
  for update of p, s;
  if not found then return; end if;
  if not app_private.has_branch_permission(v_branch_id, 'payment.confirm') then
    raise exception 'Payment confirmation permission is required.' using errcode = '42501';
  end if;
  if p_actor_id is distinct from v_actor_id then
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
      actor_id = v_actor_id,
      confirmed_at = now()
  where id = p_payment_id;

  insert into public.payment_allocations (payment_id, session_id, amount_minor)
  values (p_payment_id, v_session_id, v_amount_minor)
  on conflict on constraint payment_allocations_pkey do nothing;

  v_new_session_state := case when v_total_paid_minor + v_amount_minor = v_total_due_minor then 'PAID'::public.session_state else 'PAYMENT_PENDING'::public.session_state end;
  update public.dining_sessions
  set total_paid_minor = total_paid_minor + v_amount_minor,
      state = v_new_session_state,
      version = version + 1
  where id = v_session_id;

  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'payment.confirmed', 'payment', p_payment_id, jsonb_build_object('amountMinor', v_amount_minor, 'method', v_method, 'changeMinor', v_change_minor, 'sessionState', v_new_session_state), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'payment.confirmed', 'payment', p_payment_id, (select version from public.dining_sessions where id = v_session_id), jsonb_build_object('paymentId', p_payment_id, 'sessionId', v_session_id, 'amountMinor', v_amount_minor, 'sessionState', v_new_session_state));

  return query select p_payment_id, 'CONFIRMED'::public.payment_state, v_change_minor;
end;
$$;

revoke all on function public.confirm_payment(uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, bigint, text, uuid) to authenticated;

create or replace function public.issue_receipt(
  p_session_id uuid,
  p_actor_id uuid
)
returns table(receipt_id uuid, receipt_number text, snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_business_date date;
  v_total_due_minor bigint;
  v_total_paid_minor bigint;
  v_currency char(3);
  v_receipt_id uuid;
  v_receipt_number text;
  v_sequence bigint;
  v_snapshot jsonb;
begin
  if p_actor_id is distinct from v_actor_id then
    raise exception 'The receipt actor does not match the authenticated staff actor.' using errcode = '42501';
  end if;
  select s.restaurant_id, s.branch_id, s.state, s.business_date, s.total_due_minor, s.total_paid_minor, s.currency
    into v_restaurant_id, v_branch_id, v_state, v_business_date, v_total_due_minor, v_total_paid_minor, v_currency
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'receipt.issue') then
    raise exception 'Receipt permission is required.' using errcode = '42501';
  end if;
  if v_state not in ('PAID', 'CLOSED') or v_total_paid_minor <> v_total_due_minor then
    raise exception 'A fully paid Session is required before issuing a receipt.' using errcode = 'P0001';
  end if;
  select r.id, r.receipt_number, r.snapshot into v_receipt_id, v_receipt_number, v_snapshot
  from public.receipts r
  where r.session_id = p_session_id and r.reprint_of is null;
  if found then return query select v_receipt_id, v_receipt_number, v_snapshot; return; end if;

  perform pg_advisory_xact_lock(hashtextextended(('receipt:' || v_branch_id::text), 0));
  select count(*) + 1 into v_sequence
  from public.receipts r
  where r.branch_id = v_branch_id
    and r.receipt_number like to_char(v_business_date, 'YYYYMMDD') || '-%';
  v_receipt_id := gen_random_uuid();
  v_receipt_number := to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_sequence::text, 6, '0');
  v_snapshot := jsonb_build_object(
    'receiptNumber', v_receipt_number,
    'sessionId', p_session_id,
    'businessDate', v_business_date,
    'currency', v_currency,
    'totalDueMinor', v_total_due_minor,
    'totalPaidMinor', v_total_paid_minor,
    'discounts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'discountMinor', d.discount_minor, 'reason', d.reason) order by d.created_at, d.id) from public.discounts d where d.session_id = p_session_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'displayNumber', o.display_number, 'totalMinor', o.total_minor, 'items', coalesce((select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity, 'unitPriceMinor', oi.unit_price_minor, 'variant', oi.variant_snapshot, 'modifiers', oi.modifier_snapshot) order by oi.created_at, oi.id) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb)) order by o.created_at, o.id) from public.orders o where o.session_id = p_session_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'method', p.method, 'amountMinor', p.amount_minor, 'cashReceivedMinor', p.cash_received_minor, 'changeMinor', p.change_minor, 'reference', p.observed_reference) order by p.created_at, p.id) from public.payments p where p.session_id = p_session_id and p.state = 'CONFIRMED'), '[]'::jsonb),
    'issuedAt', now()
  );
  insert into public.receipts (id, restaurant_id, branch_id, session_id, receipt_number, snapshot, issued_by)
  values (v_receipt_id, v_restaurant_id, v_branch_id, p_session_id, v_receipt_number, v_snapshot, v_actor_id);
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'receipt.issued', 'receipt', v_receipt_id, jsonb_build_object('receiptNumber', v_receipt_number, 'sessionId', p_session_id, 'totalPaidMinor', v_total_paid_minor), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'receipt.issued', 'receipt', v_receipt_id, (select version from public.dining_sessions where id = p_session_id), jsonb_build_object('receiptId', v_receipt_id, 'receiptNumber', v_receipt_number, 'sessionId', p_session_id));
  return query select v_receipt_id, v_receipt_number, v_snapshot;
end;
$$;

revoke all on function public.issue_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_receipt(uuid, uuid) to authenticated;

create or replace function public.reprint_receipt(
  p_receipt_id uuid,
  p_actor_id uuid
)
returns table(receipt_id uuid, receipt_number text, snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_original_number text;
  v_original_snapshot jsonb;
  v_session_id uuid;
  v_business_date date;
  v_sequence bigint;
  v_receipt_id uuid := gen_random_uuid();
  v_receipt_number text;
  v_snapshot jsonb;
begin
  if p_actor_id is distinct from v_actor_id then raise exception 'The receipt actor does not match the authenticated staff actor.' using errcode = '42501'; end if;
  select r.restaurant_id, r.branch_id, r.receipt_number, r.snapshot, r.session_id, s.business_date
    into v_restaurant_id, v_branch_id, v_original_number, v_original_snapshot, v_session_id, v_business_date
  from public.receipts r join public.dining_sessions s on s.id = r.session_id
  where r.id = p_receipt_id
  for update of r;
  if not found then raise exception 'Receipt not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'receipt.issue') then raise exception 'Receipt permission is required.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(('receipt:' || v_branch_id::text), 0));
  select count(*) + 1 into v_sequence from public.receipts r where r.branch_id = v_branch_id and r.receipt_number like to_char(v_business_date, 'YYYYMMDD') || '-%';
  v_receipt_number := to_char(v_business_date, 'YYYYMMDD') || '-R' || lpad(v_sequence::text, 6, '0');
  v_snapshot := jsonb_set(v_original_snapshot, '{reprintOf}', to_jsonb(p_receipt_id), true);
  insert into public.receipts (id, restaurant_id, branch_id, session_id, receipt_number, snapshot, issued_by, reprint_of)
  values (v_receipt_id, v_restaurant_id, v_branch_id, v_session_id, v_receipt_number, v_snapshot, v_actor_id, p_receipt_id);
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'receipt.reprinted', 'receipt', v_receipt_id, jsonb_build_object('receiptNumber', v_receipt_number, 'reprintOf', p_receipt_id, 'originalNumber', v_original_number), gen_random_uuid());
  return query select v_receipt_id, v_receipt_number, v_snapshot;
end;
$$;

revoke all on function public.reprint_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reprint_receipt(uuid, uuid) to authenticated;

create or replace function public.close_dining_session(
  p_session_id uuid,
  p_expected_session_version integer,
  p_actor_id uuid
)
returns table(session_id uuid, state public.session_state, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_version integer;
  v_total_due_minor bigint;
  v_total_paid_minor bigint;
  v_confirmed_allocated bigint;
  v_pending_count bigint;
  v_new_version integer;
begin
  if p_actor_id is distinct from v_actor_id then raise exception 'The Session close actor does not match the authenticated staff actor.' using errcode = '42501'; end if;
  select s.restaurant_id, s.branch_id, s.state, s.version, s.total_due_minor, s.total_paid_minor
    into v_restaurant_id, v_branch_id, v_state, v_version, v_total_due_minor, v_total_paid_minor
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'session.close') then raise exception 'Session close permission is required.' using errcode = '42501'; end if;
  if v_state = 'CLOSED' then return query select p_session_id, v_state, v_version; return; end if;
  if v_version <> p_expected_session_version then raise exception 'The Session changed. Refresh before closing.' using errcode = 'P0003'; end if;
  if v_state <> 'PAID' or v_total_paid_minor <> v_total_due_minor then raise exception 'The Session must be fully paid before it can be closed.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.receipts r where r.session_id = p_session_id and r.reprint_of is null) then raise exception 'Issue the original receipt before closing the Session.' using errcode = 'P0001'; end if;
  select coalesce(sum(pa.amount_minor) filter (where p.state = 'CONFIRMED'), 0), count(*) filter (where p.state = 'PENDING')
    into v_confirmed_allocated, v_pending_count
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.session_id = p_session_id;
  if v_pending_count > 0 or v_confirmed_allocated <> v_total_paid_minor then raise exception 'The Session has unreconciled payments.' using errcode = 'P0001'; end if;

  v_new_version := v_version + 1;
  update public.dining_sessions set state = 'CLOSED', closed_by = v_actor_id, closed_at = now(), version = v_new_version where id = p_session_id;
  update public.customer_session_grants
  set revoked_at = now()
  where public.customer_session_grants.session_id = p_session_id
    and public.customer_session_grants.revoked_at is null;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'session.closed', 'dining_session', p_session_id, jsonb_build_object('state', 'CLOSED', 'totalPaidMinor', v_total_paid_minor, 'version', v_new_version), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'session.closed', 'dining_session', p_session_id, v_new_version, jsonb_build_object('sessionId', p_session_id, 'state', 'CLOSED', 'version', v_new_version));
  return query select p_session_id, 'CLOSED'::public.session_state, v_new_version;
end;
$$;

revoke all on function public.close_dining_session(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.close_dining_session(uuid, integer, uuid) to authenticated;

-- The cashier can finish the V1 whole-session manual-tender lifecycle.
insert into public.permissions (id, permission_key, display_name)
values ('00000000-0000-4000-8000-000000000216', 'session.close', 'Close Session')
on conflict (id) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.role_key in ('PLATFORM', 'OWNER', 'MANAGER', 'CASHIER') and p.permission_key = 'session.close'
on conflict do nothing;
