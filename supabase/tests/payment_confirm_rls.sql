begin;

select plan(7);

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
values ('00000000-0000-4000-8000-000000009801', 'authenticated', 'authenticated', 'synthetic-cashier@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values (
  '00000000-0000-4000-8000-000000009802',
  '00000000-0000-4000-8000-000000009801',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000106',
  'ACTIVE'
);

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, currency)
values ('00000000-0000-4000-8000-000000009803', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000601', 'OPEN', 2, current_date, 3000, 'MYR');

insert into public.payments (id, restaurant_id, branch_id, session_id, method, amount_minor, currency, idempotency_key)
values ('00000000-0000-4000-8000-000000009804', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009803', 'CASH', 1680, 'MYR', '00000000-0000-4000-8000-000000009805');

select ok(has_function_privilege('authenticated', 'public.confirm_payment(uuid, bigint, text, uuid)', 'EXECUTE'), 'authenticated can call the narrow payment confirmation RPC');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009801', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009801', true);

select is((select count(*)::integer from public.confirm_payment('00000000-0000-4000-8000-000000009804'::uuid, 2000::bigint, null::text, '00000000-0000-4000-8000-000000009801'::uuid)), 1, 'cashier can confirm a payment atomically');
select is((select state::text from public.payments where id = '00000000-0000-4000-8000-000000009804'), 'CONFIRMED', 'payment is immutable-confirmed after the command');
select is((select change_minor::integer from public.payments where id = '00000000-0000-4000-8000-000000009804'), 320, 'cash confirmation records exact change in minor units');
select is((select total_paid_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009803'), 1680, 'payment confirmation advances the Session paid total');
select is((select count(*)::integer from public.payment_allocations where payment_id = '00000000-0000-4000-8000-000000009804'), 1, 'payment confirmation creates one allocation');
select throws_ok(
  $$select * from public.confirm_payment('00000000-0000-4000-8000-000000009804'::uuid, 2000::bigint, null::text, '00000000-0000-4000-8000-000000009801'::uuid)$$,
  'P0001',
  'This payment is no longer pending.',
  'confirmed payments cannot be confirmed again'
);

select * from finish();
rollback;
