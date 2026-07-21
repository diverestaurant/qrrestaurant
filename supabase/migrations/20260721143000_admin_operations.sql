begin;

alter table public.kitchen_stations add column if not exists version integer not null default 1 check (version > 0);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  flag_key text not null check (flag_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  enabled boolean not null default false,
  description text check (description is null or length(description) <= 240),
  version integer not null default 1 check (version > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (branch_id, flag_key),
  unique (restaurant_id, branch_id, id)
);

alter table public.feature_flags enable row level security;
revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to authenticated;
grant select on public.feature_flags to service_role;

create policy feature_flags_staff_read on public.feature_flags
for select to authenticated
using (app_private.has_branch_permission(branch_id, 'staff.manage'));
create policy feature_flags_staff_manage on public.feature_flags
for all to authenticated
using (app_private.has_branch_permission(branch_id, 'staff.manage'))
with check (app_private.has_branch_permission(branch_id, 'staff.manage'));

create or replace function app_private.audit_admin_entity_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_row jsonb := coalesce(v_after, v_before);
  v_restaurant_id uuid := nullif(v_row ->> 'restaurant_id', '')::uuid;
  v_branch_id uuid := nullif(v_row ->> 'branch_id', '')::uuid;
  v_entity_id uuid := nullif(v_row ->> 'id', '')::uuid;
  v_version integer := coalesce(nullif(v_row ->> 'version', '')::integer, 1);
  v_action text := tg_table_name || '.' || lower(tg_op);
begin
  if auth.uid() is null then return new; end if;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), v_action, tg_table_name, v_entity_id, 'Authorized Admin command', v_before - 'updated_by', v_after - 'updated_by', gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, v_action, tg_table_name, v_entity_id, v_version, jsonb_build_object('entityId', v_entity_id, 'version', v_version, 'operation', tg_op));
  return new;
end;
$$;

revoke all on function app_private.audit_admin_entity_change() from public, anon, authenticated;

create trigger menu_category_admin_audit after insert or update on public.menu_categories for each row execute function app_private.audit_admin_entity_change();
create trigger menu_item_admin_audit after insert or update of name, description, base_price_minor, visible, tax_eligible, service_eligible, station_key on public.menu_items for each row execute function app_private.audit_admin_entity_change();
create trigger restaurant_table_admin_audit after insert or update on public.restaurant_tables for each row execute function app_private.audit_admin_entity_change();
create trigger staff_membership_admin_audit after insert or update on public.staff_memberships for each row execute function app_private.audit_admin_entity_change();
create trigger kitchen_station_admin_audit after insert or update on public.kitchen_stations for each row execute function app_private.audit_admin_entity_change();
create trigger feature_flag_admin_audit after insert or update on public.feature_flags for each row execute function app_private.audit_admin_entity_change();

create or replace function public.rotate_table_entry_qr(p_table_id uuid, p_token_hash text)
returns table(table_id uuid, token_version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_next_version integer;
begin
  if length(p_token_hash) <> 64 then raise exception 'QR token hash is invalid.' using errcode = '22023'; end if;
  select t.restaurant_id, t.branch_id into v_restaurant_id, v_branch_id
  from public.restaurant_tables t where t.id = p_table_id and t.active for update;
  if not found then raise exception 'Active table not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'table.manage') then
    raise exception 'The staff identity cannot rotate this table QR.' using errcode = '42501';
  end if;
  select coalesce(max(q.token_version), 0) + 1 into v_next_version from public.table_qr_tokens q where q.table_id = p_table_id;
  update public.table_qr_tokens q set active = false, revoked_at = now() where q.table_id = p_table_id and q.active;
  insert into public.table_qr_tokens (restaurant_id, branch_id, table_id, token_hash, token_version, active)
  values (v_restaurant_id, v_branch_id, p_table_id, p_token_hash, v_next_version, true);
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), 'table.qr_rotated', 'restaurant_table', p_table_id, 'Authorized QR rotation', null, jsonb_build_object('tokenVersion', v_next_version), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'table.qr_rotated', 'restaurant_table', p_table_id, v_next_version, jsonb_build_object('tableId', p_table_id, 'tokenVersion', v_next_version));
  return query select p_table_id, v_next_version;
end;
$$;

revoke all on function public.rotate_table_entry_qr(uuid, text) from public, anon, authenticated;
grant execute on function public.rotate_table_entry_qr(uuid, text) to authenticated;

