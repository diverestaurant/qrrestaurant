begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'zh', 'ms')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

create policy profiles_self_select on public.profiles
for select to authenticated
using (
  user_id = auth.uid()
  and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
);

create or replace function public.update_my_staff_profile(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_display_name text,
  p_preferred_locale text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_before jsonb;
begin
  if v_actor_id is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A permanent staff identity is required.' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_branch_id is null or not exists (
    select 1
    from public.branches b
    join public.restaurants r on r.id = b.restaurant_id and r.status = 'ACTIVE'
    join public.staff_memberships sm
      on sm.restaurant_id = b.restaurant_id
      and (sm.branch_id = b.id or sm.branch_id is null)
    where b.id = p_branch_id
      and b.restaurant_id = p_restaurant_id
      and b.status = 'ACTIVE'
      and sm.user_id = v_actor_id
      and sm.status = 'ACTIVE'
  ) then
    raise exception 'This staff identity cannot update a profile in the requested Branch.' using errcode = '42501';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 80 then
    raise exception 'Display name must contain 1 to 80 characters.' using errcode = '22023';
  end if;
  if p_preferred_locale is null or p_preferred_locale not in ('en', 'zh', 'ms') then
    raise exception 'Preferred locale is invalid.' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'Expected profile version is invalid.' using errcode = '22023';
  end if;

  select jsonb_build_object('version', p.version, 'preferredLocale', p.preferred_locale)
  into v_before
  from public.profiles p
  where p.user_id = v_actor_id;

  if p_expected_version = 0 then
    insert into public.profiles (user_id, display_name, preferred_locale)
    values (v_actor_id, btrim(p_display_name), p_preferred_locale)
    on conflict (user_id) do nothing
    returning * into v_profile;
  else
    update public.profiles
    set display_name = btrim(p_display_name),
        preferred_locale = p_preferred_locale,
        version = version + 1,
        updated_at = now()
    where user_id = v_actor_id
      and version = p_expected_version
    returning * into v_profile;
  end if;

  if v_profile.user_id is null then
    raise exception 'The staff profile changed. Refresh before saving.' using errcode = 'P0003';
  end if;

  insert into public.audit_logs (
    restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id,
    before_masked, after_masked, correlation_id
  ) values (
    p_restaurant_id, p_branch_id, v_actor_id, 'STAFF', 'staff.profile_updated', 'profile', v_actor_id,
    v_before,
    jsonb_build_object('version', v_profile.version, 'preferredLocale', v_profile.preferred_locale, 'displayNameSet', true),
    gen_random_uuid()
  );

  insert into public.outbox_events (
    restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload
  ) values (
    p_restaurant_id, p_branch_id, 'staff.profile_updated', 'profile', v_actor_id, v_profile.version,
    jsonb_build_object('profileId', v_actor_id, 'version', v_profile.version, 'preferredLocale', v_profile.preferred_locale)
  );

  return jsonb_build_object(
    'displayName', v_profile.display_name,
    'preferredLocale', v_profile.preferred_locale,
    'version', v_profile.version
  );
end;
$$;

revoke all on function public.update_my_staff_profile(uuid, uuid, text, text, integer) from public, anon;
grant execute on function public.update_my_staff_profile(uuid, uuid, text, text, integer) to authenticated;

commit;
