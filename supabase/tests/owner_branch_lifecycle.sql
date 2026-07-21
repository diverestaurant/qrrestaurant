begin;

select plan(33);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009951', 'authenticated', 'authenticated', 'synthetic-branch-owner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009952', 'authenticated', 'authenticated', 'synthetic-branch-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009953', 'authenticated', 'authenticated', null, '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values
  ('00000000-0000-4000-8000-000000009954', '00000000-0000-4000-8000-000000009951', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009955', '00000000-0000-4000-8000-000000009952', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

insert into public.restaurants (id, slug, name, status, default_currency, default_timezone)
values ('00000000-0000-4000-8000-000000009956', 'synthetic-branch-other', 'Synthetic Branch Other', 'ACTIVE', 'MYR', 'Asia/Kuching');
insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone)
values ('00000000-0000-4000-8000-000000009957', '00000000-0000-4000-8000-000000009956', 'main', 'Synthetic Other Main', 'ACTIVE', 'MYR', 'Asia/Kuching');
insert into public.branch_settings (restaurant_id, branch_id) values ('00000000-0000-4000-8000-000000009956', '00000000-0000-4000-8000-000000009957');

select ok(has_function_privilege('authenticated', 'app_private.has_restaurant_owner_scope(uuid, uuid)', 'EXECUTE'), 'authenticated callers can use the guarded Owner-scope helper');
select ok(has_function_privilege('authenticated', 'public.read_restaurant_branches(uuid, uuid)', 'EXECUTE'), 'authenticated callers can use the guarded Branch catalog');
select ok(has_function_privilege('authenticated', 'public.execute_branch_lifecycle_command(uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated callers can use the guarded Branch lifecycle command');
select ok(not has_function_privilege('anon', 'public.read_restaurant_branches(uuid, uuid)', 'EXECUTE'), 'anonymous callers cannot read the Branch catalog');
select ok(not has_function_privilege('anon', 'public.execute_branch_lifecycle_command(uuid, uuid, jsonb)', 'EXECUTE'), 'anonymous callers cannot execute Branch lifecycle commands');
select ok(not has_table_privilege('authenticated', 'public.branches', 'INSERT'), 'authenticated callers cannot insert Branches directly');
select ok(exists(select 1 from public.permissions where permission_key = 'branch.manage'), 'Branch management has an explicit permission key');
select ok(exists(select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.role_key = 'OWNER' and p.permission_key = 'branch.manage'), 'Owner receives Branch management permission');
select ok(not exists(select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.role_key = 'MANAGER' and p.permission_key = 'branch.manage'), 'Manager does not receive Restaurant-wide Branch management permission');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009952', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009952', true);
select throws_ok(
  $$select public.read_restaurant_branches('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')$$,
  '42501', 'Restaurant Owner permission is required.', 'Manager cannot read the Restaurant-wide Branch catalog'
);
select throws_ok(
  $$select public.execute_branch_lifecycle_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.create","branchId":"00000000-0000-4000-8000-000000009958","slug":"forbidden","name":"Forbidden","currency":"MYR","timezone":"Asia/Kuching","businessDayCutoff":"04:00","defaultLocale":"en","countryCode":"MY"}'::jsonb)$$,
  '42501', 'Restaurant Owner permission is required.', 'Manager cannot create a Branch'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select is(jsonb_array_length(public.read_restaurant_branches('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')), 1, 'Owner reads the initial Restaurant Branch catalog');
select ok(public.read_restaurant_branches('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') @> '[{"id":"00000000-0000-4000-8000-000000000002","status":"ACTIVE"}]'::jsonb, 'Branch catalog contains scoped authoritative status');
select is((public.execute_branch_lifecycle_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"branch.create","branchId":"00000000-0000-4000-8000-000000009958","slug":"synthetic-owner-branch","name":"Synthetic Owner Branch","currency":"MYR","timezone":"Asia/Kuching","businessDayCutoff":"05:00","defaultLocale":"en","countryCode":"MY"}'::jsonb
) ->> 'version')::integer, 1, 'Owner creates an isolated Branch');
select is((select status::text from public.branches where id = '00000000-0000-4000-8000-000000009958'), 'ACTIVE', 'created Branch is active');
set local role postgres;
select is((select default_locale from public.branch_settings where branch_id = '00000000-0000-4000-8000-000000009958'), 'en', 'created Branch receives validated settings');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select is(jsonb_array_length(public.read_restaurant_branches('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')), 2, 'Owner catalog includes the new Branch');
select throws_ok(
  $$select public.execute_branch_lifecycle_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.create","branchId":"00000000-0000-4000-8000-000000009959","slug":"invalid-zone","name":"Invalid zone","currency":"MYR","timezone":"Mars/Olympus","businessDayCutoff":"04:00","defaultLocale":"en","countryCode":"MY"}'::jsonb)$$,
  '22023', 'Branch timezone is invalid.', 'invalid Branch timezone is rejected'
);
select throws_ok(
  $$select public.read_restaurant_branches('00000000-0000-4000-8000-000000009956', '00000000-0000-4000-8000-000000009957')$$,
  '42501', 'Restaurant Owner permission is required.', 'Owner cannot read another Restaurant without membership'
);

