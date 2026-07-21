create unique index orders_branch_idempotency_key on public.orders(branch_id, idempotency_key);

create or replace function public.submit_customer_order(
  p_session_id uuid,
  p_items jsonb,
  p_expected_session_version integer,
  p_idempotency_key uuid
)
returns table(order_id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_session_version integer;
  v_branch_currency char(3);
  v_item_currency char(3);
  v_subtotal_minor bigint := 0;
  v_display_number integer;
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_menu_item_id uuid;
  v_name text;
  v_station_key text;
  v_price_minor bigint;
  v_quantity integer;
begin
  if not app_private.has_session_grant(p_session_id) then
    raise exception 'A live customer Session grant is required.' using errcode = '42501';
  end if;

  select s.restaurant_id, s.branch_id, s.version, s.currency
    into v_restaurant_id, v_branch_id, v_session_version, v_branch_currency
  from public.dining_sessions s
  where s.id = p_session_id
    and s.state = 'OPEN'
  for update;
  if not found then
    raise exception 'This Session is no longer accepting customer orders.' using errcode = 'P0002';
  end if;
  if v_session_version <> p_expected_session_version then
    raise exception 'The Session changed. Refresh before submitting.' using errcode = 'P0003';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_menu_item_id := (v_item ->> 'menuItemId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'Order quantity is outside the allowed range.' using errcode = '22023';
    end if;
    if jsonb_array_length(coalesce(v_item -> 'modifierOptionIds', '[]'::jsonb)) > 0 then
      raise exception 'Modifier pricing is not enabled in this local slice.' using errcode = '22023';
    end if;
    select mi.name, mi.station_key, mi.base_price_minor, mi.currency
      into v_name, v_station_key, v_price_minor, v_item_currency
    from public.menu_items mi
    where mi.id = v_menu_item_id
      and mi.restaurant_id = v_restaurant_id
      and mi.branch_id = v_branch_id
      and mi.visible
      and mi.available;
    if not found then
      raise exception 'A menu item is unavailable.' using errcode = 'P0004';
    end if;
    if v_item_currency is distinct from v_branch_currency then
      raise exception 'A menu item currency does not match the branch currency.' using errcode = '22023';
    end if;
    v_subtotal_minor := v_subtotal_minor + (v_price_minor * v_quantity);
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(v_branch_id::text, 0));
  select coalesce(max(o.display_number), 0) + 1
    into v_display_number
  from public.orders o
  where o.branch_id = v_branch_id;

  insert into public.orders (id, restaurant_id, branch_id, session_id, display_number, actor_type, actor_id, subtotal_minor, total_minor, currency, version, idempotency_key)
  values (v_order_id, v_restaurant_id, v_branch_id, p_session_id, v_display_number, 'CUSTOMER', v_actor_id, v_subtotal_minor, v_subtotal_minor, v_branch_currency, 1, p_idempotency_key);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_menu_item_id := (v_item ->> 'menuItemId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    select mi.name, mi.station_key, mi.base_price_minor
      into v_name, v_station_key, v_price_minor
    from public.menu_items mi
    where mi.id = v_menu_item_id
      and mi.restaurant_id = v_restaurant_id
      and mi.branch_id = v_branch_id;
    insert into public.order_items (restaurant_id, branch_id, order_id, menu_item_id, name_snapshot, variant_snapshot, modifier_snapshot, unit_price_minor, quantity, note, station_key)
    values (v_restaurant_id, v_branch_id, v_order_id, v_menu_item_id, v_name, null, coalesce(v_item -> 'modifierOptionIds', '[]'::jsonb), v_price_minor, v_quantity, nullif(btrim(v_item ->> 'note'), ''), v_station_key);
  end loop;

  update public.dining_sessions as ds
  set version = ds.version + 1
  where ds.id = p_session_id;

  return query select v_order_id, 1;
end;
$$;

revoke all on function public.submit_customer_order(uuid, jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.submit_customer_order(uuid, jsonb, integer, uuid) to authenticated;
