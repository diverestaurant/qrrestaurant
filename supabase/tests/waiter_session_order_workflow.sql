begin;

select plan(22);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009901', 'authenticated', 'authenticated', 'synthetic-waiter-workflow@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009902', 'authenticated', 'authenticated', 'synthetic-waiter-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009911', '00000000-0000-4000-8000-000000009901', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE');

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009920', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 3, current_date, 'MYR');
insert into public.session_join_codes (session_id, code_hash, expires_at)
values ('00000000-0000-4000-8000-000000009920', repeat('a', 64), now() + interval '1 hour');

select ok(has_function_privilege('authenticated', 'public.rotate_session_join_code(uuid, integer, text, timestamptz)', 'EXECUTE'), 'authenticated can call the guarded Join Code rotation command');
select ok(has_function_privilege('authenticated', 'public.submit_staff_order(uuid, jsonb, integer, uuid)', 'EXECUTE'), 'authenticated can call the guarded staff-order command');
select ok(not has_function_privilege('authenticated', 'app_private.commit_order(uuid, jsonb, integer, uuid, text, uuid)', 'EXECUTE'), 'the shared pricing commit function is not exposed');
select ok(not has_table_privilege('authenticated', 'public.orders', 'INSERT'), 'raw authenticated order insertion remains revoked');
select ok(not has_table_privilege('authenticated', 'public.order_items', 'INSERT'), 'raw authenticated order-item insertion remains revoked');
select ok(has_table_privilege('service_role', 'public.restaurant_tables', 'INSERT') and has_table_privilege('service_role', 'public.restaurant_tables', 'DELETE'), 'server-only verification adapter has explicit table fixture privileges');
select ok(has_table_privilege('service_role', 'public.orders', 'INSERT') and has_table_privilege('service_role', 'public.orders', 'DELETE'), 'server-only verification adapter has explicit order fixture privileges');
select ok(has_table_privilege('service_role', 'public.order_items', 'INSERT') and has_table_privilege('service_role', 'public.order_items', 'DELETE'), 'server-only verification adapter has explicit order-item fixture privileges');
select ok((select count(*) = 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.role_key = 'MANAGER' and p.permission_key = 'order.submit'), 'manager role includes staff-assisted order permission');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009901', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009901', true);

select is((select version from public.rotate_session_join_code('00000000-0000-4000-8000-000000009920', 1, repeat('b', 64), now() + interval '2 hours')), 2, 'waiter rotates the Join Code and advances Session version');
set local role postgres;
select is((select count(*)::integer from public.session_join_codes where session_id = '00000000-0000-4000-8000-000000009920' and revoked_at is null), 1, 'rotation leaves exactly one live Join Code');
select is((select count(*)::integer from public.session_join_codes where session_id = '00000000-0000-4000-8000-000000009920' and revoked_at is not null), 1, 'rotation revokes the previous Join Code');
set local role authenticated;
select throws_ok(
  $$select * from public.rotate_session_join_code('00000000-0000-4000-8000-000000009920', 1, repeat('c', 64), now() + interval '2 hours')$$,
  'P0003',
  'The Session changed. Refresh before rotating its Join Code.',
  'stale Join Code rotation is rejected'
);

select is((select count(*)::integer from public.submit_staff_order(
  '00000000-0000-4000-8000-000000009920',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000401","variantId":"00000000-0000-4000-8000-000000000522","quantity":1,"modifierOptionIds":["00000000-0000-4000-8000-000000000512"],"note":"No cucumber"}]'::jsonb,
  2,
  '00000000-0000-4000-8000-000000009921'
)), 1, 'waiter commits one staff-assisted order through authoritative pricing');
set local role postgres;
select is((select actor_type from public.orders where session_id = '00000000-0000-4000-8000-000000009920'), 'WAITER', 'staff-assisted order preserves waiter attribution');
select is((select total_minor::integer from public.orders where session_id = '00000000-0000-4000-8000-000000009920'), 1980, 'staff-assisted order uses authoritative variant and modifier pricing');
select is((select version from public.dining_sessions where id = '00000000-0000-4000-8000-000000009920'), 3, 'staff-assisted order advances Session version once');
select is((select count(*)::integer from public.audit_logs where entity_id in ('00000000-0000-4000-8000-000000009920', (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009920'))), 2, 'rotation and assisted order are both audited');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009902', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009902', true);
set local role authenticated;
select throws_ok(
  $$select * from public.rotate_session_join_code('00000000-0000-4000-8000-000000009920', 3, repeat('d', 64), now() + interval '2 hours')$$,
  '42501',
  'The staff identity cannot rotate this Join Code.',
  'outsider cannot rotate a Join Code'
);
select throws_ok(
  $$select * from public.submit_staff_order('00000000-0000-4000-8000-000000009920', '[{"menuItemId":"00000000-0000-4000-8000-000000000401","quantity":1,"modifierOptionIds":[]}]'::jsonb, 3, '00000000-0000-4000-8000-000000009922')$$,
  '42501',
  'The staff identity cannot submit an assisted order.',
  'outsider cannot submit a staff-assisted order'
);

set local role postgres;
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009920' and event_type = 'session.join_code_rotated'), 1, 'Join Code rotation emits one scoped invalidation event');
select is((select count(*)::integer from public.outbox_events where entity_id = (select id from public.orders where session_id = '00000000-0000-4000-8000-000000009920') and event_type = 'order.submitted'), 1, 'staff-assisted order emits one scoped invalidation event');

select * from finish();
rollback;
