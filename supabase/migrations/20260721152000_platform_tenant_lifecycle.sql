begin;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  plan_key text not null default 'MANUAL_V1' check (plan_key ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  status text not null default 'TRIAL' check (status in ('TRIAL', 'ACTIVE', 'SUSPENDED')),
  version integer not null default 1 check (version > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

insert into public.subscriptions (restaurant_id, plan_key, status)
select r.id, 'MANUAL_V1', case when r.status = 'ACTIVE' then 'TRIAL' else 'SUSPENDED' end
from public.restaurants r
on conflict (restaurant_id) do nothing;

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.subscriptions to service_role;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
  select auth.uid() is not null
    and not app_private.is_anonymous_claim()
    and exists (
      select 1
      from public.staff_memberships sm
      join public.roles r on r.id = sm.role_id
      where sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'
        and r.role_key = 'PLATFORM'
    );
$$;

revoke all on function app_private.is_platform_admin() from public, anon, authenticated;
grant execute on function app_private.is_platform_admin() to authenticated;

create policy subscriptions_platform_read on public.subscriptions
for select to authenticated
using (app_private.is_platform_admin());

-- A suspended tenant or Branch loses every ordinary staff capability at the
-- database boundary. Platform lifecycle commands use their own guarded path.
create or replace function app_private.has_branch_permission(p_branch_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
  select not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.staff_memberships sm
      join public.roles role on role.id = sm.role_id
      join public.role_permissions rp on rp.role_id = role.id
      join public.permissions permission on permission.id = rp.permission_id
      join public.branches branch on branch.id = p_branch_id
      join public.restaurants restaurant on restaurant.id = branch.restaurant_id
      where sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'
        and sm.restaurant_id = restaurant.id
        and (sm.branch_id = p_branch_id or sm.branch_id is null)
        and branch.status = 'ACTIVE'
        and restaurant.status = 'ACTIVE'
        and permission.permission_key = p_permission_key
    );
$$;

revoke all on function app_private.has_branch_permission(uuid, text) from public, anon, authenticated;
grant execute on function app_private.has_branch_permission(uuid, text) to authenticated;

create or replace function public.read_platform_tenants()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
begin
  if not app_private.is_platform_admin() then
    raise exception 'Platform Admin permission is required.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'restaurantId', r.id,
      'name', r.name,
      'slug', r.slug,
      'status', r.status,
      'version', r.version,
      'defaultCurrency', r.default_currency,
      'defaultTimezone', r.default_timezone,
      'subscription', jsonb_build_object('id', s.id, 'planKey', s.plan_key, 'status', s.status, 'version', s.version),
      'branches', coalesce((
        select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'status', b.status, 'currency', b.currency, 'timezone', b.timezone, 'version', b.version) order by b.name)
        from public.branches b where b.restaurant_id = r.id
      ), '[]'::jsonb)
    ) order by r.name), '[]'::jsonb)
    from public.restaurants r
    join public.subscriptions s on s.restaurant_id = r.id
  );
end;
$$;

