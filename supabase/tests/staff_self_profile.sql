begin;

select plan(20);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009931', 'authenticated', 'authenticated', 'synthetic-profile-staff@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009932', 'authenticated', 'authenticated', 'synthetic-profile-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009933', 'authenticated', 'authenticated', null, '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009934', '00000000-0000-4000-8000-000000009931', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles enables RLS');
select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'), 'permanent staff may read their own profile through RLS');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'raw profile insert is revoked');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'raw profile update is revoked');
select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'server repositories have explicit profile read access');
select ok(has_function_privilege('authenticated', 'public.update_my_staff_profile(uuid, uuid, text, text, integer)', 'EXECUTE'), 'authenticated staff can call the guarded self-profile command');
select ok(not has_function_privilege('anon', 'public.update_my_staff_profile(uuid, uuid, text, text, integer)', 'EXECUTE'), 'anonymous callers cannot call the self-profile command');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);

select is((public.update_my_staff_profile(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  'Synthetic Waiter', 'en', 0
) ->> 'version')::integer, 1, 'staff creates a self profile through the guarded boundary');
select is((select display_name from public.profiles where user_id = auth.uid()), 'Synthetic Waiter', 'staff reads only the committed self profile');
select throws_ok(
  $$select public.update_my_staff_profile('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Stale', 'en', 0)$$,
  'P0003', 'The staff profile changed. Refresh before saving.', 'duplicate create is rejected as stale state'
);
select is((public.update_my_staff_profile(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  'Synthetic Floor Lead', 'zh', 1
) ->> 'version')::integer, 2, 'staff updates a self profile with optimistic concurrency');
select is((select preferred_locale from public.profiles where user_id = auth.uid()), 'zh', 'locale preference is stored without enabling an unapproved catalog');
select throws_ok(
  $$select public.update_my_staff_profile('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Synthetic', 'fr', 2)$$,
  '22023', 'Preferred locale is invalid.', 'unsupported locale is rejected'
);
select throws_ok(
  $$select public.update_my_staff_profile('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '   ', 'en', 2)$$,
  '22023', 'Display name must contain 1 to 80 characters.', 'blank display name is rejected'
);

set local role postgres;
select ok((select count(*) = 2 from public.audit_logs where actor_id = '00000000-0000-4000-8000-000000009931' and action = 'staff.profile_updated'), 'profile changes append audit facts');
select ok((select bool_and(not (after_masked ? 'displayName')) from public.audit_logs where actor_id = '00000000-0000-4000-8000-000000009931' and action = 'staff.profile_updated'), 'audit facts never copy the display name');
select ok((select count(*) = 2 and bool_and(not (payload ? 'displayName')) from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009931' and event_type = 'staff.profile_updated'), 'profile invalidation events omit display names');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009932', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009932', true);
select is((select count(*)::integer from public.profiles), 0, 'RLS hides another user profile');
select throws_ok(
  $$select public.update_my_staff_profile('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Outsider', 'en', 0)$$,
  '42501', 'This staff identity cannot update a profile in the requested Branch.', 'a user without scoped membership cannot create a staff profile'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009933', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009933', true);
select throws_ok(
  $$select public.update_my_staff_profile('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Anonymous', 'en', 0)$$,
  '42501', 'A permanent staff identity is required.', 'anonymous identities cannot create staff profiles'
);

select * from finish();
rollback;
