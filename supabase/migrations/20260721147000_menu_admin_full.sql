begin;

alter table public.menu_items
  add column if not exists sort_order integer not null default 0,
  add column if not exists image_path text,
  add column if not exists image_alt text check (image_alt is null or length(trim(image_alt)) between 1 and 180),
  add column if not exists featured boolean not null default false,
  add column if not exists spice_level smallint not null default 0 check (spice_level between 0 and 3),
  add column if not exists operating_rules jsonb not null default '{}'::jsonb;

alter table public.menu_item_variants add column if not exists version integer not null default 1 check (version > 0);
alter table public.modifier_groups add column if not exists version integer not null default 1 check (version > 0);
alter table public.modifier_options add column if not exists version integer not null default 1 check (version > 0);
alter table public.modifier_groups add constraint modifier_required_minimum check (not required or min_selections > 0);

create index menu_items_public_sort_idx on public.menu_items (branch_id, visible, category_id, sort_order, name);
create index menu_variants_admin_idx on public.menu_item_variants (branch_id, menu_item_id, sort_order, active);
create index modifier_groups_admin_idx on public.modifier_groups (branch_id, active, name);
create index modifier_options_admin_idx on public.modifier_options (branch_id, group_id, sort_order, active);

create or replace function app_private.menu_item_within_operating_window(p_menu_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rules jsonb;
  v_timezone text;
  v_from text;
  v_until text;
  v_now text;
begin
  select mi.operating_rules, b.timezone into v_rules, v_timezone
  from public.menu_items mi join public.branches b on b.id = mi.branch_id
  where mi.id = p_menu_item_id;
  if not found then return false; end if;
  v_from := v_rules ->> 'availableFrom';
  v_until := v_rules ->> 'availableUntil';
  if v_from is null or v_until is null or v_from = v_until then return true; end if;
  if v_from !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_until !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
  v_now := to_char(now() at time zone v_timezone, 'HH24:MI');
  return case when v_from < v_until then v_now >= v_from and v_now < v_until else v_now >= v_from or v_now < v_until end;
end;
$$;

create or replace function app_private.enforce_order_item_operating_window()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.menu_item_id is not null and not app_private.menu_item_within_operating_window(new.menu_item_id) then
    raise exception 'A menu item is unavailable.' using errcode = 'P0004';
  end if;
  return new;
end;
$$;

revoke all on function app_private.menu_item_within_operating_window(uuid) from public, anon, authenticated;
revoke all on function app_private.enforce_order_item_operating_window() from public, anon, authenticated;
create trigger order_item_operating_window before insert on public.order_items for each row execute function app_private.enforce_order_item_operating_window();

drop trigger menu_item_admin_audit on public.menu_items;
create trigger menu_item_admin_insert_audit after insert on public.menu_items for each row execute function app_private.audit_admin_entity_change();
create trigger menu_item_admin_update_audit after update of name, description, base_price_minor, visible, tax_eligible, service_eligible, station_key, sort_order, image_path, image_alt, featured, spice_level, operating_rules on public.menu_items for each row execute function app_private.audit_admin_entity_change();
create trigger menu_variant_admin_audit after insert or update on public.menu_item_variants for each row execute function app_private.audit_admin_entity_change();
create trigger modifier_group_admin_audit after insert or update on public.modifier_groups for each row execute function app_private.audit_admin_entity_change();
create trigger modifier_option_admin_audit after insert or update on public.modifier_options for each row execute function app_private.audit_admin_entity_change();

create or replace function public.execute_menu_structure_command(
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
  v_id uuid;
  v_version integer;
  v_menu_item_id uuid;
  v_group_id uuid;
  v_enabled boolean;
  v_image_path text;
begin
  if auth.uid() is null or not app_private.has_branch_permission(p_branch_id, 'menu.manage') then
    raise exception 'Menu management permission is required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches b where b.id = p_branch_id and b.restaurant_id = p_restaurant_id) then
    raise exception 'Branch scope is invalid.' using errcode = '22023';
  end if;

  if v_type = 'menu_category.update' then
    v_id := (p_command ->> 'categoryId')::uuid;
    update public.menu_categories mc set
      name = p_command ->> 'name',
      description = nullif(p_command ->> 'description', ''),
      sort_order = (p_command ->> 'sortOrder')::integer,
      visible = (p_command ->> 'visible')::boolean,
      version = mc.version + 1
    where mc.id = v_id and mc.restaurant_id = p_restaurant_id and mc.branch_id = p_branch_id and mc.version = (p_command ->> 'expectedVersion')::integer
    returning mc.version into v_version;
    if not found then raise exception 'The category changed. Refresh before saving.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_item.configuration.update' then
    v_id := (p_command ->> 'menuItemId')::uuid;
    update public.menu_items mi set
      name = p_command ->> 'name',
      description = nullif(p_command ->> 'description', ''),
      base_price_minor = (p_command ->> 'basePriceMinor')::bigint,
      station_key = nullif(p_command ->> 'stationKey', ''),
      visible = (p_command ->> 'visible')::boolean,
      sort_order = (p_command ->> 'sortOrder')::integer,
      featured = (p_command ->> 'featured')::boolean,
      spice_level = (p_command ->> 'spiceLevel')::smallint,
      tax_eligible = (p_command ->> 'taxEligible')::boolean,
      service_eligible = (p_command ->> 'serviceEligible')::boolean,
      operating_rules = coalesce(p_command -> 'operatingRules', '{}'::jsonb),
      version = mi.version + 1
    where mi.id = v_id and mi.restaurant_id = p_restaurant_id and mi.branch_id = p_branch_id and mi.version = (p_command ->> 'expectedVersion')::integer
    returning mi.version into v_version;
    if not found then raise exception 'The menu item changed. Refresh before saving.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_item.image.set' then
    v_id := (p_command ->> 'menuItemId')::uuid;
    v_image_path := p_command ->> 'imagePath';
    if position('..' in v_image_path) > 0 or v_image_path not like p_restaurant_id::text || '/' || p_branch_id::text || '/' || v_id::text || '/%' then
      raise exception 'The image path is outside the menu item scope.' using errcode = '22023';
    end if;
    update public.menu_items mi set image_path = v_image_path, image_alt = p_command ->> 'imageAlt', version = mi.version + 1
    where mi.id = v_id and mi.restaurant_id = p_restaurant_id and mi.branch_id = p_branch_id and mi.version = (p_command ->> 'expectedVersion')::integer
    returning mi.version into v_version;
    if not found then raise exception 'The menu item changed. Refresh before attaching the image.' using errcode = 'P0003'; end if;
    return jsonb_build_object('id', v_id, 'version', v_version, 'imagePath', v_image_path);
  elsif v_type = 'menu_variant.upsert' then
    if nullif(p_command ->> 'variantId', '') is null then
      v_id := (p_command ->> 'id')::uuid;
      insert into public.menu_item_variants (id, restaurant_id, branch_id, menu_item_id, name, price_delta_minor, active, sort_order)
      values (v_id, p_restaurant_id, p_branch_id, (p_command ->> 'menuItemId')::uuid, p_command ->> 'name', (p_command ->> 'priceDeltaMinor')::bigint, (p_command ->> 'active')::boolean, (p_command ->> 'sortOrder')::integer)
      returning version into v_version;
    else
      v_id := (p_command ->> 'variantId')::uuid;
      update public.menu_item_variants mv set name = p_command ->> 'name', price_delta_minor = (p_command ->> 'priceDeltaMinor')::bigint, active = (p_command ->> 'active')::boolean, sort_order = (p_command ->> 'sortOrder')::integer, version = mv.version + 1
      where mv.id = v_id and mv.restaurant_id = p_restaurant_id and mv.branch_id = p_branch_id and mv.version = (p_command ->> 'expectedVersion')::integer
      returning mv.version into v_version;
      if not found then raise exception 'The variant changed. Refresh before saving.' using errcode = 'P0003'; end if;
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_modifier_group.upsert' then
    if nullif(p_command ->> 'groupId', '') is null then
      v_id := (p_command ->> 'id')::uuid;
      insert into public.modifier_groups (id, restaurant_id, branch_id, name, required, min_selections, max_selections, active)
      values (v_id, p_restaurant_id, p_branch_id, p_command ->> 'name', (p_command ->> 'required')::boolean, (p_command ->> 'minSelections')::smallint, (p_command ->> 'maxSelections')::smallint, (p_command ->> 'active')::boolean)
      returning version into v_version;
    else
      v_id := (p_command ->> 'groupId')::uuid;
      update public.modifier_groups mg set name = p_command ->> 'name', required = (p_command ->> 'required')::boolean, min_selections = (p_command ->> 'minSelections')::smallint, max_selections = (p_command ->> 'maxSelections')::smallint, active = (p_command ->> 'active')::boolean, version = mg.version + 1
      where mg.id = v_id and mg.restaurant_id = p_restaurant_id and mg.branch_id = p_branch_id and mg.version = (p_command ->> 'expectedVersion')::integer
      returning mg.version into v_version;
      if not found then raise exception 'The modifier group changed. Refresh before saving.' using errcode = 'P0003'; end if;
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_modifier_option.upsert' then
    if nullif(p_command ->> 'optionId', '') is null then
      v_id := (p_command ->> 'id')::uuid;
      insert into public.modifier_options (id, restaurant_id, branch_id, group_id, name, price_delta_minor, active, sort_order)
      values (v_id, p_restaurant_id, p_branch_id, (p_command ->> 'groupId')::uuid, p_command ->> 'name', (p_command ->> 'priceDeltaMinor')::bigint, (p_command ->> 'active')::boolean, (p_command ->> 'sortOrder')::integer)
      returning version into v_version;
    else
      v_id := (p_command ->> 'optionId')::uuid;
      update public.modifier_options mo set name = p_command ->> 'name', price_delta_minor = (p_command ->> 'priceDeltaMinor')::bigint, active = (p_command ->> 'active')::boolean, sort_order = (p_command ->> 'sortOrder')::integer, version = mo.version + 1
      where mo.id = v_id and mo.restaurant_id = p_restaurant_id and mo.branch_id = p_branch_id and mo.group_id = (p_command ->> 'groupId')::uuid and mo.version = (p_command ->> 'expectedVersion')::integer
      returning mo.version into v_version;
      if not found then raise exception 'The modifier option changed. Refresh before saving.' using errcode = 'P0003'; end if;
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version);
  elsif v_type = 'menu_modifier_link.set' then
    v_menu_item_id := (p_command ->> 'menuItemId')::uuid;
    v_group_id := (p_command ->> 'groupId')::uuid;
    v_enabled := (p_command ->> 'enabled')::boolean;
    if not exists (select 1 from public.menu_items mi where mi.id = v_menu_item_id and mi.restaurant_id = p_restaurant_id and mi.branch_id = p_branch_id)
      or not exists (select 1 from public.modifier_groups mg where mg.id = v_group_id and mg.restaurant_id = p_restaurant_id and mg.branch_id = p_branch_id) then
      raise exception 'The menu item or modifier group is outside this branch.' using errcode = '22023';
    end if;
    update public.menu_items mi set version = mi.version + 1
    where mi.id = v_menu_item_id and mi.version = (p_command ->> 'expectedMenuItemVersion')::integer
    returning mi.version into v_version;
    if not found then raise exception 'The menu item changed. Refresh before linking modifiers.' using errcode = 'P0003'; end if;
    if v_enabled then
      insert into public.menu_item_modifier_groups (restaurant_id, branch_id, menu_item_id, group_id, sort_order)
      values (p_restaurant_id, p_branch_id, v_menu_item_id, v_group_id, (p_command ->> 'sortOrder')::integer)
      on conflict (menu_item_id, group_id) do update set sort_order = excluded.sort_order;
    else
      delete from public.menu_item_modifier_groups where menu_item_id = v_menu_item_id and group_id = v_group_id and branch_id = p_branch_id;
    end if;
    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_type, action, entity_type, entity_id, reason, after_masked, correlation_id)
    values (p_restaurant_id, p_branch_id, auth.uid(), 'STAFF', 'menu_modifier_link.set', 'menu_item', v_menu_item_id, 'Authorized menu structure command', jsonb_build_object('groupId', v_group_id, 'enabled', v_enabled), gen_random_uuid());
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (p_restaurant_id, p_branch_id, 'menu_modifier_link.set', 'menu_item', v_menu_item_id, v_version, jsonb_build_object('groupId', v_group_id, 'enabled', v_enabled, 'version', v_version));
    return jsonb_build_object('id', v_menu_item_id, 'groupId', v_group_id, 'enabled', v_enabled, 'version', v_version);
  end if;

  raise exception 'Menu structure command type is invalid.' using errcode = '22023';
end;
$$;

revoke all on function public.execute_menu_structure_command(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.execute_menu_structure_command(uuid, uuid, jsonb) to authenticated;

revoke insert, update, delete on public.menu_item_variants, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups from authenticated;
grant select, insert, update, delete on public.menu_item_variants, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['menu_categories', 'menu_item_variants', 'modifier_groups', 'modifier_options', 'menu_item_modifier_groups'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
alter table public.menu_categories replica identity full;
alter table public.menu_item_variants replica identity full;
alter table public.modifier_groups replica identity full;
alter table public.modifier_options replica identity full;
alter table public.menu_item_modifier_groups replica identity full;

commit;
