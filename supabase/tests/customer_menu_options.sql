begin;

select plan(12);

select ok(has_table_privilege('anon', 'public.menu_item_modifier_groups', 'SELECT'), 'anonymous customers can read public modifier links');
set local role anon;
select is((select count(*)::integer from public.menu_item_variants where branch_id = '00000000-0000-4000-8000-000000000002' and menu_item_id = '00000000-0000-4000-8000-000000000401'), 2, 'public menu exposes active variants for the item');
select is((select count(*)::integer from public.menu_item_modifier_groups where branch_id = '00000000-0000-4000-8000-000000000002' and menu_item_id = '00000000-0000-4000-8000-000000000401'), 1, 'public menu exposes linked active modifier groups');
select is((select count(*)::integer from public.modifier_options where branch_id = '00000000-0000-4000-8000-000000000002' and group_id = '00000000-0000-4000-8000-000000000511'), 2, 'public menu exposes active modifier options');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values ('00000000-0000-4000-8000-000000009821', 'authenticated', 'authenticated', 'synthetic-options-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009822', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 2, current_date, 'MYR');
insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009823', '00000000-0000-4000-8000-000000009821', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009822', '00000000-0000-4000-8000-000000000602', now() + interval '2 hours');

select ok(has_function_privilege('authenticated', 'public.submit_customer_order(uuid, jsonb, integer, uuid)', 'EXECUTE'), 'customer option orders use the authoritative server pricing RPC');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009821', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009821', true);

select is((select count(*)::integer from public.submit_customer_order(
  '00000000-0000-4000-8000-000000009822'::uuid,
  '[{"menuItemId":"00000000-0000-4000-8000-000000000401","variantId":"00000000-0000-4000-8000-000000000522","quantity":1,"modifierOptionIds":["00000000-0000-4000-8000-000000000512","00000000-0000-4000-8000-000000000513"]}]'::jsonb,
  1,
  '00000000-0000-4000-8000-000000009824'::uuid
)), 1, 'valid variant and modifier selections commit');
select is((select total_minor::integer from public.orders where session_id = '00000000-0000-4000-8000-000000009822'), 2080, 'server total includes variant and modifier deltas');
select is((select unit_price_minor::integer from public.order_items where order_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009822')), 2080, 'order item stores the resolved configuration price');
select is((select variant_snapshot ->> 'name' from public.order_items where order_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009822')), 'Extra spicy', 'order item stores the immutable variant snapshot');
select is((select jsonb_array_length(modifier_snapshot) from public.order_items where order_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009822')), 2, 'order item stores immutable modifier snapshots');
select is((select version from public.dining_sessions where id = '00000000-0000-4000-8000-000000009822'), 2, 'configured order advances the Session exactly once');
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009822'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","variantId":"00000000-0000-4000-8000-000000000522","quantity":1,"modifierOptionIds":["00000000-0000-4000-8000-000000000512","00000000-0000-4000-8000-000000000512"]}]'::jsonb, 2, '00000000-0000-4000-8000-000000009825'::uuid)$$,
  '22023',
  'A modifier option cannot be selected more than once.',
  'duplicate modifier selections are rejected server-side'
);

select * from finish();
rollback;
