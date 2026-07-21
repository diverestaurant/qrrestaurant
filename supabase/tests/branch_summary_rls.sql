begin;

select plan(6);

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
  ('00000000-0000-4000-8000-000000009901', 'authenticated', 'authenticated', 'synthetic-report-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009902', 'authenticated', 'authenticated', 'synthetic-report-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values (
  '00000000-0000-4000-8000-000000009903',
  '00000000-0000-4000-8000-000000009901',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000103',
  'ACTIVE'
);

select ok(has_function_privilege('authenticated', 'public.read_branch_summary(uuid)', 'EXECUTE'), 'authenticated can call the report summary RPC');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009901', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009901', true);
select is((select count(*)::integer from public.read_branch_summary('00000000-0000-4000-8000-000000000002'::uuid)), 1, 'manager can read one branch summary');
select is((select active_tables::integer from public.read_branch_summary('00000000-0000-4000-8000-000000000002'::uuid)), 4, 'branch summary counts active tables including the guarded staff-operations fixture');
select is((select unavailable_menu_items::integer from public.read_branch_summary('00000000-0000-4000-8000-000000000002'::uuid)), 0, 'branch summary counts unavailable menu items');
select is((select total_paid_minor::integer from public.read_branch_summary('00000000-0000-4000-8000-000000000002'::uuid)), 0, 'branch summary starts with no paid amount in the synthetic seed');

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009902', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009902', true);
set local role authenticated;
select is((select count(*)::integer from public.read_branch_summary('00000000-0000-4000-8000-000000000002'::uuid)), 0, 'outsider cannot read the branch summary');

select * from finish();
rollback;
