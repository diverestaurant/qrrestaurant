begin;

select plan(8);

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
values ('00000000-0000-4000-8000-000000009401', 'authenticated', 'authenticated', 'synthetic-anonymous@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, currency)
values (
  '00000000-0000-4000-8000-000000009402',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000602',
  'OPEN',
  2,
  current_date,
  'MYR'
);

insert into public.session_join_codes (session_id, code_hash, expires_at)
values ('00000000-0000-4000-8000-000000009402', encode(extensions.digest('123456', 'sha256'), 'hex'), now() + interval '2 hours');

select ok(has_function_privilege('authenticated', 'public.verify_dining_session_join_code(uuid, text)', 'EXECUTE'), 'authenticated can call the narrow Join Code verifier');
select ok(has_function_privilege('authenticated', 'public.grant_dining_session(uuid, text, uuid)', 'EXECUTE'), 'authenticated can call the narrow customer grant RPC');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009401', 'role', 'authenticated', 'is_anonymous', true)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009401', true);

select is((select count(*)::integer from public.verify_dining_session_join_code('00000000-0000-4000-8000-000000009402'::uuid, encode(extensions.digest('123456', 'sha256'), 'hex'))), 1, 'anonymous claim can verify a live Join Code');
select is((select count(*)::integer from public.grant_dining_session('00000000-0000-4000-8000-000000009402'::uuid, encode(extensions.digest('123456', 'sha256'), 'hex'), '00000000-0000-4000-8000-000000009401'::uuid)), 1, 'anonymous actor receives one Session grant');
select is((select count(*)::integer from public.customer_session_grants where session_id = '00000000-0000-4000-8000-000000009402' and anonymous_user_id = auth.uid() and revoked_at is null), 1, 'customer can read only its own live Session grant');
select is((select count(*)::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009402'), 1, 'customer can read the joined Session through the grant');
select is((select count(*)::integer from public.verify_dining_session_join_code('00000000-0000-4000-8000-000000009402'::uuid, encode(extensions.digest('654321', 'sha256'), 'hex'))), 0, 'wrong Join Code does not disclose the Session');
select ok((select expires_at > now() from public.customer_session_grants where session_id = '00000000-0000-4000-8000-000000009402' and anonymous_user_id = auth.uid()), 'customer grant has a bounded future expiry');

select * from finish();
rollback;
