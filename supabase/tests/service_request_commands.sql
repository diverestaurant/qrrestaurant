begin;

select plan(29);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-4000-8000-000000009951', 'authenticated', 'authenticated', 'synthetic-request-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true),
  ('00000000-0000-4000-8000-000000009952', 'authenticated', 'authenticated', 'synthetic-request-waiter@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009953', 'authenticated', 'authenticated', 'synthetic-request-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009954', '00000000-0000-4000-8000-000000009952', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE');
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009955', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 2, current_date, 'MYR');
insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009956', '00000000-0000-4000-8000-000000009951', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009955', '00000000-0000-4000-8000-000000000602', now() + interval '1 hour');

select ok(has_function_privilege('authenticated', 'public.create_customer_service_request(uuid, text, text, uuid)', 'EXECUTE'), 'authenticated boundary can call guarded customer request command');
select ok(has_function_privilege('authenticated', 'public.transition_service_request(uuid, text, integer)', 'EXECUTE'), 'authenticated boundary can call guarded waiter transition');
select ok(not has_function_privilege('anon', 'public.create_customer_service_request(uuid, text, text, uuid)', 'EXECUTE'), 'raw anon role cannot call customer request command');
select ok(not has_table_privilege('authenticated', 'public.service_requests', 'INSERT'), 'raw request insertion is revoked');
select ok(not has_table_privilege('authenticated', 'public.service_requests', 'UPDATE'), 'raw request update is revoked');
select ok(has_table_privilege('service_role', 'public.service_requests', 'DELETE'), 'server-only test adapter has explicit cleanup privilege');
select has_column('public', 'service_requests', 'priority', 'service requests retain operational priority');
select has_column('public', 'service_requests', 'assigned_to', 'service requests retain the claiming staff identity');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'service_requests_priority_inbox_idx'), 'priority inbox has a scoped index');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009951', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009951', true);
select is((select request_id from public.create_customer_service_request('00000000-0000-4000-8000-000000009955', 'WATER', 'Cold water', '00000000-0000-4000-8000-000000009957')), '00000000-0000-4000-8000-000000009957'::uuid, 'customer creates a scoped request');
select is((select deduplicated from public.create_customer_service_request('00000000-0000-4000-8000-000000009955', 'WATER', 'Duplicate', '00000000-0000-4000-8000-000000009958')), true, 'same live request type is deduplicated');
select is((select count(*)::integer from public.service_requests where session_id = '00000000-0000-4000-8000-000000009955' and request_type = 'WATER'), 1, 'deduplication leaves one request');
select throws_ok(
  $$select * from public.create_customer_service_request('00000000-0000-4000-8000-000000009955', 'INVALID', null, '00000000-0000-4000-8000-000000009959')$$,
  '22023', 'Service request fields are invalid.', 'invalid request type is rejected'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009953', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009953', true);
select throws_ok(
  $$select * from public.create_customer_service_request('00000000-0000-4000-8000-000000009955', 'BILL', null, '00000000-0000-4000-8000-000000009959')$$,
  '42501', 'This Session cannot accept service requests.', 'customer without Session grant is rejected'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009952', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009952', true);
select is((select state from public.transition_service_request('00000000-0000-4000-8000-000000009957', 'CLAIMED', 1)), 'CLAIMED', 'waiter claims an open request');
select is((select assigned_to from public.service_requests where id = '00000000-0000-4000-8000-000000009957'), '00000000-0000-4000-8000-000000009952'::uuid, 'claim records the assigned waiter');
select throws_ok(
  $$select * from public.transition_service_request('00000000-0000-4000-8000-000000009957', 'RESOLVED', 1)$$,
  'P0003', 'This service request changed. Refresh the floor view.', 'stale transition is rejected'
);
select is((select state from public.transition_service_request('00000000-0000-4000-8000-000000009957', 'RESOLVED', 2)), 'RESOLVED', 'waiter resolves a claimed request');
select throws_ok(
  $$select * from public.transition_service_request('00000000-0000-4000-8000-000000009957', 'CLAIMED', 3)$$,
  'P0001', 'The service request transition conflicts with its current state.', 'resolved request cannot be reopened'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009953', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009953', true);
select throws_ok(
  $$select * from public.transition_service_request('00000000-0000-4000-8000-000000009957', 'CANCELLED', 3)$$,
  '42501', 'Service request permission is required.', 'outsider cannot transition a request'
);

set local role postgres;
select is((select count(*)::integer from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009957'), 3, 'create, claim and resolve are audited');
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009957'), 3, 'create, claim and resolve emit events');
select is((select version from public.service_requests where id = '00000000-0000-4000-8000-000000009957'), 3, 'request version advances exactly once per transition');
select is((select state from public.service_requests where id = '00000000-0000-4000-8000-000000009957'), 'RESOLVED', 'authoritative request state remains resolved');
select is((select count(*)::integer from public.service_requests where id in ('00000000-0000-4000-8000-000000009958','00000000-0000-4000-8000-000000009959')), 0, 'rejected and deduplicated commands create no extra rows');
select is((select actor_type from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009957' and action = 'service_request.created'), 'CUSTOMER', 'customer attribution is preserved');
select is((select actor_type from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009957' and action = 'service_request.transitioned' order by created_at limit 1), 'STAFF', 'staff transition attribution is preserved');
select ok((select count(*) = 0 from public.service_requests where branch_id <> '00000000-0000-4000-8000-000000000002'), 'request commands created no cross-tenant data');
select is((select priority from public.service_requests where id = '00000000-0000-4000-8000-000000009957'), 1::smallint, 'water request receives the deterministic normal priority');

select * from finish();
rollback;