set local role postgres;
insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009960', '00000000-0000-4000-8000-000000009952', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000009958', '00000000-0000-4000-8000-000000000103', 'ACTIVE');
insert into public.restaurant_tables (id, restaurant_id, branch_id, label, capacity, active)
values ('00000000-0000-4000-8000-000000009961', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000009958', 'S1', 2, true);
insert into public.table_qr_tokens (id, restaurant_id, branch_id, table_id, token_hash, active)
values ('00000000-0000-4000-8000-000000009962', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000009958', '00000000-0000-4000-8000-000000009961', repeat('9', 64), true);
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009963', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000009958', '00000000-0000-4000-8000-000000009961', 'OPEN', 2, current_date, 'MYR');
insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009964', '00000000-0000-4000-8000-000000009953', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000009958', '00000000-0000-4000-8000-000000009963', '00000000-0000-4000-8000-000000009961', now() + interval '1 hour');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009952', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009952', true);
select ok(app_private.has_branch_permission('00000000-0000-4000-8000-000000009958', 'staff.manage'), 'Manager permission is active before Branch suspension');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select is((public.execute_branch_lifecycle_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"branch.lifecycle.set","branchId":"00000000-0000-4000-8000-000000009958","expectedVersion":1,"status":"SUSPENDED","reason":"Synthetic lifecycle verification"}'::jsonb
) ->> 'version')::integer, 2, 'Owner suspends a secondary Branch with optimistic concurrency');
set local role postgres;
select is((select status::text from public.branches where id = '00000000-0000-4000-8000-000000009958'), 'SUSPENDED', 'Branch status is suspended');
select ok((select not active and revoked_at is not null from public.table_qr_tokens where id = '00000000-0000-4000-8000-000000009962'), 'suspension revokes active Table Entry QR tokens');
select ok((select revoked_at is not null from public.customer_session_grants where id = '00000000-0000-4000-8000-000000009964'), 'suspension revokes live customer grants');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009952', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009952', true);
select ok(not app_private.has_branch_permission('00000000-0000-4000-8000-000000009958', 'staff.manage'), 'suspended Branch denies ordinary staff permissions');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select is((public.execute_branch_lifecycle_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"branch.lifecycle.set","branchId":"00000000-0000-4000-8000-000000009958","expectedVersion":2,"status":"ACTIVE","reason":"Synthetic lifecycle restore"}'::jsonb
) ->> 'version')::integer, 3, 'Owner reactivates a suspended Branch');
select is((select status::text from public.branches where id = '00000000-0000-4000-8000-000000009958'), 'ACTIVE', 'Branch status is active after restore');
set local role postgres;
select ok((select revoked_at is not null from public.customer_session_grants where id = '00000000-0000-4000-8000-000000009964'), 'reactivation never restores old customer grants');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select throws_ok(
  $$select public.execute_branch_lifecycle_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.lifecycle.set","branchId":"00000000-0000-4000-8000-000000009958","expectedVersion":2,"status":"SUSPENDED","reason":"Stale attempt"}'::jsonb)$$,
  'P0003', 'The Branch lifecycle changed. Refresh before saving.', 'stale Branch lifecycle command is rejected'
);
select is((public.execute_branch_lifecycle_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"branch.lifecycle.set","branchId":"00000000-0000-4000-8000-000000009958","expectedVersion":3,"status":"SUSPENDED","reason":"Prepare last-active guard"}'::jsonb
) ->> 'version')::integer, 4, 'secondary Branch can be suspended again');
select throws_ok(
  $$select public.execute_branch_lifecycle_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.lifecycle.set","branchId":"00000000-0000-4000-8000-000000000002","expectedVersion":1,"status":"SUSPENDED","reason":"Would remove last Branch"}'::jsonb)$$,
  'P0001', 'The last active Branch cannot be suspended.', 'Owner cannot suspend the last active Branch'
);

set local role postgres;
select ok((select count(*) >= 4 from public.audit_logs where action in ('branch.created', 'branch.lifecycle_set') and actor_id = '00000000-0000-4000-8000-000000009951'), 'Branch lifecycle appends masked audit facts');
select ok((select count(*) >= 4 from public.outbox_events where event_type in ('branch.created', 'branch.lifecycle_set') and restaurant_id = '00000000-0000-4000-8000-000000000001'), 'Branch lifecycle emits scoped invalidation events');

select * from finish();
rollback;