create or replace function public.execute_platform_tenant_command(p_command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_type text := p_command ->> 'type';
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_subscription_id uuid;
  v_restaurant_version integer;
  v_subscription_version integer;
  v_status text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if not app_private.is_platform_admin() then
    raise exception 'Platform Admin permission is required.' using errcode = '42501';
  end if;

  if v_type = 'platform.restaurant.create' then
    if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_command ->> 'defaultTimezone') then
      raise exception 'Restaurant timezone is invalid.' using errcode = '22023';
    end if;
    v_restaurant_id := (p_command ->> 'restaurantId')::uuid;
    v_branch_id := (p_command ->> 'branchId')::uuid;
    v_subscription_id := (p_command ->> 'subscriptionId')::uuid;
    insert into public.restaurants (id, slug, name, status, default_currency, default_timezone)
    values (v_restaurant_id, p_command ->> 'slug', p_command ->> 'name', 'ACTIVE', upper(p_command ->> 'defaultCurrency'), p_command ->> 'defaultTimezone');
    insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone)
    values (v_branch_id, v_restaurant_id, p_command ->> 'branchSlug', p_command ->> 'branchName', 'ACTIVE', upper(p_command ->> 'defaultCurrency'), p_command ->> 'defaultTimezone');
    insert into public.restaurant_settings (restaurant_id) values (v_restaurant_id);
    insert into public.branch_settings (restaurant_id, branch_id) values (v_restaurant_id, v_branch_id);
    insert into public.subscriptions (id, restaurant_id, plan_key, status, updated_by)
    values (v_subscription_id, v_restaurant_id, p_command ->> 'planKey', 'TRIAL', auth.uid());
    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (v_restaurant_id, v_branch_id, auth.uid(), 'PLATFORM', 'platform.restaurant_created', 'restaurant', v_restaurant_id, 'Authorized Platform tenant creation', null, jsonb_build_object('slug', p_command ->> 'slug', 'branchSlug', p_command ->> 'branchSlug', 'subscriptionStatus', 'TRIAL'), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (v_restaurant_id, v_branch_id, 'platform.restaurant_created', 'restaurant', v_restaurant_id, 1, jsonb_build_object('restaurantId', v_restaurant_id, 'branchId', v_branch_id, 'version', 1));
    return jsonb_build_object('restaurantId', v_restaurant_id, 'branchId', v_branch_id, 'subscriptionId', v_subscription_id, 'version', 1);
  elsif v_type = 'platform.restaurant.lifecycle.set' then
    v_restaurant_id := (p_command ->> 'restaurantId')::uuid;
    v_branch_id := (p_command ->> 'branchId')::uuid;
    v_status := p_command ->> 'status';
    if v_status not in ('ACTIVE', 'SUSPENDED') then raise exception 'Restaurant status is invalid.' using errcode = '22023'; end if;
    update public.restaurants r set status = v_status::public.restaurant_status, version = r.version + 1, updated_at = now()
    where r.id = v_restaurant_id and r.version = (p_command ->> 'expectedVersion')::integer
    returning r.version into v_restaurant_version;
    if not found then raise exception 'The Restaurant lifecycle changed. Refresh before saving.' using errcode = 'P0003'; end if;
    update public.subscriptions s set status = case when v_status = 'SUSPENDED' then 'SUSPENDED' else 'ACTIVE' end, version = s.version + 1, updated_by = auth.uid(), updated_at = now()
    where s.restaurant_id = v_restaurant_id
    returning s.version into v_subscription_version;
    if not exists (select 1 from public.branches b where b.id = v_branch_id and b.restaurant_id = v_restaurant_id) then
      raise exception 'The Platform Branch scope is invalid.' using errcode = '22023';
    end if;
    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (v_restaurant_id, v_branch_id, auth.uid(), 'PLATFORM', 'platform.restaurant_status_set', 'restaurant', v_restaurant_id, nullif(trim(p_command ->> 'reason'), ''), jsonb_build_object('version', v_restaurant_version - 1), jsonb_build_object('version', v_restaurant_version, 'status', v_status), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (v_restaurant_id, v_branch_id, 'platform.restaurant_status_set', 'restaurant', v_restaurant_id, v_restaurant_version, jsonb_build_object('restaurantId', v_restaurant_id, 'status', v_status, 'version', v_restaurant_version));
    return jsonb_build_object('restaurantId', v_restaurant_id, 'version', v_restaurant_version, 'status', v_status, 'subscriptionVersion', v_subscription_version);
  elsif v_type = 'platform.subscription.update' then
    v_restaurant_id := (p_command ->> 'restaurantId')::uuid;
    v_branch_id := (p_command ->> 'branchId')::uuid;
    v_status := p_command ->> 'status';
    if v_status not in ('TRIAL', 'ACTIVE', 'SUSPENDED') then raise exception 'Subscription status is invalid.' using errcode = '22023'; end if;
    update public.subscriptions s set plan_key = p_command ->> 'planKey', status = v_status, version = s.version + 1, updated_by = auth.uid(), updated_at = now()
    where s.restaurant_id = v_restaurant_id and s.version = (p_command ->> 'expectedVersion')::integer
    returning s.id, s.version into v_subscription_id, v_subscription_version;
    if not found then raise exception 'The subscription changed. Refresh before saving.' using errcode = 'P0003'; end if;
    if not exists (select 1 from public.branches b where b.id = v_branch_id and b.restaurant_id = v_restaurant_id) then
      raise exception 'The Platform Branch scope is invalid.' using errcode = '22023';
    end if;
    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (v_restaurant_id, v_branch_id, auth.uid(), 'PLATFORM', 'platform.subscription_updated', 'subscription', v_subscription_id, 'Manual V1 subscription tracking; no billing action', jsonb_build_object('version', v_subscription_version - 1), jsonb_build_object('version', v_subscription_version, 'status', v_status, 'planKey', p_command ->> 'planKey'), v_correlation_id);
    return jsonb_build_object('subscriptionId', v_subscription_id, 'version', v_subscription_version, 'status', v_status);
  end if;

  raise exception 'Platform command type is invalid.' using errcode = '22023';
end;
$$;

revoke all on function public.read_platform_tenants() from public, anon, authenticated;
revoke all on function public.execute_platform_tenant_command(jsonb) from public, anon, authenticated;
grant execute on function public.read_platform_tenants() to authenticated;
grant execute on function public.execute_platform_tenant_command(jsonb) to authenticated;

commit;
