begin;

select plan(7);

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
values ('00000000-0000-4000-8000-000000009201', 'authenticated', 'authenticated', 'synthetic-session-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values (
  '00000000-0000-4000-8000-000000009202',
  '00000000-0000-4000-8000-000000009201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000103',
  'ACTIVE'
);

select ok(has_function_privilege('authenticated', 'public.open_dining_session(uuid, uuid, smallint, date, character, text, timestamp with time zone, uuid)', 'EXECUTE'), 'authenticated can call the narrow session-open RPC');
select ok(to_regclass('public.one_active_session_per_table') is not null, 'one active Session index remains the duplicate-open guard');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009201', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009201', true);

select is((select count(*)::integer from public.open_dining_session(
  '00000000-0000-4000-8000-000000009301'::uuid,
  '00000000-0000-4000-8000-000000000601'::uuid,
  2::smallint,
  current_date,
  'MYR'::char(3),
  encode(extensions.digest('123456', 'sha256'), 'hex'),
  now() + interval '2 hours',
  '00000000-0000-4000-8000-000000009201'::uuid
)), 1, 'manager can atomically open a Session through RLS');
select is((select state::text from public.dining_sessions where id = '00000000-0000-4000-8000-000000009301'), 'OPEN', 'opened Session starts OPEN');
select is((select guest_count::integer from public.dining_sessions where id = '00000000-0000-4000-8000-000000009301'), 2, 'opened Session preserves guest count');
select is((select count(*)::integer from public.session_join_codes where session_id = '00000000-0000-4000-8000-000000009301' and revoked_at is null), 1, 'Session open creates one live Join Code');

select throws_ok(
  $$select * from public.open_dining_session(
    '00000000-0000-4000-8000-000000009302'::uuid,
    '00000000-0000-4000-8000-000000000601'::uuid,
    2::smallint,
    current_date,
    'MYR'::char(3),
    encode(extensions.digest('654321', 'sha256'), 'hex'),
    now() + interval '2 hours',
    '00000000-0000-4000-8000-000000009201'::uuid
  )$$,
  '23505',
  'duplicate key value violates unique constraint "one_active_session_per_table"',
  'one active Session per table prevents a duplicate open'
);

select * from finish();
rollback;
