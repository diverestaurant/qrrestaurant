begin;

create or replace function public.rotate_session_join_code(
  p_session_id uuid,
  p_expected_session_version integer,
  p_code_hash text,
  p_expires_at timestamptz
)
returns table(session_id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_version integer;
begin
  if length(p_code_hash) <> 64 or p_expires_at <= now() or p_expires_at > now() + interval '4 hours' then
    raise exception 'Join Code rotation input is invalid.' using errcode = '22023';
  end if;

  select s.restaurant_id, s.branch_id, s.state, s.version
    into v_restaurant_id, v_branch_id, v_state, v_version
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'session.rotate_join_code') then
    raise exception 'The staff identity cannot rotate this Join Code.' using errcode = '42501';
  end if;
  if v_state <> 'OPEN' then raise exception 'Only an open Session can rotate its Join Code.' using errcode = 'P0004'; end if;
  if v_version <> p_expected_session_version then
    raise exception 'The Session changed. Refresh before rotating its Join Code.' using errcode = 'P0003';
  end if;

  update public.session_join_codes as sjc
  set revoked_at = now()
  where sjc.session_id = p_session_id and sjc.revoked_at is null;
  insert into public.session_join_codes (session_id, code_hash, expires_at)
  values (p_session_id, p_code_hash, p_expires_at);
  update public.dining_sessions as ds set version = ds.version + 1 where ds.id = p_session_id;

  insert into public.audit_logs (restaurant_id, branch_id, actor_id, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), 'session.join_code_rotated', 'dining_session', p_session_id, 'Authorized staff rotation', jsonb_build_object('version', v_version), jsonb_build_object('version', v_version + 1, 'expiresAt', p_expires_at), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'session.join_code_rotated', 'dining_session', p_session_id, v_version + 1, jsonb_build_object('sessionId', p_session_id, 'version', v_version + 1));

  return query select p_session_id, v_version + 1;
end;
$$;

