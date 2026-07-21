begin;

select plan(19);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000009931', 'authenticated', 'authenticated', 'operations-report-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009932', 'authenticated', 'authenticated', 'operations-report-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009933', '00000000-0000-4000-8000-000000009931', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

insert into public.restaurant_tables (id, restaurant_id, branch_id, label, area, capacity, active)
values ('00000000-0000-4000-8000-000000009934', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'R99', 'Report fixture', 2, true);
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, total_paid_minor, currency)
values ('00000000-0000-4000-8000-000000009935', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009934', 'PAID', 2, current_date, 1000, 1000, 'MYR');

select ok(has_function_privilege('authenticated', 'public.read_branch_operations_report(uuid, date, date)', 'EXECUTE'), 'authenticated staff can call the guarded operations report');
select ok(not has_function_privilege('anon', 'public.read_branch_operations_report(uuid, date, date)', 'EXECUTE'), 'anonymous identities cannot call the operations report');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'dining_sessions_branch_business_date'), 'business-date report index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payments_branch_confirmed_method'), 'confirmed-payment report index exists');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009931', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009931', true);

select is(public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'branchName', 'DIVE Demo Branch', 'report returns the authorized Branch');
select is(public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'timezone', 'Asia/Kuching', 'report declares Branch timezone');
select is(public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'currency', 'MYR', 'report declares Branch currency');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'sessions')::integer, 3, 'report counts scoped Sessions');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'orders')::integer, 1, 'report counts committed non-cancelled orders');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'itemQuantity')::integer, 1, 'report sums item quantity');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'grossOrderMinor')::bigint, 1680::bigint, 'report sums immutable order snapshots');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) ->> 'outstandingMinor')::bigint, 1680::bigint, 'report calculates outstanding Session balance');
select is(jsonb_array_length(public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) -> 'reconciliationExceptions'), 1, 'report emits one synthetic reconciliation exception');
select ok((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) -> 'reconciliationExceptions' -> 0 -> 'issues') ? 'PAID_TOTAL_ALLOCATION_MISMATCH', 'exception identifies paid/allocation mismatch');
select ok((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date) -> 'reconciliationExceptions' -> 0 -> 'issues') ? 'MISSING_ORIGINAL_RECEIPT', 'exception identifies missing receipt');
select is((public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date + 1, current_date + 1) ->> 'sessions')::integer, 0, 'bounded future range returns an empty report');
select throws_ok(
  $$select public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date - 400, current_date)$$,
  '22023', 'The report date range cannot exceed 366 days.', 'overlong report range is rejected'
);
select throws_ok(
  $$select public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date + 1, current_date)$$,
  '22023', 'The report date range is invalid.', 'reversed report range is rejected'
);

set local role postgres;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009932', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009932', true);
set local role authenticated;
select is(public.read_branch_operations_report('00000000-0000-4000-8000-000000000002', current_date, current_date), null, 'outsider receives no cross-tenant report');

select * from finish();
rollback;
