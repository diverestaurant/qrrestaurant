drop policy if exists branches_staff_select on public.branches;
create policy branches_staff_select on public.branches
for select to authenticated
using (
  app_private.has_branch_permission(id, 'report.read')
  or app_private.has_branch_permission(id, 'table.manage')
  or app_private.has_branch_permission(id, 'session.open')
);

create policy table_staff_select on public.restaurant_tables
for select to authenticated
using (
  app_private.has_branch_permission(branch_id, 'table.manage')
  or app_private.has_branch_permission(branch_id, 'session.open')
);

grant insert, update on public.dining_sessions to authenticated;

create or replace function public.open_dining_session(
  p_session_id uuid,
  p_table_id uuid,
  p_guest_count smallint,
  p_business_date date,
  p_currency char(3),
  p_join_code_hash text,
  p_join_code_expires_at timestamptz,
  p_opened_by uuid
)
returns table(session_id uuid, version integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_opened_by is distinct from auth.uid() then
    raise exception 'The session opener does not match the authenticated staff actor.' using errcode = '42501';
  end if;

  insert into public.dining_sessions (
    id,
    restaurant_id,
    branch_id,
    table_id,
    state,
    guest_count,
    business_date,
    opened_by,
    currency
  )
  select
    p_session_id,
    t.restaurant_id,
    t.branch_id,
    t.id,
    'OPEN',
    p_guest_count,
    p_business_date,
    p_opened_by,
    p_currency
  from public.restaurant_tables t
  where t.id = p_table_id
    and t.active;

  if not found then
    raise exception 'The table is not available.' using errcode = 'P0002';
  end if;

  insert into public.session_join_codes (session_id, code_hash, expires_at)
  values (p_session_id, p_join_code_hash, p_join_code_expires_at);

  return query
  select s.id, s.version
  from public.dining_sessions s
  where s.id = p_session_id;
end;
$$;

revoke all on function public.open_dining_session(uuid, uuid, smallint, date, char, text, timestamptz, uuid) from public, anon;
grant execute on function public.open_dining_session(uuid, uuid, smallint, date, char, text, timestamptz, uuid) to authenticated;
