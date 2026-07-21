begin;

select plan(20);

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
values
  ('00000000-0000-4000-8000-000000009701', 'authenticated', 'authenticated', 'synthetic-hardening-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true),
  ('00000000-0000-4000-8000-000000009702', 'authenticated', 'authenticated', 'synthetic-hardening-cashier@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values (
  '00000000-0000-4000-8000-000000009703',
  '00000000-0000-4000-8000-000000009702',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000106',
  'ACTIVE'
);

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, currency)
values ('00000000-0000-4000-8000-000000009704', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 2, current_date, 3000, 'MYR');

insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009705', '00000000-0000-4000-8000-000000009701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009704', '00000000-0000-4000-8000-000000000602', now() + interval '2 hours');

insert into public.payments (id, restaurant_id, branch_id, session_id, method, amount_minor, currency, idempotency_key)
values
  ('00000000-0000-4000-8000-000000009706', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009704', 'CASH', 1000, 'MYR', '00000000-0000-4000-8000-000000009707'),
  ('00000000-0000-4000-8000-000000009708', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009704', 'CARD', 500, 'MYR', '00000000-0000-4000-8000-000000009709'),
  ('00000000-0000-4000-8000-000000009710', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009704', 'CASH', 5000, 'MYR', '00000000-0000-4000-8000-000000009711');

select ok(to_regclass('public.one_active_session_per_table') is not null, 'one active Session index protects concurrent opens');
select ok(to_regclass('public.orders_branch_idempotency_key') is not null, 'branch-scoped order idempotency index exists');
select ok(has_function_privilege('authenticated', 'public.submit_customer_order(uuid, jsonb, integer, uuid)', 'EXECUTE'), 'customer order RPC is executable only through the authenticated boundary');
select ok(has_function_privilege('authenticated', 'public.confirm_payment(uuid, bigint, text, uuid)', 'EXECUTE'), 'payment confirmation RPC is executable only through the authenticated boundary');
select ok(has_table_privilege('service_role', 'public.idempotency_keys', 'SELECT') and has_table_privilege('service_role', 'public.idempotency_keys', 'INSERT') and has_table_privilege('service_role', 'public.idempotency_keys', 'UPDATE'), 'server-only idempotency adapter has explicit bookkeeping privileges');
select ok(has_table_privilege('service_role', 'public.staff_memberships', 'SELECT') and has_table_privilege('service_role', 'public.staff_memberships', 'INSERT') and has_table_privilege('service_role', 'public.staff_memberships', 'UPDATE'), 'server-only local Auth fixture adapter has explicit membership privileges');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009701', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009701', true);

select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009704'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":[]}]'::jsonb, 0, '00000000-0000-4000-8000-000000009712'::uuid)$$,
  'P0003',
  'The Session changed. Refresh before submitting.',
  'stale customer order commands are rejected before any write'
);
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009704'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":21,"modifierOptionIds":[]}]'::jsonb, 1, '00000000-0000-4000-8000-000000009713'::uuid)$$,
  '22023',
  'Order quantity or menu item is outside the allowed range.',
  'customer order quantity is bounded server-side'
);
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009704'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":["00000000-0000-4000-8000-000000000501"]}]'::jsonb, 1, '00000000-0000-4000-8000-000000009714'::uuid)$$,
  '22023',
  'A selected modifier is not available for this menu item.',
  'unsupported modifier pricing cannot bypass the authoritative resolver'
);

select is((select count(*)::integer from public.submit_customer_order(
  '00000000-0000-4000-8000-000000009704'::uuid,
  '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":[]}]'::jsonb,
  1,
  '00000000-0000-4000-8000-000000009715'::uuid
)), 1, 'valid customer order commits exactly one order');
select is((select version::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009704'), 2, 'customer order advances the Session version once');
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009704'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":[]}]'::jsonb, 2, '00000000-0000-4000-8000-000000009715'::uuid)$$,
  '23505',
  'duplicate key value violates unique constraint "orders_branch_idempotency_key"',
  'reusing an order key cannot create a second order'
);
select is((select count(*)::integer from public.orders where session_id = '00000000-0000-4000-8000-000000009704'), 1, 'duplicate order replay leaves one durable order');

set local role postgres;
update public.menu_items set available = false where id = '00000000-0000-4000-8000-000000000401';
set local role authenticated;
select throws_ok(
  $$select * from public.submit_customer_order('00000000-0000-4000-8000-000000009704'::uuid, '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":[]}]'::jsonb, 2, '00000000-0000-4000-8000-000000009716'::uuid)$$,
  'P0004',
  'A menu item is unavailable.',
  'server rechecks menu availability at order commit'
);
set local role postgres;
update public.menu_items set available = true where id = '00000000-0000-4000-8000-000000000401';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009702', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009702', true);

select throws_ok(
  $$select * from public.confirm_payment('00000000-0000-4000-8000-000000009706'::uuid, 999::bigint, null::text, '00000000-0000-4000-8000-000000009702'::uuid)$$,
  '22023',
  'Cash received must cover the payment amount.',
  'cashier cannot confirm an underpayment'
);
select throws_ok(
  $$select * from public.confirm_payment('00000000-0000-4000-8000-000000009708'::uuid, null::bigint, null::text, '00000000-0000-4000-8000-000000009702'::uuid)$$,
  '22023',
  'An observed payment reference is required.',
  'non-cash confirmation requires an observed reference'
);
select throws_ok(
  $$select * from public.confirm_payment('00000000-0000-4000-8000-000000009710'::uuid, 5000::bigint, null::text, '00000000-0000-4000-8000-000000009702'::uuid)$$,
  'P0001',
  'The payment exceeds the current outstanding balance.',
  'payment confirmation cannot exceed the Session outstanding balance'
);
select is((select count(*)::integer from public.confirm_payment('00000000-0000-4000-8000-000000009706'::uuid, 1000::bigint, null::text, '00000000-0000-4000-8000-000000009702'::uuid)), 1, 'cashier can confirm a valid tender');
select is((select total_paid_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009704'), 1000, 'payment confirmation advances paid total exactly once');
select is((select version::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009704'), 3, 'payment confirmation advances the Session version exactly once');

select * from finish();
rollback;
