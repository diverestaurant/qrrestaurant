create or replace function public.read_branch_summary(p_branch_id uuid)
returns table(
  branch_id uuid,
  branch_name text,
  active_tables bigint,
  open_sessions bigint,
  outstanding_service_requests bigint,
  unavailable_menu_items bigint,
  total_due_minor bigint,
  total_paid_minor bigint
)
language sql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
  select
    b.id,
    b.name,
    (select count(*) from public.restaurant_tables t where t.branch_id = b.id and t.active),
    (select count(*) from public.dining_sessions s where s.branch_id = b.id and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID')),
    (select count(*) from public.service_requests r where r.branch_id = b.id and r.state in ('OPEN', 'CLAIMED')),
    (select count(*) from public.menu_items m where m.branch_id = b.id and m.visible and not m.available),
    coalesce((select sum(s.total_due_minor) from public.dining_sessions s where s.branch_id = b.id and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID')), 0),
    coalesce((select sum(s.total_paid_minor) from public.dining_sessions s where s.branch_id = b.id and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID')), 0)
  from public.branches b
  where b.id = p_branch_id
    and app_private.has_branch_permission(p_branch_id, 'report.read');
$$;

revoke all on function public.read_branch_summary(uuid) from public, anon, authenticated;
grant execute on function public.read_branch_summary(uuid) to authenticated;
