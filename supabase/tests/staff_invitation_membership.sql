begin;

select plan(16);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-4000-8000-000000009931', 'authenticated', 'authenticated', 'synthetic-invite-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009932', 'authenticated', 'authenticated', 'synthetic-invited-waiter@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009933', 'authenticated', 'authenticated', 'synthetic-invite-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009934', 'authenticated', 'authenticated', null, '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);
insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009935', '00000000-0000-4000-8000-000000009931', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

select ok(has_function_privilege('authenticated', 'public.create_staff_membership_from_invite(uuid, uuid, uuid, uuid)', 'EXECUTE'), 'authenticated staff can call the guarded invitation membership boundary');
select ok(not has_function_privilege('anon', 'public.create_staff_membership_from_invite(uuid, uuid, uuid, uuid)', 'EXECUTE'), 'anonymous clients cannot create staff memberships');
select ok(not has_table_privilege('authenticated', 'public.staff_memberships', 'INSERT'), 'raw membership insertion remains revoked');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);

select is((select version from public.create_staff_membership_from_invite(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000009932', '00000000-0000-4000-8000-000000000105'
)), 1, 'manager creates an active Branch membership for the invited permanent user');
select is((select r.role_key from public.staff_memberships sm join public.roles r on r.id = sm.role_id where sm.user_id = '00000000-0000-4000-8000-000000009932'), 'WAITER', 'the requested Branch role is committed');
select is((select status::text from public.staff_memberships where user_id = '00000000-0000-4000-8000-000000009932'), 'ACTIVE', 'invited membership starts active');
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009932','00000000-0000-4000-8000-000000000105')$$,
  'P0001', 'This Auth user already has a membership in the Branch.', 'duplicate Branch membership is rejected'
);
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009933','00000000-0000-4000-8000-000000000102')$$,
  '42501', 'Only a supported Branch role can be assigned by this workflow.', 'Owner assignment is excluded from the Branch invitation workflow'
);
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009934','00000000-0000-4000-8000-000000000105')$$,
  '22023', 'A permanent invited Auth user is required.', 'anonymous Auth users cannot become staff'
);
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009931','00000000-0000-4000-8000-000000000105')$$,
  'P0001', 'Use a second authorized manager to change your own access.', 'manager cannot use invitation flow on their own identity'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009933', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009933', true);
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009931','00000000-0000-4000-8000-000000000105')$$,
  '42501', 'Staff management permission is required.', 'non-Admin staff cannot create memberships'
);

set local role postgres;
select is((select count(*)::integer from public.staff_memberships where user_id = '00000000-0000-4000-8000-000000009932' and branch_id = '00000000-0000-4000-8000-000000000002'), 1, 'exactly one invited membership exists');
select ok(exists (select 1 from public.audit_logs where actor_id = '00000000-0000-4000-8000-000000009931' and action = 'staff_memberships.insert' and entity_id = (select id from public.staff_memberships where user_id = '00000000-0000-4000-8000-000000009932')), 'invited membership is audited');
select ok(exists (select 1 from public.outbox_events where event_type = 'staff_memberships.insert' and entity_id = (select id from public.staff_memberships where user_id = '00000000-0000-4000-8000-000000009932')), 'invited membership emits an outbox fact');
select is((select count(*)::integer from public.staff_memberships where user_id = '00000000-0000-4000-8000-000000009933'), 0, 'rejected invitation attempts create no membership');

update public.branches set status = 'SUSPENDED' where id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);
select throws_ok(
  $$select * from public.create_staff_membership_from_invite('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000009933','00000000-0000-4000-8000-000000000105')$$,
  '22023', 'The Restaurant and Branch must be active.', 'suspended Branch rejects new memberships'
);

select * from finish();
rollback;
