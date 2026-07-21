create or replace function public.verify_dining_session_join_code(
  p_session_id uuid,
  p_code_hash text
)
returns table(branch_id uuid, restaurant_id uuid, table_id uuid, state public.session_state)
language sql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
  select s.branch_id, s.restaurant_id, s.table_id, s.state
  from public.dining_sessions s
  join public.session_join_codes c on c.session_id = s.id
  where s.id = p_session_id
    and c.code_hash = p_code_hash
    and c.revoked_at is null
    and c.expires_at > now()
    and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING')
    and app_private.is_anonymous_claim();
$$;

create or replace function public.grant_dining_session(
  p_session_id uuid,
  p_code_hash text,
  p_anonymous_user_id uuid
)
returns table(grant_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_branch_id uuid;
  v_restaurant_id uuid;
  v_table_id uuid;
  v_code_expires_at timestamptz;
  v_expires_at timestamptz;
begin
  if not app_private.is_anonymous_claim() or p_anonymous_user_id is distinct from auth.uid() then
    return;
  end if;

  select s.branch_id, s.restaurant_id, s.table_id, c.expires_at
    into v_branch_id, v_restaurant_id, v_table_id, v_code_expires_at
  from public.dining_sessions s
  join public.session_join_codes c on c.session_id = s.id
  where s.id = p_session_id
    and c.code_hash = p_code_hash
    and c.revoked_at is null
    and c.expires_at > now()
    and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING')
  for update of c;

  if not found then
    return;
  end if;

  update public.session_join_codes
  set attempt_count = attempt_count + 1
  where session_id = p_session_id
    and code_hash = p_code_hash;

  v_expires_at := least(v_code_expires_at, now() + interval '4 hours');
  return query
  insert into public.customer_session_grants (
    anonymous_user_id,
    restaurant_id,
    branch_id,
    session_id,
    table_id,
    expires_at
  ) values (
    p_anonymous_user_id,
    v_restaurant_id,
    v_branch_id,
    p_session_id,
    v_table_id,
    v_expires_at
  )
  on conflict (anonymous_user_id, session_id)
  do update set expires_at = excluded.expires_at, revoked_at = null, capability_version = public.customer_session_grants.capability_version + 1
  returning id, public.customer_session_grants.expires_at;
end;
$$;

revoke all on function public.verify_dining_session_join_code(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_dining_session(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.verify_dining_session_join_code(uuid, text) to authenticated;
grant execute on function public.grant_dining_session(uuid, text, uuid) to authenticated;