revoke all on function public.rotate_session_join_code(uuid, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.rotate_session_join_code(uuid, integer, text, timestamptz) to authenticated;

-- One private pricing/snapshot implementation serves both customer and
-- staff-assisted order commands. Public wrappers perform actor-specific
-- authorization before entering this non-exposed function.
create or replace function app_private.commit_order(
  p_session_id uuid,
  p_items jsonb,
  p_expected_session_version integer,
  p_idempotency_key uuid,
  p_actor_type text,
  p_actor_id uuid
)
returns table(order_id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_session_version integer;
  v_branch_currency char(3);
  v_item_currency char(3);
  v_subtotal_minor bigint := 0;
  v_display_number integer;
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_resolved_item jsonb;
  v_resolved_items jsonb := '[]'::jsonb;
  v_menu_item_id uuid;
  v_variant_id uuid;
  v_name text;
  v_variant_name text;
  v_station_key text;
  v_price_minor bigint;
  v_variant_delta_minor bigint;
  v_modifier_delta_minor bigint;
  v_unit_price_minor bigint;
  v_quantity integer;
  v_modifier_ids jsonb;
  v_modifier_option_ids uuid[];
  v_group record;
  v_selected_count integer;
  v_option_count integer;
  v_variant_snapshot jsonb;
  v_modifier_snapshot jsonb;
begin
  if p_actor_type not in ('CUSTOMER', 'WAITER') or p_actor_id is null then
    raise exception 'Order actor is invalid.' using errcode = '22023';
  end if;
  select s.restaurant_id, s.branch_id, s.version, s.currency
    into v_restaurant_id, v_branch_id, v_session_version, v_branch_currency
  from public.dining_sessions s
  where s.id = p_session_id and s.state = 'OPEN'
  for update;
  if not found then raise exception 'This Session is no longer accepting orders.' using errcode = 'P0002'; end if;
  if v_session_version <> p_expected_session_version then
    raise exception 'The Session changed. Refresh before submitting.' using errcode = 'P0003';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'At least one order item is required.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Order items must be objects.' using errcode = '22023'; end if;
    v_menu_item_id := nullif(v_item ->> 'menuItemId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_menu_item_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 20 then
      raise exception 'Order quantity or menu item is outside the allowed range.' using errcode = '22023';
    end if;
    v_modifier_ids := coalesce(v_item -> 'modifierOptionIds', '[]'::jsonb);
    if jsonb_typeof(v_modifier_ids) <> 'array' or jsonb_array_length(v_modifier_ids) > 20 then
      raise exception 'Modifier selections are outside the allowed range.' using errcode = '22023';
    end if;
    v_modifier_option_ids := array(select value::uuid from jsonb_array_elements_text(v_modifier_ids));
    if cardinality(v_modifier_option_ids) <> (select count(distinct option_id) from unnest(v_modifier_option_ids) as distinct_options(option_id)) then
      raise exception 'A modifier option cannot be selected more than once.' using errcode = '22023';
    end if;

    select mi.name, mi.station_key, mi.base_price_minor, mi.currency
      into v_name, v_station_key, v_price_minor, v_item_currency
    from public.menu_items mi
    where mi.id = v_menu_item_id and mi.restaurant_id = v_restaurant_id and mi.branch_id = v_branch_id and mi.visible and mi.available;
    if not found then raise exception 'A menu item is unavailable.' using errcode = 'P0004'; end if;
    if v_item_currency is distinct from v_branch_currency then raise exception 'A menu item currency does not match the branch currency.' using errcode = '22023'; end if;

    v_variant_delta_minor := 0;
    v_variant_snapshot := null;
    if v_variant_id is not null then
      select v.name, v.price_delta_minor into v_variant_name, v_variant_delta_minor
      from public.menu_item_variants v
      where v.id = v_variant_id and v.menu_item_id = v_menu_item_id and v.restaurant_id = v_restaurant_id and v.branch_id = v_branch_id and v.active;
      if not found then raise exception 'The selected menu variant is unavailable.' using errcode = 'P0004'; end if;
      v_variant_snapshot := jsonb_build_object('id', v_variant_id, 'name', v_variant_name, 'priceDeltaMinor', v_variant_delta_minor);
    end if;

    select count(distinct mo.id), coalesce(sum(mo.price_delta_minor), 0)
      into v_option_count, v_modifier_delta_minor
    from unnest(v_modifier_option_ids) selected(option_id)
    join public.modifier_options mo on mo.id = selected.option_id and mo.restaurant_id = v_restaurant_id and mo.branch_id = v_branch_id and mo.active
    join public.menu_item_modifier_groups mig on mig.group_id = mo.group_id and mig.menu_item_id = v_menu_item_id and mig.restaurant_id = v_restaurant_id and mig.branch_id = v_branch_id;
    if v_option_count <> cardinality(v_modifier_option_ids) then raise exception 'A selected modifier is not available for this menu item.' using errcode = '22023'; end if;

    for v_group in
      select mg.id, mg.required, mg.min_selections, mg.max_selections
      from public.menu_item_modifier_groups mig
      join public.modifier_groups mg on mg.id = mig.group_id and mg.restaurant_id = v_restaurant_id and mg.branch_id = v_branch_id and mg.active
      where mig.menu_item_id = v_menu_item_id and mig.restaurant_id = v_restaurant_id and mig.branch_id = v_branch_id
    loop
      select count(*) into v_selected_count
      from unnest(v_modifier_option_ids) selected(option_id)
      join public.modifier_options mo on mo.id = selected.option_id
      where mo.group_id = v_group.id;
      if v_selected_count < v_group.min_selections or v_selected_count > v_group.max_selections or (v_group.required and v_selected_count = 0) then
        raise exception 'Modifier selections do not satisfy the menu rules.' using errcode = '22023';
      end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('id', mo.id, 'name', mo.name, 'priceDeltaMinor', mo.price_delta_minor) order by mo.sort_order, mo.id), '[]'::jsonb)
      into v_modifier_snapshot
    from unnest(v_modifier_option_ids) selected(option_id)
    join public.modifier_options mo on mo.id = selected.option_id and mo.restaurant_id = v_restaurant_id and mo.branch_id = v_branch_id;

    v_unit_price_minor := v_price_minor + v_variant_delta_minor + v_modifier_delta_minor;
    if v_unit_price_minor < 0 then raise exception 'The selected menu configuration has an invalid price.' using errcode = '22023'; end if;
    v_subtotal_minor := v_subtotal_minor + (v_unit_price_minor * v_quantity);
    v_resolved_item := jsonb_build_object('menuItemId', v_menu_item_id, 'name', v_name, 'stationKey', v_station_key, 'unitPriceMinor', v_unit_price_minor, 'quantity', v_quantity, 'note', nullif(btrim(v_item ->> 'note'), ''), 'variantSnapshot', v_variant_snapshot, 'modifierSnapshot', v_modifier_snapshot);
    v_resolved_items := v_resolved_items || jsonb_build_array(v_resolved_item);
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(v_branch_id::text, 0));
  select coalesce(max(o.display_number), 0) + 1 into v_display_number from public.orders o where o.branch_id = v_branch_id;
  insert into public.orders (id, restaurant_id, branch_id, session_id, display_number, actor_type, actor_id, subtotal_minor, total_minor, currency, version, idempotency_key)
  values (v_order_id, v_restaurant_id, v_branch_id, p_session_id, v_display_number, p_actor_type, p_actor_id, v_subtotal_minor, v_subtotal_minor, v_branch_currency, 1, p_idempotency_key);

  for v_resolved_item in select value from jsonb_array_elements(v_resolved_items)
  loop
    insert into public.order_items (restaurant_id, branch_id, order_id, menu_item_id, name_snapshot, variant_snapshot, modifier_snapshot, unit_price_minor, quantity, note, station_key)
    values (v_restaurant_id, v_branch_id, v_order_id, (v_resolved_item ->> 'menuItemId')::uuid, v_resolved_item ->> 'name', nullif(v_resolved_item -> 'variantSnapshot', 'null'::jsonb), v_resolved_item -> 'modifierSnapshot', (v_resolved_item ->> 'unitPriceMinor')::bigint, (v_resolved_item ->> 'quantity')::integer, nullif(v_resolved_item ->> 'note', ''), v_resolved_item ->> 'stationKey');
  end loop;
  update public.dining_sessions as ds set version = ds.version + 1 where ds.id = p_session_id;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, action, entity_type, entity_id, reason, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, p_actor_id, case when p_actor_type = 'WAITER' then 'order.staff_submitted' else 'order.customer_submitted' end, 'order', v_order_id, null, jsonb_build_object('displayNumber', v_display_number, 'totalMinor', v_subtotal_minor, 'version', 1), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'order.submitted', 'order', v_order_id, 1, jsonb_build_object('orderId', v_order_id, 'sessionId', p_session_id, 'actorType', p_actor_type, 'version', 1));
  return query select v_order_id, 1;
