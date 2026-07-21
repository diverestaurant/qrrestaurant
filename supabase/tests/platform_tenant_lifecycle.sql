begin;

select plan(25);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009921', 'authenticated', 'authenticated', 'platform-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009922', 'authenticated', 'authenticated', 'platform-tenant-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009923', '00000000-0000-4000-8000-000000009921', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000101', 'ACTIVE');

select ok((select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass), 'subscriptions has RLS enabled');
select ok(has_function_privilege('authenticated', 'public.read_platform_tenants()', 'EXECUTE'), 'authenticated identities can reach the guarded Platform read boundary');
select ok(has_function_privilege('authenticated', 'public.execute_platform_tenant_command(jsonb)', 'EXECUTE'), 'authenticated identities can reach the guarded Platform command boundary');
select ok(not has_function_privilege('anon', 'public.read_platform_tenants()', 'EXECUTE'), 'anonymous identities cannot read Platform tenants');
select ok(not has_function_privilege('anon', 'public.execute_platform_tenant_command(jsonb)', 'EXECUTE'), 'anonymous identities cannot execute Platform commands');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009921', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009921', true);

select is(jsonb_array_length(public.read_platform_tenants()), 1, 'Platform Admin reads the seeded tenant catalog');
select is((public.execute_platform_tenant_command('{
  "type":"platform.restaurant.create",
  "restaurantId":"00000000-0000-4000-8000-000000009924",
  "branchId":"00000000-0000-4000-8000-000000009925",
  "subscriptionId":"00000000-0000-4000-8000-000000009926",
  "name":"Synthetic Platform Restaurant",
  "slug":"synthetic-platform",
  "defaultCurrency":"MYR",
  "defaultTimezone":"Asia/Kuching",
  "branchName":"Synthetic Platform Branch",
  "branchSlug":"main",
  "planKey":"MANUAL_V1"
}'::jsonb) ->> 'version')::integer, 1, 'Platform Admin creates an isolated Restaurant and first Branch');
set local role postgres;
select is((select status::text from public.restaurants where id = '00000000-0000-4000-8000-000000009924'), 'ACTIVE', 'new Restaurant starts active');
select is((select status::text from public.branches where id = '00000000-0000-4000-8000-000000009925'), 'ACTIVE', 'new first Branch starts active');
select is((select count(*)::integer from public.restaurant_settings where restaurant_id = '00000000-0000-4000-8000-000000009924') + (select count(*)::integer from public.branch_settings where branch_id = '00000000-0000-4000-8000-000000009925'), 2, 'tenant creation initializes both settings records');
select is((select status from public.subscriptions where restaurant_id = '00000000-0000-4000-8000-000000009924'), 'TRIAL', 'new tenant uses manual trial tracking');

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009927', '00000000-0000-4000-8000-000000009922', '00000000-0000-4000-8000-000000009924', '00000000-0000-4000-8000-000000009925', '00000000-0000-4000-8000-000000000103', 'ACTIVE');
set local role authenticated;

select is((public.execute_platform_tenant_command('{"type":"platform.restaurant.lifecycle.set","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":1,"status":"SUSPENDED","reason":"Synthetic suspension verification"}'::jsonb) ->> 'version')::integer, 2, 'Platform Admin suspends tenant access without deleting data');
set local role postgres;
select is((select status::text from public.restaurants where id = '00000000-0000-4000-8000-000000009924'), 'SUSPENDED', 'Restaurant lifecycle is suspended');
select is((select status || ':' || version from public.subscriptions where restaurant_id = '00000000-0000-4000-8000-000000009924'), 'SUSPENDED:2', 'suspension updates manual subscription tracking');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009922', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009922', true);
set local role authenticated;
select is(app_private.has_branch_permission('00000000-0000-4000-8000-000000009925', 'report.read'), false, 'suspended tenant loses ordinary Branch permissions at the database boundary');
select throws_ok($$select public.read_platform_tenants()$$, '42501', 'Platform Admin permission is required.', 'Manager cannot read Platform tenant catalog');
select throws_ok($$select public.execute_platform_tenant_command('{"type":"platform.restaurant.lifecycle.set","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":2,"status":"ACTIVE","reason":"Forbidden"}'::jsonb)$$, '42501', 'Platform Admin permission is required.', 'Manager cannot execute Platform lifecycle commands');

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009921', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009921', true);
set local role authenticated;
select throws_ok($$select public.execute_platform_tenant_command('{"type":"platform.restaurant.lifecycle.set","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":1,"status":"ACTIVE","reason":"Stale"}'::jsonb)$$, 'P0003', 'The Restaurant lifecycle changed. Refresh before saving.', 'stale lifecycle command is rejected');
select is((public.execute_platform_tenant_command('{"type":"platform.restaurant.lifecycle.set","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":2,"status":"ACTIVE","reason":"Synthetic reactivation verification"}'::jsonb) ->> 'version')::integer, 3, 'Platform Admin reactivates preserved tenant data');

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009922', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009922', true);
set local role authenticated;
select is(app_private.has_branch_permission('00000000-0000-4000-8000-000000009925', 'report.read'), true, 'reactivation restores scoped Branch permissions');

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009921', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009921', true);
set local role authenticated;
select is((public.execute_platform_tenant_command('{"type":"platform.subscription.update","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":3,"planKey":"PILOT_MANUAL","status":"ACTIVE"}'::jsonb) ->> 'version')::integer, 4, 'Platform Admin updates manual subscription tracking');
select throws_ok($$select public.execute_platform_tenant_command('{"type":"platform.subscription.update","restaurantId":"00000000-0000-4000-8000-000000009924","branchId":"00000000-0000-4000-8000-000000009925","expectedVersion":3,"planKey":"STALE_PLAN","status":"ACTIVE"}'::jsonb)$$, 'P0003', 'The subscription changed. Refresh before saving.', 'stale subscription update is rejected');
select is(jsonb_array_length(public.read_platform_tenants()), 2, 'Platform catalog includes the new isolated tenant');

set local role postgres;
select ok((select count(*) >= 4 from public.audit_logs where restaurant_id = '00000000-0000-4000-8000-000000009924' and actor_role = 'PLATFORM'), 'Platform lifecycle appends audit facts');
select ok((select count(*) >= 3 from public.outbox_events where restaurant_id = '00000000-0000-4000-8000-000000009924'), 'Platform create and lifecycle emit scoped outbox events');

select * from finish();
rollback;
