begin;

select plan(15);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009801', 'authenticated', 'authenticated', 'synthetic-kitchen@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009802', 'authenticated', 'authenticated', 'synthetic-waiter@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009803', 'authenticated', 'authenticated', 'synthetic-manager-transition@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009804', 'authenticated', 'authenticated', 'synthetic-transition-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status) values
  ('00000000-0000-4000-8000-000000009811', '00000000-0000-4000-8000-000000009801', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000104', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009812', '00000000-0000-4000-8000-000000009802', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009813', '00000000-0000-4000-8000-000000009803', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

insert into public.orders (id, restaurant_id, branch_id, session_id, display_number, actor_type, state, subtotal_minor, total_minor, currency, idempotency_key)
values ('00000000-0000-4000-8000-000000009820', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000701', 9980, 'WAITER', 'SUBMITTED', 1680, 1680, 'MYR', '00000000-0000-4000-8000-000000009821');
insert into public.order_items (id, restaurant_id, branch_id, order_id, menu_item_id, name_snapshot, unit_price_minor, quantity, station_key, state)
values ('00000000-0000-4000-8000-000000009822', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009820', '00000000-0000-4000-8000-000000000401', 'Nasi Lemak DIVE', 1680, 1, 'wok', 'SUBMITTED');

select ok(has_function_privilege('authenticated', 'public.transition_order_item(uuid, public.order_state, integer, text)', 'EXECUTE'), 'authenticated may call the guarded transition command');
select ok(not has_table_privilege('authenticated', 'public.order_items', 'UPDATE'), 'authenticated cannot bypass the command with raw item updates');
select ok(not has_table_privilege('authenticated', 'public.orders', 'INSERT'), 'authenticated cannot bypass authoritative order submission with raw inserts');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009801', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009801', true);

select is((select state::text from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'ACCEPTED', 1, null)), 'ACCEPTED', 'kitchen can accept a submitted item');
select is((select state::text from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'PREPARING', 2, null)), 'PREPARING', 'kitchen can start preparation');
select throws_ok(
  $$select * from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'CANCELLED', 3, 'Manager decision')$$,
  '42501',
  'The staff identity cannot cancel this item.',
  'kitchen cannot cancel after preparation'
);
select is((select state::text from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'READY', 3, null)), 'READY', 'kitchen can mark a preparing item ready');

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009802', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009802', true);
set local role authenticated;
select is((select state::text from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'SERVED', 4, null)), 'SERVED', 'waiter can mark a ready item served');
select throws_ok(
  $$select * from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'SERVED', 4, null)$$,
  'P0003',
  'This kitchen item changed. Refresh the queue.',
  'stale transitions are rejected'
);

set local role postgres;
update public.order_items set state = 'PREPARING', version = 10 where id = '00000000-0000-4000-8000-000000009822';
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009803', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009803', true);
set local role authenticated;
select is((select state::text from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'CANCELLED', 10, 'Manager approved cancellation')), 'CANCELLED', 'manager can cancel a preparing item with a reason');

set local role postgres;
update public.order_items set state = 'SUBMITTED', version = 20 where id = '00000000-0000-4000-8000-000000009822';
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009804', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009804', true);
set local role authenticated;
select throws_ok(
  $$select * from public.transition_order_item('00000000-0000-4000-8000-000000009822', 'ACCEPTED', 20, null)$$,
  '42501',
  'The staff identity cannot accept or reject this item.',
  'outsider cannot transition an item'
);

set local role postgres;
select is((select count(*)::integer from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009822' and action = 'order_item.transitioned'), 5, 'each successful transition is audited once');
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009822' and event_type = 'order_item.transitioned'), 5, 'each successful transition emits one outbox event');
select is((select reason from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009822' and after_masked ->> 'state' = 'CANCELLED'), 'Manager approved cancellation', 'cancellation reason is retained in the audit fact');
select is((select version from public.order_items where id = '00000000-0000-4000-8000-000000009822'), 20, 'failed outsider transition leaves the item version unchanged');

select * from finish();
rollback;