end;
$$;

revoke all on function app_private.commit_order(uuid, jsonb, integer, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.submit_customer_order(p_session_id uuid, p_items jsonb, p_expected_session_version integer, p_idempotency_key uuid)
returns table(order_id uuid, version integer)
language plpgsql security definer
set search_path = pg_catalog, public, auth, app_private
as $$
begin
  if not app_private.has_session_grant(p_session_id) then raise exception 'A live customer Session grant is required.' using errcode = '42501'; end if;
  return query select * from app_private.commit_order(p_session_id, p_items, p_expected_session_version, p_idempotency_key, 'CUSTOMER', auth.uid());
end;
$$;

create or replace function public.submit_staff_order(p_session_id uuid, p_items jsonb, p_expected_session_version integer, p_idempotency_key uuid)
returns table(order_id uuid, version integer)
language plpgsql security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare v_branch_id uuid;
begin
  select branch_id into v_branch_id from public.dining_sessions where id = p_session_id;
  if v_branch_id is null or not app_private.has_branch_permission(v_branch_id, 'order.submit') then
    raise exception 'The staff identity cannot submit an assisted order.' using errcode = '42501';
  end if;
  return query select * from app_private.commit_order(p_session_id, p_items, p_expected_session_version, p_idempotency_key, 'WAITER', auth.uid());
end;
$$;

revoke all on function public.submit_customer_order(uuid, jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.submit_customer_order(uuid, jsonb, integer, uuid) to authenticated;
revoke all on function public.submit_staff_order(uuid, jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.submit_staff_order(uuid, jsonb, integer, uuid) to authenticated;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key = 'order.submit'
where r.role_key = 'MANAGER'
on conflict do nothing;

-- Server-side repositories and isolated synthetic verification create scoped
-- operational fixtures. Browser roles remain revoked and command/RLS paths are
-- unchanged; service_role privileges are explicit rather than implicit.
grant select, insert, update, delete on public.restaurant_tables, public.session_join_codes, public.orders, public.order_items to service_role;

commit;
