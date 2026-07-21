begin;

create index dining_sessions_branch_business_date
  on public.dining_sessions(branch_id, business_date, state);
create index payments_branch_confirmed_method
  on public.payments(branch_id, confirmed_at, method)
  where state = 'CONFIRMED';
create index receipts_branch_session_original
  on public.receipts(branch_id, session_id)
  where reprint_of is null;

create or replace function public.read_branch_operations_report(
  p_branch_id uuid,
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_branch_name text;
  v_timezone text;
  v_currency text;
  v_report jsonb;
begin
  if auth.uid() is null or app_private.is_anonymous_claim() then
    raise exception 'Permanent staff sign-in is required.' using errcode = '42501';
  end if;
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then
    raise exception 'The report date range is invalid.' using errcode = '22023';
  end if;
  if p_to_date - p_from_date > 366 then
    raise exception 'The report date range cannot exceed 366 days.' using errcode = '22023';
  end if;
  if not app_private.has_branch_permission(p_branch_id, 'report.read') then
    return null;
  end if;

  select b.name, b.timezone, b.currency
    into v_branch_name, v_timezone, v_currency
  from public.branches b
  where b.id = p_branch_id;
  if not found then return null; end if;

  with scoped_sessions as (
    select s.*
    from public.dining_sessions s
    where s.branch_id = p_branch_id
      and s.business_date between p_from_date and p_to_date
  ), scoped_orders as (
    select o.*
    from public.orders o
    join scoped_sessions s on s.id = o.session_id
    where o.state not in ('REJECTED', 'CANCELLED')
  )
  select jsonb_build_object(
    'branchId', p_branch_id,
    'branchName', v_branch_name,
    'timezone', v_timezone,
    'currency', v_currency,
    'fromDate', p_from_date,
    'toDate', p_to_date,
    'sessions', (select count(*) from scoped_sessions),
    'completedSessions', (select count(*) from scoped_sessions s where s.state in ('PAID', 'CLOSED')),
    'orders', (select count(*) from scoped_orders),
    'itemQuantity', coalesce((select sum(oi.quantity) from public.order_items oi join scoped_orders o on o.id = oi.order_id), 0),
    'grossOrderMinor', coalesce((select sum(o.total_minor) from scoped_orders o), 0),
    'discountsMinor', coalesce((select sum(d.discount_minor) from public.discounts d join scoped_sessions s on s.id = d.session_id), 0),
    'netBilledMinor', coalesce((select sum(s.total_due_minor) from scoped_sessions s), 0),
    'confirmedPaymentsMinor', coalesce((select sum(p.amount_minor) from public.payments p join scoped_sessions s on s.id = p.session_id where p.state = 'CONFIRMED'), 0),
    'outstandingMinor', coalesce((select sum(greatest(s.total_due_minor - s.total_paid_minor, 0)) from scoped_sessions s), 0),
    'averageTicketMinor', coalesce((select sum(s.total_due_minor) / nullif(count(*) filter (where s.total_due_minor > 0), 0) from scoped_sessions s where s.total_due_minor > 0), 0),
    'serviceRequests', (select count(*) from public.service_requests sr join scoped_sessions s on s.id = sr.session_id),
    'paymentMethods', (
      select coalesce(jsonb_agg(jsonb_build_object('method', methods.method, 'paymentCount', methods.payment_count, 'amountMinor', methods.amount_minor) order by methods.method), '[]'::jsonb)
      from (
        select p.method::text as method, count(*) as payment_count, sum(p.amount_minor) as amount_minor
        from public.payments p
        join scoped_sessions s on s.id = p.session_id
        where p.state = 'CONFIRMED'
        group by p.method
      ) methods
    ),
    'reconciliationExceptions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sessionId', exceptions.session_id,
        'businessDate', exceptions.business_date,
        'tableLabel', exceptions.table_label,
        'state', exceptions.state,
        'dueMinor', exceptions.total_due_minor,
        'paidMinor', exceptions.total_paid_minor,
        'confirmedAllocationsMinor', exceptions.confirmed_allocations_minor,
        'issues', exceptions.issues
      ) order by exceptions.business_date, exceptions.session_id), '[]'::jsonb)
      from (
        select reconciled.*
        from (
          select
            s.id as session_id,
            s.business_date,
            t.label as table_label,
            s.state::text as state,
            s.total_due_minor,
            s.total_paid_minor,
            coalesce((
              select sum(pa.amount_minor)
              from public.payment_allocations pa
              join public.payments p on p.id = pa.payment_id and p.state = 'CONFIRMED'
              where pa.session_id = s.id
            ), 0) as confirmed_allocations_minor,
            array_remove(array[
              case when s.total_paid_minor <> coalesce((
                select sum(pa.amount_minor)
                from public.payment_allocations pa
                join public.payments p on p.id = pa.payment_id and p.state = 'CONFIRMED'
                where pa.session_id = s.id
              ), 0) then 'PAID_TOTAL_ALLOCATION_MISMATCH' end,
              case when s.state in ('PAID', 'CLOSED') and s.total_due_minor <> s.total_paid_minor then 'PAID_STATE_BALANCE_MISMATCH' end,
              case when s.state in ('PAID', 'CLOSED') and not exists (
                select 1 from public.receipts r where r.session_id = s.id and r.reprint_of is null
              ) then 'MISSING_ORIGINAL_RECEIPT' end
            ], null) as issues
          from scoped_sessions s
          join public.restaurant_tables t on t.id = s.table_id
        ) reconciled
        where cardinality(reconciled.issues) > 0
      ) exceptions
    )
  ) into v_report;

  return v_report;
end;
$$;

revoke all on function public.read_branch_operations_report(uuid, date, date) from public, anon, authenticated;
grant execute on function public.read_branch_operations_report(uuid, date, date) to authenticated;

commit;
