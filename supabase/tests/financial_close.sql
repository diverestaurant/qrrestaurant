begin;

select plan(34);

select ok(to_regclass('public.discounts') is not null, 'discount snapshots table exists');
select ok(to_regprocedure('public.apply_session_discount(uuid,text,integer,bigint,text,integer,uuid,uuid)') is not null, 'discount command RPC exists');
select ok(to_regprocedure('public.issue_receipt(uuid,uuid)') is not null and to_regprocedure('public.reprint_receipt(uuid,uuid)') is not null, 'receipt issue and reprint RPCs exist');
select ok(to_regprocedure('public.close_dining_session(uuid,integer,uuid)') is not null, 'Session close RPC exists');
select ok(exists (select 1 from pg_trigger where tgname = 'orders_sync_session_total' and tgrelid = 'public.orders'::regclass), 'order insert total trigger exists');
select ok(has_function_privilege('authenticated', 'public.apply_session_discount(uuid, text, integer, bigint, text, integer, uuid, uuid)', 'EXECUTE'), 'authenticated can call the narrow discount RPC');
select ok(has_function_privilege('authenticated', 'public.issue_receipt(uuid, uuid)', 'EXECUTE') and has_function_privilege('authenticated', 'public.close_dining_session(uuid, integer, uuid)', 'EXECUTE'), 'authenticated can call receipt and close RPCs');
select ok(has_function_privilege('authenticated', 'public.begin_payment(uuid, bigint, text, public.payment_method, integer, uuid, uuid)', 'EXECUTE'), 'authenticated can call the narrow payment-begin RPC');
select ok(has_table_privilege('authenticated', 'public.discounts', 'SELECT') and not has_table_privilege('authenticated', 'public.discounts', 'INSERT'), 'discount table is read-only outside the command boundary');
select ok(to_regclass('public.payments_branch_idempotency_key') is not null, 'payment idempotency is unique within a branch');
select is((select total_due_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000000702'), 1680, 'seed order contributes to the authoritative Session due exactly once');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-4000-8000-000000009851', 'authenticated', 'authenticated', 'synthetic-finance-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009852', 'authenticated', 'authenticated', 'synthetic-finance-cashier@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009853', 'authenticated', 'authenticated', 'synthetic-finance-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);
insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values
  ('00000000-0000-4000-8000-000000009854', '00000000-0000-4000-8000-000000009851', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000009855', '00000000-0000-4000-8000-000000009852', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000106', 'ACTIVE');
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, currency)
values
  ('00000000-0000-4000-8000-000000009856', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000602', 'OPEN', 2, current_date, 3000, 'MYR'),
  ('00000000-0000-4000-8000-000000009864', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000601', 'OPEN', 2, current_date, 5000, 'MYR');
insert into public.customer_session_grants (id, anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
values ('00000000-0000-4000-8000-000000009857', '00000000-0000-4000-8000-000000009853', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009856', '00000000-0000-4000-8000-000000000602', now() + interval '2 hours');
insert into public.payments (id, restaurant_id, branch_id, session_id, method, amount_minor, currency, idempotency_key)
values
  ('00000000-0000-4000-8000-000000009858', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009856', 'CASH', 1000, 'MYR', '00000000-0000-4000-8000-000000009859'),
  ('00000000-0000-4000-8000-000000009860', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000009856', 'CARD', 1700, 'MYR', '00000000-0000-4000-8000-000000009861');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009851', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009851', true);

select is((select count(*)::integer from public.begin_payment('00000000-0000-4000-8000-000000009864'::uuid, 1500, 'MYR', 'CARD', 1, '00000000-0000-4000-8000-000000009865'::uuid, '00000000-0000-4000-8000-000000009851'::uuid)), 1, 'cashier-authorized staff can start a partial manual tender');
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009864'), 'PAYMENT_PENDING', 'starting a payment marks the Session payment-pending');
select is((select count(*)::integer from public.payments where session_id = '00000000-0000-4000-8000-000000009864' and state = 'PENDING' and amount_minor = 1500), 1, 'started payment is a durable pending tender');

select is((select count(*)::integer from public.apply_session_discount('00000000-0000-4000-8000-000000009856'::uuid, 'PERCENT', 1000, null, 'Local test authorization', 1, '00000000-0000-4000-8000-000000009862'::uuid, '00000000-0000-4000-8000-000000009851'::uuid)), 1, 'manager can apply an authorized percentage discount');
select is((select total_due_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 2700, 'percentage discount reduces the authoritative due by 10 percent');
select is((select discount_minor::integer from public.discounts where session_id = '00000000-0000-4000-8000-000000009856'), 300, 'discount stores an immutable applied minor-unit snapshot');
select is((select version::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 2, 'discount advances the Session version once');
select throws_ok($$select * from public.apply_session_discount('00000000-0000-4000-8000-000000009856'::uuid, 'FIXED', null, 2800, 'Too large', 2, '00000000-0000-4000-8000-000000009863'::uuid, '00000000-0000-4000-8000-000000009851'::uuid)$$, 'P0001', 'The discount exceeds the outstanding balance.', 'discount cannot reduce the bill below its outstanding boundary');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009852', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009852', true);
select is((select count(*)::integer from public.confirm_payment('00000000-0000-4000-8000-000000009858'::uuid, 1200::bigint, null::text, '00000000-0000-4000-8000-000000009852'::uuid)), 1, 'cashier can confirm the first manual tender');
select is((select total_paid_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 1000, 'first tender allocates exactly once');
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 'PAYMENT_PENDING', 'partial tender leaves the Session payment-pending');
select is((select count(*)::integer from public.confirm_payment('00000000-0000-4000-8000-000000009860'::uuid, null::bigint, 'SYNTHETIC-CARD-001', '00000000-0000-4000-8000-000000009852'::uuid)), 1, 'cashier can confirm a second non-cash tender');
select is((select total_paid_minor::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 2700, 'multiple tenders reconcile to the Session due');
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 'PAID', 'final tender moves the Session to PAID');
select is((select version::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 4, 'each financial command advances the Session version exactly once');

select is((select count(*)::integer from public.issue_receipt('00000000-0000-4000-8000-000000009856'::uuid, '00000000-0000-4000-8000-000000009852'::uuid)), 1, 'cashier can issue one immutable receipt after full payment');
select ok((select snapshot @> '{"totalDueMinor":2700,"totalPaidMinor":2700}'::jsonb from public.receipts where session_id = '00000000-0000-4000-8000-000000009856' and reprint_of is null), 'receipt snapshot preserves authoritative totals');
select is((select count(*)::integer from public.reprint_receipt((select id from public.receipts where session_id = '00000000-0000-4000-8000-000000009856' and reprint_of is null), '00000000-0000-4000-8000-000000009852'::uuid)), 1, 'cashier can reprint without changing the original receipt');
select is((select count(*)::integer from public.close_dining_session('00000000-0000-4000-8000-000000009856'::uuid, 4, '00000000-0000-4000-8000-000000009852'::uuid)), 1, 'cashier can close a fully paid reconciled Session');
set local role postgres;
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009856'), 'CLOSED', 'Session close persists CLOSED state');
select is((select count(*)::integer from public.customer_session_grants where session_id = '00000000-0000-4000-8000-000000009856' and revoked_at is not null), 1, 'Session close revokes all customer grants');
select is((select count(*)::integer from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009856' and action = 'session.closed'), 1, 'Session close writes an audit record');
select is((select count(*)::integer from public.outbox_events where entity_id = '00000000-0000-4000-8000-000000009856' and event_type = 'session.closed'), 1, 'Session close emits a committed outbox event');

select * from finish();
rollback;
