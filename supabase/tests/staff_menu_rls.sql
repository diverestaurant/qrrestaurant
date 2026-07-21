begin;

select plan(16);

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
  ('00000000-0000-4000-8000-000000009001', 'authenticated', 'authenticated', 'synthetic-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009002', 'authenticated', 'authenticated', 'synthetic-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values (
  '00000000-0000-4000-8000-000000009101',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000103',
  'ACTIVE'
);

select ok(has_schema_privilege('authenticated', 'app_private', 'USAGE'), 'authenticated can resolve protected policy helpers');
select ok(has_function_privilege('authenticated', 'app_private.is_anonymous_claim()', 'EXECUTE'), 'authenticated can evaluate the anonymous claim helper');
select ok(has_function_privilege('authenticated', 'app_private.has_branch_permission(uuid, text)', 'EXECUTE'), 'authenticated can evaluate branch permissions');
select ok(not has_table_privilege('authenticated', 'public.menu_items', 'UPDATE'), 'authenticated cannot bypass the guarded menu command with raw updates');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'authenticated cannot insert audit logs directly');
select ok(not has_table_privilege('authenticated', 'public.outbox_events', 'INSERT'), 'authenticated cannot insert outbox events directly');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009001', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);

select ok(app_private.has_branch_permission('00000000-0000-4000-8000-000000000002', 'menu.manage'), 'manager has menu.manage in the assigned branch');
select is((select count(*)::integer from public.menu_items where id = '00000000-0000-4000-8000-000000000401'), 1, 'manager can read the menu item through RLS');
select is((select version from public.set_menu_item_availability('00000000-0000-4000-8000-000000000401', 1, false)), 2, 'manager can update menu availability through the guarded command');
select is((select version from public.menu_items where id = '00000000-0000-4000-8000-000000000401'), 2, 'guarded update advances the version');
select is((select actor_id from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000000401' and action = 'menu.item.availability_changed'), '00000000-0000-4000-8000-000000009001'::uuid, 'availability audit records the authenticated staff actor');
set local role postgres;
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000000401' and event_type = 'menu.item.availability_changed'), 1, 'guarded update emits one outbox event');
set local role authenticated;

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009002', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
set local role authenticated;

select ok(not app_private.has_branch_permission('00000000-0000-4000-8000-000000000002', 'menu.manage'), 'outsider has no menu.manage permission');
select throws_ok(
  $$select * from public.set_menu_item_availability('00000000-0000-4000-8000-000000000401', 2, true)$$,
  '42501',
  'The staff identity cannot manage this menu item.',
  'outsider cannot update menu availability'
);

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009001', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
set local role authenticated;

select ok(not app_private.has_branch_permission('00000000-0000-4000-8000-000000000002', 'menu.manage'), 'anonymous claim cannot use staff permission even with membership');
select throws_ok(
  $$select * from public.set_menu_item_availability('00000000-0000-4000-8000-000000000401', 2, true)$$,
  '42501',
  'The staff identity cannot manage this menu item.',
  'anonymous claim cannot update menu availability'
);

select * from finish();
rollback;
