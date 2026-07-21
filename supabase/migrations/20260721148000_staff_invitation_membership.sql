begin;

create or replace function public.create_staff_membership_from_invite(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_user_id uuid,
  p_role_id uuid
)
returns table(membership_id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_membership_id uuid := gen_random_uuid();
  v_version integer;
  v_role_key text;
begin
  if auth.uid() is null or not app_private.has_branch_permission(p_branch_id, 'staff.manage') then
    raise exception 'Staff management permission is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    join public.restaurants r on r.id = b.restaurant_id
    where b.id = p_branch_id and b.restaurant_id = p_restaurant_id
      and b.status = 'ACTIVE' and r.status = 'ACTIVE'
  ) then
    raise exception 'The Restaurant and Branch must be active.' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use a second authorized manager to change your own access.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id and coalesce(u.is_anonymous, false) = false and u.email is not null) then
    raise exception 'A permanent invited Auth user is required.' using errcode = '22023';
  end if;
  select r.role_key into v_role_key from public.roles r where r.id = p_role_id and r.scope = 'BRANCH';
  if not found or v_role_key in ('PLATFORM', 'OWNER') then
    raise exception 'Only a supported Branch role can be assigned by this workflow.' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_memberships sm where sm.user_id = p_user_id and sm.restaurant_id = p_restaurant_id and sm.branch_id = p_branch_id) then
    raise exception 'This Auth user already has a membership in the Branch.' using errcode = 'P0001';
  end if;

  insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
  values (v_membership_id, p_user_id, p_restaurant_id, p_branch_id, p_role_id, 'ACTIVE')
  returning public.staff_memberships.version into v_version;
  return query select v_membership_id, v_version;
end;
$$;

revoke all on function public.create_staff_membership_from_invite(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_staff_membership_from_invite(uuid, uuid, uuid, uuid) to authenticated;

commit;
