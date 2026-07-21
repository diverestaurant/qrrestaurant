begin;

select plan(41);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009971', 'authenticated', 'authenticated', 'synthetic-admin-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009972', 'authenticated', 'authenticated', 'synthetic-admin-target@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values
  ('00000000-0000-4000-8000-000000009973', '00000000-0000-4000-8000-000000009971', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009974', '00000000-0000-4000-8000-000000009972', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE');

insert into public.restaurants (id, slug, name, status, default_currency, default_timezone)
values ('00000000-0000-4000-8000-000000009981', 'synthetic-admin-other', 'Synthetic Other Restaurant', 'ACTIVE', 'MYR', 'Asia/Kuching');
insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone)
values ('00000000-0000-4000-8000-000000009982', '00000000-0000-4000-8000-000000009981', 'other', 'Synthetic Other Branch', 'ACTIVE', 'MYR', 'Asia/Kuching');

select ok(has_function_privilege('authenticated', 'public.execute_admin_command(uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated staff can call the guarded Admin command boundary');
select ok(has_function_privilege('authenticated', 'public.set_menu_item_availability(uuid, integer, boolean)', 'EXECUTE'), 'authenticated staff can call guarded availability');
select ok(not has_function_privilege('anon', 'public.execute_admin_command(uuid, uuid, jsonb)', 'EXECUTE'), 'anonymous identities cannot call Admin commands');
select ok(not has_function_privilege('anon', 'public.set_menu_item_availability(uuid, integer, boolean)', 'EXECUTE'), 'anonymous identities cannot change availability');
select ok(not has_table_privilege('authenticated', 'public.menu_categories', 'INSERT'), 'raw category insertion is revoked');
select ok(not has_table_privilege('authenticated', 'public.menu_items', 'UPDATE'), 'raw menu-item mutation is revoked');
select ok(not has_table_privilege('authenticated', 'public.restaurant_tables', 'INSERT'), 'raw table insertion is revoked');
select ok(not has_table_privilege('authenticated', 'public.staff_memberships', 'UPDATE'), 'raw membership mutation is revoked');
select ok(not has_table_privilege('authenticated', 'public.kitchen_stations', 'UPDATE'), 'raw station mutation is revoked');
select ok(not has_table_privilege('authenticated', 'public.feature_flags', 'INSERT'), 'raw feature-flag insertion is revoked');
select ok(has_table_privilege('service_role', 'public.feature_flags', 'SELECT'), 'server repository has explicit feature-flag read privilege');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009971', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009971', true);

select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_category.create","id":"00000000-0000-4000-8000-000000009901","name":"Synthetic Admin Category"}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a category through the guarded boundary');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_item.create","id":"00000000-0000-4000-8000-000000009902","categoryId":"00000000-0000-4000-8000-000000009901","name":"Synthetic Admin Item","basePriceMinor":1250,"currency":"MYR","stationKey":"wok"}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a menu item through the guarded boundary');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"table.create","id":"00000000-0000-4000-8000-000000009903","label":"A99","area":"Synthetic","capacity":4}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a table through the guarded boundary');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"station.upsert","id":"00000000-0000-4000-8000-000000009904","stationKey":"cold","name":"Cold Station","active":true}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a kitchen station through the guarded boundary');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"feature_flag.set","id":"00000000-0000-4000-8000-000000009905","flagKey":"customer.synthetic","description":"Synthetic flag","enabled":false}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a disabled feature flag through the guarded boundary');

select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_item.update","menuItemId":"00000000-0000-4000-8000-000000009902","expectedVersion":1,"name":"Synthetic Admin Item 2","description":"Updated","basePriceMinor":1300,"stationKey":"cold","visible":true}'::jsonb
) ->> 'version')::integer, 2, 'menu update advances the authoritative version');
select throws_ok(
  $$select public.execute_admin_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"menu_item.update","menuItemId":"00000000-0000-4000-8000-000000009902","expectedVersion":1,"name":"Stale","basePriceMinor":1,"visible":true}'::jsonb)$$,
  'P0003', 'The menu item changed. Refresh before saving.', 'stale menu update is rejected'
);
select is((select version from public.set_menu_item_availability('00000000-0000-4000-8000-000000009902', 2, false)), 3, 'availability command advances the same item version');
select throws_ok(
  $$select * from public.set_menu_item_availability('00000000-0000-4000-8000-000000009902', 2, true)$$,
  'P0003', 'The menu item changed. Refresh before updating.', 'stale availability update is rejected'
);