create or replace function public.set_menu_item_availability(
  p_menu_item_id uuid,
  p_expected_version integer,
  p_available boolean
)
returns table(version integer, available boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_branch_id uuid;
begin
  select mi.branch_id into v_branch_id
  from public.menu_items mi
  where mi.id = p_menu_item_id;
  if not found then raise exception 'Menu item not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'menu.manage') then
    raise exception 'The staff identity cannot manage this menu item.' using errcode = '42501';
  end if;

  return query
  update public.menu_items mi
  set available = p_available, version = mi.version + 1
  where mi.id = p_menu_item_id and mi.version = p_expected_version
  returning mi.version, mi.available;
  if not found then raise exception 'The menu item changed. Refresh before updating.' using errcode = 'P0003'; end if;
end;
$$;

revoke all on function public.set_menu_item_availability(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.set_menu_item_availability(uuid, integer, boolean) to authenticated;

create or replace function public.execute_admin_command(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_type text := p_command ->> 'type';
  v_capability text;
  v_id uuid;
  v_version integer;
  v_count integer;
  v_target_user_id uuid;
  v_role_key text;
begin
  if auth.uid() is null then raise exception 'Staff sign-in is required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.branches b where b.id = p_branch_id and b.restaurant_id = p_restaurant_id) then
    raise exception 'Branch scope is invalid.' using errcode = '22023';
  end if;

  v_capability := case
    when v_type in ('menu_category.create', 'menu_item.create', 'menu_item.update', 'station.upsert') then 'menu.manage'
    when v_type in ('table.create', 'table.update') then 'table.manage'
    when v_type in ('membership.update', 'feature_flag.set') then 'staff.manage'
    else null
  end;
  if v_capability is null then raise exception 'Admin command type is invalid.' using errcode = '22023'; end if;
  if not app_private.has_branch_permission(p_branch_id, v_capability) then
    raise exception 'The staff identity cannot perform this Admin command.' using errcode = '42501';
  end if;

  if v_type = 'menu_category.create' then
    v_id := (p_command ->> 'id')::uuid;
    insert into public.menu_categories (id, restaurant_id, branch_id, name, description, visible)
    values (v_id, p_restaurant_id, p_branch_id, p_command ->> 'name', nullif(p_command ->> 'description', ''), true)
    returning version into v_version;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_item.create' then
    v_id := (p_command ->> 'id')::uuid;
    insert into public.menu_items (id, restaurant_id, branch_id, category_id, name, description, base_price_minor, currency, station_key, visible, available)
    values (v_id, p_restaurant_id, p_branch_id, (p_command ->> 'categoryId')::uuid, p_command ->> 'name', nullif(p_command ->> 'description', ''), (p_command ->> 'basePriceMinor')::bigint, p_command ->> 'currency', nullif(p_command ->> 'stationKey', ''), true, true)
    returning version into v_version;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_item.update' then
    v_id := (p_command ->> 'menuItemId')::uuid;
    update public.menu_items mi set
      name = p_command ->> 'name',
      description = nullif(p_command ->> 'description', ''),
      base_price_minor = (p_command ->> 'basePriceMinor')::bigint,
      station_key = nullif(p_command ->> 'stationKey', ''),
      visible = (p_command ->> 'visible')::boolean,
      version = mi.version + 1
    where mi.id = v_id and mi.restaurant_id = p_restaurant_id and mi.branch_id = p_branch_id and mi.version = (p_command ->> 'expectedVersion')::integer
    returning mi.version into v_version;
    if not found then raise exception 'The menu item changed. Refresh before saving.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'table.create' then
    v_id := (p_command ->> 'id')::uuid;
    insert into public.restaurant_tables (id, restaurant_id, branch_id, label, area, capacity, active)
    values (v_id, p_restaurant_id, p_branch_id, p_command ->> 'label', nullif(p_command ->> 'area', ''), (p_command ->> 'capacity')::smallint, true)
    returning version into v_version;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'table.update' then
    v_id := (p_command ->> 'tableId')::uuid;
    update public.restaurant_tables rt set
      label = p_command ->> 'label',
      area = nullif(p_command ->> 'area', ''),
      capacity = (p_command ->> 'capacity')::smallint,
      active = (p_command ->> 'active')::boolean,
      version = rt.version + 1,
      updated_at = now()
    where rt.id = v_id and rt.restaurant_id = p_restaurant_id and rt.branch_id = p_branch_id and rt.version = (p_command ->> 'expectedVersion')::integer
    returning rt.version into v_version;
    if not found then raise exception 'The table changed. Refresh before saving.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'membership.update' then
    v_id := (p_command ->> 'membershipId')::uuid;
    select sm.user_id into v_target_user_id from public.staff_memberships sm
    where sm.id = v_id and sm.restaurant_id = p_restaurant_id and sm.branch_id = p_branch_id;
    if not found then raise exception 'Staff membership not found.' using errcode = 'P0002'; end if;
    if v_target_user_id = auth.uid() then raise exception 'A second authorized manager must change your membership.' using errcode = 'P0001'; end if;
    select r.role_key into v_role_key from public.roles r where r.id = (p_command ->> 'roleId')::uuid;
    if not found or v_role_key in ('PLATFORM', 'OWNER') then raise exception 'The selected branch role is invalid.' using errcode = '42501'; end if;
    update public.staff_memberships sm set
      role_id = (p_command ->> 'roleId')::uuid,
      status = (p_command ->> 'status')::public.staff_membership_status,
      version = sm.version + 1,
      updated_at = now()
    where sm.id = v_id and sm.version = (p_command ->> 'expectedVersion')::integer
    returning sm.version into v_version;
    if not found then raise exception 'The staff membership changed. Refresh before saving.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'station.upsert' then
    if nullif(p_command ->> 'stationId', '') is not null then
      v_id := (p_command ->> 'stationId')::uuid;
      update public.kitchen_stations ks set
        station_key = p_command ->> 'stationKey',
        name = p_command ->> 'name',
        active = (p_command ->> 'active')::boolean,
        version = ks.version + 1
      where ks.id = v_id and ks.restaurant_id = p_restaurant_id and ks.branch_id = p_branch_id and ks.version = (p_command ->> 'expectedVersion')::integer
      returning ks.version into v_version;
      if not found then raise exception 'The kitchen station changed. Refresh before saving.' using errcode = 'P0003'; end if;
    else
      v_id := (p_command ->> 'id')::uuid;
      insert into public.kitchen_stations (id, restaurant_id, branch_id, station_key, name, active)
      values (v_id, p_restaurant_id, p_branch_id, p_command ->> 'stationKey', p_command ->> 'name', (p_command ->> 'active')::boolean)
      returning version into v_version;
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'feature_flag.set' then
    update public.feature_flags ff set
      enabled = (p_command ->> 'enabled')::boolean,
      description = nullif(p_command ->> 'description', ''),
      version = ff.version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where ff.restaurant_id = p_restaurant_id and ff.branch_id = p_branch_id and ff.flag_key = p_command ->> 'flagKey'
      and ff.version = coalesce((p_command ->> 'expectedVersion')::integer, -1)
    returning ff.id, ff.version into v_id, v_version;
    get diagnostics v_count = row_count;
    if v_count = 0 then
      if exists (select 1 from public.feature_flags ff where ff.branch_id = p_branch_id and ff.flag_key = p_command ->> 'flagKey') then
        raise exception 'The feature flag changed. Refresh before saving.' using errcode = 'P0003';
      end if;
      v_id := (p_command ->> 'id')::uuid;
      insert into public.feature_flags (id, restaurant_id, branch_id, flag_key, enabled, description, updated_by)
      values (v_id, p_restaurant_id, p_branch_id, p_command ->> 'flagKey', (p_command ->> 'enabled')::boolean, nullif(p_command ->> 'description', ''), auth.uid())
      returning version into v_version;
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  raise exception 'Admin command was not executed.' using errcode = 'P0001';
end;
$$;

revoke all on function public.execute_admin_command(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.execute_admin_command(uuid, uuid, jsonb) to authenticated;

-- Browser identities may read authorized configuration but every mutation must
-- pass through a versioned, capability-checked command function.
revoke insert, update, delete on public.menu_categories, public.menu_items, public.restaurant_tables, public.staff_memberships, public.kitchen_stations, public.feature_flags from authenticated;

grant select, insert, update on public.feature_flags to service_role;
grant select on public.roles, public.permissions, public.role_permissions, public.audit_logs to service_role;

commit;
