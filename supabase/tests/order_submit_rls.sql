begin;

select plan(9);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values ('00000000-0000-4000-8000-000000009911', 'authenticated', 'authenticated', 'synthetic-order-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009912', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 2, current_date, 'MYR');

insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009913', '00000000-0000-4000-8000-000000009911', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009912', '00000000-0000-4000-8000-000000000602', now() + interval '2 hours');

select ok(has_function_privilege('authenticated', 'public.submit_customer_order(uuid, jsonb, integer, uuid)', 'EXECUTE'), 'authenticated can call the server pricing/order RPC');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009911', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009911', true);

select is((select count(*)::integer from public.submit_customer_order(
  '00000000-0000-4000-8000-000000009912'::uuid,
  '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":2,"modifierOptionIds":[]}]'::jsonb,
  1,
  '00000000-0000-4000-8000-000000009914'::uuid
)), 1, 'customer can submit an order through the grant-bound RPC');
select is((select count(*)::integer from public.orders where session_id = '00000000-0000-4000-8000-000000009912'), 1, 'customer can read its submitted order');
select is((select subtotal_minor::integer from public.orders where session_id = '00000000-0000-4000-8000-000000009912'), 3360, 'server pricing uses integer minor units');
select is((select count(*)::integer from public.order_items where order_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009912')), 1, 'order contains one immutable item snapshot');
select is((select name_snapshot from public.order_items where order_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009912')), 'Nasi Lemak DIVE', 'order item stores the authoritative name snapshot');
select is((select actor_type from public.orders where session_id = '00000000-0000-4000-8000-000000009912'), 'CUSTOMER', 'order actor type is server-derived');
select is((select version from public.dining_sessions where id = '00000000-0000-4000-8000-000000009912'), 2, 'order submission advances the Session version');
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009912'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":2,"modifierOptionIds":[]}]'::jsonb, 2, '00000000-0000-4000-8000-000000009914'::uuid)$$,
  '23505',
  'duplicate key value violates unique constraint "orders_branch_idempotency_key"',
  'database idempotency prevents duplicate order creation'
);

select * from finish();
rollback;
