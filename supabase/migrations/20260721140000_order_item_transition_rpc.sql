begin;

-- Kitchen/serving transitions are commands, not arbitrary table updates. The
-- RPC re-authorizes the exact target state, serializes on the row, enforces the
-- state graph/version and emits audit/outbox facts in the same transaction.
create or replace function public.transition_order_item(
  p_order_item_id uuid,
  p_next_state public.order_state,
  p_expected_version integer,
  p_reason text default null
)
returns table(version integer, state public.order_state)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_current_state public.order_state;
  v_current_version integer;
  v_next_version integer;
begin
  select oi.restaurant_id, oi.branch_id, oi.state, oi.version
    into v_restaurant_id, v_branch_id, v_current_state, v_current_version
  from public.order_items oi
  where oi.id = p_order_item_id
  for update;

  if not found then
    raise exception 'Kitchen item not found.' using errcode = 'P0002';
  end if;
  if v_current_version <> p_expected_version then
    raise exception 'This kitchen item changed. Refresh the queue.' using errcode = 'P0003';
  end if;

  if not (
    (v_current_state = 'SUBMITTED' and p_next_state in ('ACCEPTED', 'REJECTED', 'CANCELLED'))
    or (v_current_state = 'ACCEPTED' and p_next_state in ('PREPARING', 'CANCELLED'))
    or (v_current_state = 'PREPARING' and p_next_state in ('READY', 'CANCELLED'))
    or (v_current_state = 'READY' and p_next_state = 'SERVED')
  ) then
    raise exception 'This kitchen transition is not allowed.' using errcode = 'P0004';
  end if;

  if p_next_state in ('REJECTED', 'CANCELLED') and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A rejection or cancellation reason is required.' using errcode = '22023';
  end if;

  if p_next_state in ('ACCEPTED', 'REJECTED')
    and not app_private.has_branch_permission(v_branch_id, 'order.accept') then
    raise exception 'The staff identity cannot accept or reject this item.' using errcode = '42501';
  elsif p_next_state in ('PREPARING', 'READY')
    and not app_private.has_branch_permission(v_branch_id, 'order.prepare') then
    raise exception 'The staff identity cannot prepare this item.' using errcode = '42501';
  elsif p_next_state = 'SERVED'
    and not app_private.has_branch_permission(v_branch_id, 'order.serve') then
    raise exception 'The staff identity cannot serve this item.' using errcode = '42501';
  elsif p_next_state = 'CANCELLED' and (
    not app_private.has_branch_permission(v_branch_id, 'order.accept')
    or (v_current_state = 'PREPARING' and not app_private.has_branch_permission(v_branch_id, 'order.serve'))
  ) then
    raise exception 'The staff identity cannot cancel this item.' using errcode = '42501';
  end if;

  v_next_version := v_current_version + 1;
  update public.order_items oi
  set state = p_next_state, version = v_next_version
  where oi.id = p_order_item_id;

  insert into public.audit_logs (
    restaurant_id, branch_id, actor_id, action, entity_type, entity_id,
    reason, before_masked, after_masked, correlation_id
  ) values (
    v_restaurant_id, v_branch_id, auth.uid(), 'order_item.transitioned',
    'order_item', p_order_item_id, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('state', v_current_state, 'version', v_current_version),
    jsonb_build_object('state', p_next_state, 'version', v_next_version),
    gen_random_uuid()
  );

  insert into public.outbox_events (
    restaurant_id, branch_id, event_type, entity_type, entity_id,
    entity_version, payload
  ) values (
    v_restaurant_id, v_branch_id, 'order_item.transitioned', 'order_item',
    p_order_item_id, v_next_version,
    jsonb_build_object('orderItemId', p_order_item_id, 'state', p_next_state, 'version', v_next_version)
  );

  return query select v_next_version, p_next_state;
end;
$$;

revoke all on function public.transition_order_item(uuid, public.order_state, integer, text) from public, anon, authenticated;
grant execute on function public.transition_order_item(uuid, public.order_state, integer, text) to authenticated;

-- All application order writes already use transactional RPCs. Removing raw
-- browser DML closes a direct Data API path around state/version checks.
revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

commit;
