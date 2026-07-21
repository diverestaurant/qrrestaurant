begin;

select plan(18);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-4000-8000-000000009931', 'authenticated', 'authenticated', 'synthetic-handoff-waiter@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009932', 'authenticated', 'authenticated', 'synthetic-handoff-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);
insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009933', '00000000-0000-4000-8000-000000009931', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 'ACTIVE');
insert into public.restaurant_tables (id, restaurant_id, branch_id, label, capacity, active)
values ('00000000-0000-4000-8000-000000009934', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'H99', 2, true);
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values ('00000000-0000-4000-8000-000000009935', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009934', 'OPEN', 2, current_date, 'MYR');

select has_column('public', 'restaurant_tables', 'operational_state', 'tables retain cleaning readiness state');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'restaurant_tables_operational_idx'), 'floor readiness query has a scoped index');
select ok(has_function_privilege('authenticated', 'public.request_session_payment(uuid, integer)', 'EXECUTE'), 'waiter can call guarded payment handoff');
select ok(has_function_privilege('authenticated', 'public.mark_restaurant_table_ready(uuid, integer)', 'EXECUTE'), 'waiter can call guarded table-ready command');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);
select is((select state::text from public.request_session_payment('00000000-0000-4000-8000-000000009935', 1)), 'PAYMENT_REQUESTED', 'waiter hands a fully served Session to Cashier');
select throws_ok(
  $$select * from public.request_session_payment('00000000-0000-4000-8000-000000009935', 1)$$,
  'P0003', 'The Session changed. Refresh before requesting payment.', 'stale handoff is rejected'
);

set local role postgres;
update public.dining_sessions set state = 'CLOSED', version = version + 1, closed_at = now() where id = '00000000-0000-4000-8000-000000009935';
select is((select operational_state from public.restaurant_tables where id = '00000000-0000-4000-8000-000000009934'), 'CLEANING', 'closing a Session moves the table to cleaning');
select is((select version from public.restaurant_tables where id = '00000000-0000-4000-8000-000000009934'), 2, 'cleaning transition advances table version');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);
select is((select operational_state from public.mark_restaurant_table_ready('00000000-0000-4000-8000-000000009934', 2)), 'READY', 'waiter marks a cleaned table ready');
select throws_ok(
  $$select * from public.mark_restaurant_table_ready('00000000-0000-4000-8000-000000009934', 2)$$,
  'P0003', 'The table changed. Refresh before marking it ready.', 'stale table-ready command is rejected'
);

set local role postgres;
update public.restaurant_tables set operational_state = 'CLEANING' where id = '00000000-0000-4000-8000-000000009934';
select throws_ok(
  $$insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency) values ('00000000-0000-4000-8000-000000009936', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009934', 'OPEN', 2, current_date, 'MYR')$$,
  'P0001', 'The table is inactive or still being cleaned.', 'cleaning table cannot be reopened'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009932', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009932', true);
set local role authenticated;
select throws_ok(
  $$select * from public.mark_restaurant_table_ready('00000000-0000-4000-8000-000000009934', 3)$$,
  '42501', 'Table-ready permission is required.', 'outsider cannot mark a table ready'
);

set local role postgres;
select is((select count(*)::integer from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009935' and action = 'session.payment_requested'), 1, 'payment handoff is audited');
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009935' and event_type = 'session.payment_requested'), 1, 'payment handoff emits one event');
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009935'), 'CLOSED', 'closed Session remains immutable after cleaning');
select is((select operational_state from public.restaurant_tables where id = '00000000-0000-4000-8000-000000009934'), 'CLEANING', 'failed outsider command does not alter table state');
select ok(exists (select 1 from pg_trigger where tgname = 'dining_session_require_ready_table' and not tgisinternal), 'Session-open readiness trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'dining_session_marks_table_cleaning' and not tgisinternal), 'Session-close cleaning trigger exists');

select * from finish();
rollback;
