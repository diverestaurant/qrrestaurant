begin;

insert into public.permissions (id, permission_key, display_name)
values ('00000000-0000-4000-8000-000000000217', 'branch.manage', 'Manage Branches')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key = 'branch.manage'
where r.role_key in ('PLATFORM', 'OWNER')
on conflict do nothing;

create or replace function app_private.has_restaurant_owner_scope(
  p_restaurant_id uuid,
  p_anchor_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
  select not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.staff_memberships sm
      join public.roles role on role.id = sm.role_id
      join public.restaurants restaurant on restaurant.id = p_restaurant_id
      join public.branches anchor on anchor.id = p_anchor_branch_id and anchor.restaurant_id = restaurant.id
      where sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'
        and sm.restaurant_id = restaurant.id
        and (sm.branch_id is null or sm.branch_id = anchor.id)
        and role.role_key in ('OWNER', 'PLATFORM')
        and restaurant.status = 'ACTIVE'
        and anchor.status = 'ACTIVE'
    );
$$;

create or replace function public.read_restaurant_branches(
  p_restaurant_id uuid,
  p_anchor_branch_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_result jsonb;
begin
  if not app_private.has_restaurant_owner_scope(p_restaurant_id, p_anchor_branch_id) then
    raise exception 'Restaurant Owner permission is required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'status', b.status,
    'currency', b.currency,
    'timezone', b.timezone,
    'businessDayCutoff', to_char(b.business_day_cutoff, 'HH24:MI'),
    'version', b.version,
    'defaultLocale', bs.default_locale,
    'createdAt', b.created_at
  ) order by b.created_at, b.name), '[]'::jsonb)
  into v_result
  from public.branches b
  join public.branch_settings bs on bs.branch_id = b.id and bs.restaurant_id = b.restaurant_id
  where b.restaurant_id = p_restaurant_id;

  return v_result;
end;
$$;

create or replace function public.execute_branch_lifecycle_command(
  p_restaurant_id uuid,
  p_anchor_branch_id uuid,
  p_command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_type text := p_command ->> 'type';
  v_branch_id uuid;
  v_branch_version integer;
  v_status text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if not app_private.has_restaurant_owner_scope(p_restaurant_id, p_anchor_branch_id) then
    raise exception 'Restaurant Owner permission is required.' using errcode = '42501';
  end if;

  if v_type = 'branch.create' then
    if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_command ->> 'timezone') then
      raise exception 'Branch timezone is invalid.' using errcode = '22023';
    end if;
    v_branch_id := (p_command ->> 'branchId')::uuid;
    insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone, business_day_cutoff)
    values (
      v_branch_id,
      p_restaurant_id,
      p_command ->> 'slug',
      p_command ->> 'name',
      'ACTIVE',
      upper(p_command ->> 'currency'),
      p_command ->> 'timezone',
      (p_command ->> 'businessDayCutoff')::time
    );
    insert into public.branch_settings (restaurant_id, branch_id, default_locale, country_code, updated_by)
    values (p_restaurant_id, v_branch_id, p_command ->> 'defaultLocale', upper(p_command ->> 'countryCode'), auth.uid());

    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (p_restaurant_id, v_branch_id, auth.uid(), 'OWNER', 'branch.created', 'branch', v_branch_id, 'Authorized Owner Branch creation', null, jsonb_build_object('slug', p_command ->> 'slug', 'status', 'ACTIVE', 'version', 1), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (p_restaurant_id, v_branch_id, 'branch.created', 'branch', v_branch_id, 1, jsonb_build_object('branchId', v_branch_id, 'status', 'ACTIVE', 'version', 1));
    return jsonb_build_object('branchId', v_branch_id, 'status', 'ACTIVE', 'version', 1);
  elsif v_type = 'branch.lifecycle.set' then
    v_branch_id := (p_command ->> 'branchId')::uuid;
    v_status := p_command ->> 'status';
    if v_status not in ('ACTIVE', 'SUSPENDED') then
      raise exception 'Branch status is invalid.' using errcode = '22023';
    end if;
    if v_status = 'SUSPENDED' and not exists (
      select 1 from public.branches b
      where b.restaurant_id = p_restaurant_id and b.id <> v_branch_id and b.status = 'ACTIVE'
    ) then
      raise exception 'The last active Branch cannot be suspended.' using errcode = 'P0001';
    end if;

    update public.branches b set
      status = v_status::public.branch_status,
      version = b.version + 1,
      updated_at = now()
    where b.id = v_branch_id
      and b.restaurant_id = p_restaurant_id
      and b.version = (p_command ->> 'expectedVersion')::integer
    returning b.version into v_branch_version;
    if not found then
      raise exception 'The Branch lifecycle changed. Refresh before saving.' using errcode = 'P0003';
    end if;

    if v_status = 'SUSPENDED' then
      update public.table_qr_tokens token set active = false, revoked_at = coalesce(token.revoked_at, now())
      where token.branch_id = v_branch_id and token.active;
      update public.customer_session_grants grant_row set revoked_at = coalesce(grant_row.revoked_at, now())
      where grant_row.branch_id = v_branch_id and grant_row.revoked_at is null;
    end if;

    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (p_restaurant_id, v_branch_id, auth.uid(), 'OWNER', 'branch.lifecycle_set', 'branch', v_branch_id, trim(p_command ->> 'reason'), jsonb_build_object('version', v_branch_version - 1), jsonb_build_object('status', v_status, 'version', v_branch_version), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (p_restaurant_id, v_branch_id, 'branch.lifecycle_set', 'branch', v_branch_id, v_branch_version, jsonb_build_object('branchId', v_branch_id, 'status', v_status, 'version', v_branch_version));
    return jsonb_build_object('branchId', v_branch_id, 'status', v_status, 'version', v_branch_version);
  end if;

  raise exception 'Branch lifecycle command type is invalid.' using errcode = '22023';
end;
$$;

revoke all on function app_private.has_restaurant_owner_scope(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_restaurant_branches(uuid, uuid) from public, anon, authenticated;
revoke all on function public.execute_branch_lifecycle_command(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function app_private.has_restaurant_owner_scope(uuid, uuid) to authenticated;
grant execute on function public.read_restaurant_branches(uuid, uuid) to authenticated;
grant execute on function public.execute_branch_lifecycle_command(uuid, uuid, jsonb) to authenticated;

commit;
