begin;

create or replace function public.resolve_public_table_entry(
  p_restaurant_slug text,
  p_branch_slug text,
  p_token_hash text
)
returns table(restaurant_name text, branch_name text, table_label text, ordering_requires_join boolean)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select r.name, b.name, t.label, true
  from public.table_qr_tokens q
  join public.restaurants r on r.id = q.restaurant_id
  join public.branches b on b.id = q.branch_id and b.restaurant_id = q.restaurant_id
  join public.restaurant_tables t on t.id = q.table_id and t.branch_id = q.branch_id and t.restaurant_id = q.restaurant_id
  where r.slug = lower(trim(p_restaurant_slug))
    and b.slug = lower(trim(p_branch_slug))
    and q.token_hash = p_token_hash
    and q.active
    and q.revoked_at is null
    and t.active
    and r.status = 'ACTIVE'
    and b.status = 'ACTIVE';
$$;

create or replace function public.join_public_table_session(
  p_restaurant_slug text,
  p_branch_slug text,
  p_token_hash text,
  p_code_hash text,
  p_anonymous_user_id uuid
)
returns table(joined_session_id uuid, grant_id uuid, grant_expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_session_id uuid;
  v_branch_id uuid;
  v_restaurant_id uuid;
  v_table_id uuid;
  v_code_expires_at timestamptz;
  v_expires_at timestamptz;
begin
  if not app_private.is_anonymous_claim() or p_anonymous_user_id is distinct from auth.uid() then
    return;
  end if;

  select s.id, s.branch_id, s.restaurant_id, s.table_id, c.expires_at
    into v_session_id, v_branch_id, v_restaurant_id, v_table_id, v_code_expires_at
  from public.table_qr_tokens q
  join public.restaurants r on r.id = q.restaurant_id
  join public.branches b on b.id = q.branch_id and b.restaurant_id = q.restaurant_id
  join public.restaurant_tables t on t.id = q.table_id and t.branch_id = q.branch_id and t.restaurant_id = q.restaurant_id
  join public.dining_sessions s on s.table_id = t.id and s.branch_id = t.branch_id and s.restaurant_id = t.restaurant_id
  join public.session_join_codes c on c.session_id = s.id
  where r.slug = lower(trim(p_restaurant_slug))
    and b.slug = lower(trim(p_branch_slug))
    and q.token_hash = p_token_hash
    and q.active
    and q.revoked_at is null
    and t.active
    and r.status = 'ACTIVE'
    and b.status = 'ACTIVE'
    and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING')
    and c.code_hash = p_code_hash
    and c.revoked_at is null
    and c.expires_at > now()
  for update of s, c;

  if not found then
    return;
  end if;

  update public.session_join_codes
  set attempt_count = attempt_count + 1
  where public.session_join_codes.session_id = v_session_id and public.session_join_codes.code_hash = p_code_hash;

  v_expires_at := least(v_code_expires_at, now() + interval '4 hours');
  return query
  insert into public.customer_session_grants (anonymous_user_id, restaurant_id, branch_id, session_id, table_id, expires_at)
  values (p_anonymous_user_id, v_restaurant_id, v_branch_id, v_session_id, v_table_id, v_expires_at)
  on conflict (anonymous_user_id, session_id)
  do update set expires_at = excluded.expires_at, revoked_at = null, capability_version = public.customer_session_grants.capability_version + 1
  returning public.customer_session_grants.session_id, public.customer_session_grants.id, public.customer_session_grants.expires_at;
end;
$$;

revoke all on function public.resolve_public_table_entry(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_public_table_entry(text, text, text) to anon, authenticated;
revoke all on function public.join_public_table_session(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.join_public_table_session(text, text, text, text, uuid) to authenticated;

commit;
