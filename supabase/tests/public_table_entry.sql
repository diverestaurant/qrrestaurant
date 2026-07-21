begin;

select plan(8);

select ok(has_function_privilege('anon', 'public.resolve_public_table_entry(text, text, text)', 'EXECUTE'), 'public table entry resolver is callable by anon');
select ok(has_function_privilege('authenticated', 'public.join_public_table_session(text, text, text, text, uuid)', 'EXECUTE'), 'QR join RPC is callable by authenticated customers');

set local role anon;
select is((select count(*)::integer from public.resolve_public_table_entry('dive-demo', 'main', encode(extensions.digest('local-table-token', 'sha256'), 'hex'))), 1, 'valid synthetic QR resolves one public table entry');
select is((select table_label from public.resolve_public_table_entry('dive-demo', 'main', encode(extensions.digest('local-table-token', 'sha256'), 'hex'))), 'T99 synthetic', 'public QR resolver returns only the table label contract');
select is((select count(*)::integer from public.resolve_public_table_entry('dive-demo', 'main', encode(extensions.digest('wrong-token', 'sha256'), 'hex'))), 0, 'wrong QR token reveals no table entry');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values ('00000000-0000-4000-8000-000000009601', 'authenticated', 'authenticated', 'synthetic-qr-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009601', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009601', true);
select is((select count(*)::integer from public.join_public_table_session('dive-demo', 'main', encode(extensions.digest('local-table-token', 'sha256'), 'hex'), encode(extensions.digest('123456', 'sha256'), 'hex'), '00000000-0000-4000-8000-000000009601'::uuid)), 1, 'valid QR plus Join Code grants the current Session');
select is((select count(*)::integer from public.customer_session_grants where anonymous_user_id = '00000000-0000-4000-8000-000000009601'), 1, 'QR join creates one bounded customer grant');
select is((select count(*)::integer from public.join_public_table_session('dive-demo', 'main', encode(extensions.digest('local-table-token', 'sha256'), 'hex'), encode(extensions.digest('654321', 'sha256'), 'hex'), '00000000-0000-4000-8000-000000009601'::uuid)), 0, 'wrong Join Code does not grant a QR Session');

select * from finish();
rollback;
