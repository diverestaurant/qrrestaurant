begin;

select plan(21);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009941', 'authenticated', 'authenticated', 'settings-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009942', 'authenticated', 'authenticated', 'settings-owner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009943', 'authenticated', 'authenticated', 'settings-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.restaurants (id, slug, name, status, default_currency, default_timezone)
values ('00000000-0000-4000-8000-000000009944', 'settings-other', 'Settings Other Restaurant', 'ACTIVE', 'MYR', 'Asia/Kuching');
insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone)
values ('00000000-0000-4000-8000-000000009945', '00000000-0000-4000-8000-000000009944', 'other', 'Settings Other Branch', 'ACTIVE', 'MYR', 'Asia/Kuching');
insert into public.restaurant_settings (restaurant_id) values ('00000000-0000-4000-8000-000000009944');
insert into public.branch_settings (restaurant_id, branch_id) values ('00000000-0000-4000-8000-000000009944', '00000000-0000-4000-8000-000000009945');

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values
  ('00000000-0000-4000-8000-000000009946', '00000000-0000-4000-8000-000000009941', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009947', '00000000-0000-4000-8000-000000009942', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000102', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009948', '00000000-0000-4000-8000-000000009943', '00000000-0000-4000-8000-000000009944', '00000000-0000-4000-8000-000000009945', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

select ok(has_function_privilege('authenticated', 'public.execute_settings_command(uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated staff can call the guarded settings boundary');
select ok(not has_function_privilege('anon', 'public.execute_settings_command(uuid, uuid, jsonb)', 'EXECUTE'), 'anonymous identities cannot call settings commands');
select ok(has_table_privilege('service_role', 'public.restaurant_settings', 'SELECT'), 'server repository can read Restaurant settings');
select ok(has_table_privilege('service_role', 'public.branch_settings', 'SELECT'), 'server repository can read Branch settings');
select ok(not has_table_privilege('authenticated', 'public.branches', 'UPDATE'), 'raw Branch profile mutation is revoked');
select ok(not has_table_privilege('authenticated', 'public.restaurant_settings', 'UPDATE'), 'raw Restaurant settings mutation is revoked');
select ok(not has_table_privilege('authenticated', 'public.branch_settings', 'UPDATE'), 'raw Branch settings mutation is revoked');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009941', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009941', true);

select is((public.execute_settings_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"branch.settings.update","expectedBranchVersion":1,"expectedSettingsVersion":1,"name":"DIVE Settings Test Branch","currency":"MYR","timezone":"Asia/Kuching","businessDayCutoff":"05:00","defaultLocale":"en","addressLine1":"Synthetic address","addressLine2":"","city":"Kuching","postalCode":"93000","countryCode":"MY","contactPhone":"","contactEmail":""}'::jsonb
) ->> 'branchVersion')::integer, 2, 'Manager updates Branch settings through the guarded boundary');
select is((select name from public.branches where id = '00000000-0000-4000-8000-000000000002'), 'DIVE Settings Test Branch', 'Branch profile update commits');
select is((select version from public.branch_settings where branch_id = '00000000-0000-4000-8000-000000000002'), 2, 'Branch settings version advances atomically');
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.settings.update","expectedBranchVersion":1,"expectedSettingsVersion":1,"name":"Stale","currency":"MYR","timezone":"Asia/Kuching","businessDayCutoff":"05:00","defaultLocale":"en","addressLine1":"","addressLine2":"","city":"","postalCode":"","countryCode":"MY","contactPhone":"","contactEmail":""}'::jsonb)$$,
  'P0003', 'The Branch profile changed. Refresh before saving.', 'stale Branch settings are rejected'
);
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.settings.update","expectedBranchVersion":2,"expectedSettingsVersion":2,"name":"DIVE Settings Test Branch","currency":"USD","timezone":"Asia/Kuching","businessDayCutoff":"05:00","defaultLocale":"en","addressLine1":"","addressLine2":"","city":"","postalCode":"","countryCode":"MY","contactPhone":"","contactEmail":""}'::jsonb)$$,
  'P0001', 'Branch currency cannot change after Session activity.', 'currency cannot change after financial Session activity'
);
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"branch.settings.update","expectedBranchVersion":2,"expectedSettingsVersion":2,"name":"DIVE Settings Test Branch","currency":"MYR","timezone":"Mars/Olympus","businessDayCutoff":"05:00","defaultLocale":"en","addressLine1":"","addressLine2":"","city":"","postalCode":"","countryCode":"MY","contactPhone":"","contactEmail":""}'::jsonb)$$,
  '22023', 'Branch timezone is invalid.', 'invalid timezone is rejected in the database'
);
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"restaurant.settings.update","expectedRestaurantVersion":1,"expectedSettingsVersion":1,"name":"Forbidden","defaultCurrency":"MYR","defaultTimezone":"Asia/Kuching","legalName":"","registrationNumber":"","taxRegistrationNumber":"","contactPhone":"","contactEmail":"","brandAccent":"#0F766E","receiptFooter":""}'::jsonb)$$,
  '42501', 'Restaurant profile changes require an Owner identity.', 'Branch Manager cannot mutate Owner profile fields'
);
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000009944', '00000000-0000-4000-8000-000000009945', '{"type":"branch.settings.update","expectedBranchVersion":1,"expectedSettingsVersion":1,"name":"Cross tenant","currency":"MYR","timezone":"Asia/Kuching","businessDayCutoff":"04:00","defaultLocale":"en","addressLine1":"","addressLine2":"","city":"","postalCode":"","countryCode":"MY","contactPhone":"","contactEmail":""}'::jsonb)$$,
  '42501', 'The staff identity cannot manage Branch settings.', 'Manager cannot mutate another tenant'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009942', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009942', true);

select is((public.execute_settings_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"restaurant.settings.update","expectedRestaurantVersion":1,"expectedSettingsVersion":1,"name":"DIVE Settings Restaurant","defaultCurrency":"MYR","defaultTimezone":"Asia/Kuching","legalName":"Synthetic Legal Name","registrationNumber":"SYNTHETIC-ONLY","taxRegistrationNumber":"","contactPhone":"","contactEmail":"owner@example.test","brandAccent":"#0F766E","receiptFooter":"Synthetic receipt footer"}'::jsonb
) ->> 'restaurantVersion')::integer, 2, 'Owner updates Restaurant profile through the guarded boundary');
select is((select name from public.restaurants where id = '00000000-0000-4000-8000-000000000001'), 'DIVE Settings Restaurant', 'Restaurant profile update commits');
select is((select receipt_footer from public.restaurant_settings where restaurant_id = '00000000-0000-4000-8000-000000000001'), 'Synthetic receipt footer', 'Owner receipt setting commits');
select throws_ok(
  $$select public.execute_settings_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"restaurant.settings.update","expectedRestaurantVersion":1,"expectedSettingsVersion":1,"name":"Stale","defaultCurrency":"MYR","defaultTimezone":"Asia/Kuching","legalName":"","registrationNumber":"","taxRegistrationNumber":"","contactPhone":"","contactEmail":"","brandAccent":"#0F766E","receiptFooter":""}'::jsonb)$$,
  'P0003', 'The Restaurant profile changed. Refresh before saving.', 'stale Restaurant settings are rejected'
);

set local role postgres;
select ok((select count(*) >= 2 from public.audit_logs where action in ('branch.settings_updated', 'restaurant.settings_updated')), 'settings changes append masked audit facts');
select ok((select count(*) >= 2 from public.outbox_events where event_type in ('branch.settings_updated', 'restaurant.settings_updated')), 'settings changes emit scoped invalidation events');

select * from finish();
rollback;