select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"membership.update","membershipId":"00000000-0000-4000-8000-000000009974","expectedVersion":1,"roleId":"00000000-0000-4000-8000-000000000106","status":"ACTIVE"}'::jsonb
) ->> 'version')::integer, 2, 'manager changes another staff member to an allowed branch role');
select throws_ok(
  $$select public.execute_admin_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"membership.update","membershipId":"00000000-0000-4000-8000-000000009973","expectedVersion":1,"roleId":"00000000-0000-4000-8000-000000000105","status":"ACTIVE"}'::jsonb)$$,
  'P0001', 'A second authorized manager must change your membership.', 'manager cannot mutate their own membership'
);

select is((select token_version from public.rotate_table_entry_qr('00000000-0000-4000-8000-000000009903', repeat('a', 64))), 1, 'first QR rotation creates token version one');
select is((select token_version from public.rotate_table_entry_qr('00000000-0000-4000-8000-000000009903', repeat('b', 64))), 2, 'second QR rotation creates token version two');

set local role postgres;
select is((select count(*)::integer from public.table_qr_tokens where table_id = '00000000-0000-4000-8000-000000009903' and active), 1, 'QR rotation leaves exactly one live token');
select is((select count(*)::integer from public.table_qr_tokens where table_id = '00000000-0000-4000-8000-000000009903' and revoked_at is not null), 1, 'QR rotation revokes the previous token');
select ok((select bool_and(length(token_hash) = 64) from public.table_qr_tokens where table_id = '00000000-0000-4000-8000-000000009903'), 'QR storage contains hashes only');
select ok((select count(*) >= 10 from public.audit_logs where actor_id = '00000000-0000-4000-8000-000000009971'), 'Admin writes and QR rotations append audit facts');
select ok((select count(*) >= 10 from public.outbox_events where branch_id = '00000000-0000-4000-8000-000000000002' and entity_id in ('00000000-0000-4000-8000-000000009901','00000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009903','00000000-0000-4000-8000-000000009904','00000000-0000-4000-8000-000000009905','00000000-0000-4000-8000-000000009974')), 'Admin writes emit scoped invalidation events');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009971', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009971', true);
select throws_ok(
  $$select public.execute_admin_command('00000000-0000-4000-8000-000000009981', '00000000-0000-4000-8000-000000009982', '{"type":"table.create","id":"00000000-0000-4000-8000-000000009906","label":"X1","capacity":2}'::jsonb)$$,
  '42501', 'The staff identity cannot perform this Admin command.', 'manager cannot mutate another tenant'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009972', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009972', true);
select throws_ok(
  $$select public.execute_admin_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"feature_flag.set","id":"00000000-0000-4000-8000-000000009907","flagKey":"forbidden","enabled":false}'::jsonb)$$,
  '42501', 'The staff identity cannot perform this Admin command.', 'non-Admin staff cannot execute Admin commands'
);
select throws_ok(
  $$select * from public.set_menu_item_availability('00000000-0000-4000-8000-000000009902', 3, true)$$,
  '42501', 'The staff identity cannot manage this menu item.', 'non-Admin staff cannot change menu availability'
);
select is((select count(*)::integer from public.feature_flags), 0, 'non-Admin staff cannot read feature flags');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009971', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009971', true);
select is((select count(*)::integer from public.feature_flags), 1, 'manager can read branch feature flags');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"feature_flag.set","flagKey":"customer.synthetic","description":"Enabled","enabled":true,"expectedVersion":1}'::jsonb
) ->> 'version')::integer, 2, 'feature-flag update advances version');
select throws_ok(
  $$select public.execute_admin_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"feature_flag.set","flagKey":"customer.synthetic","enabled":false,"expectedVersion":1}'::jsonb)$$,
  'P0003', 'The feature flag changed. Refresh before saving.', 'stale feature-flag update is rejected'
);
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"station.upsert","stationId":"00000000-0000-4000-8000-000000009904","expectedVersion":1,"stationKey":"cold","name":"Cold Prep","active":true}'::jsonb
) ->> 'version')::integer, 2, 'station update advances version');
select is((public.execute_admin_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"table.update","tableId":"00000000-0000-4000-8000-000000009903","expectedVersion":1,"label":"A99","area":"Synthetic 2","capacity":6,"active":true}'::jsonb
) ->> 'version')::integer, 2, 'table update advances version');

set local role postgres;
select is((select r.role_key from public.staff_memberships sm join public.roles r on r.id = sm.role_id where sm.id = '00000000-0000-4000-8000-000000009974'), 'CASHIER', 'membership command persisted the allowed target role');
select is((select available from public.menu_items where id = '00000000-0000-4000-8000-000000009902'), false, 'authoritative availability state remains committed');
select is((select count(*)::integer from public.feature_flags where branch_id = '00000000-0000-4000-8000-000000009982'), 0, 'cross-tenant Admin attempt created no data');

select * from finish();
rollback;
