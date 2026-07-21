begin;

alter table public.restaurants
  add column version integer not null default 1 check (version > 0);

alter table public.branches
  add column version integer not null default 1 check (version > 0);

alter table public.restaurant_settings
  add column legal_name text,
  add column registration_number text,
  add column tax_registration_number text,
  add column contact_phone text,
  add column contact_email text;

alter table public.restaurant_settings
  add constraint restaurant_settings_brand_accent_format check (brand_accent is null or brand_accent ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint restaurant_settings_legal_name_length check (legal_name is null or length(trim(legal_name)) between 1 and 200),
  add constraint restaurant_settings_registration_length check (registration_number is null or length(registration_number) <= 80),
  add constraint restaurant_settings_tax_registration_length check (tax_registration_number is null or length(tax_registration_number) <= 80),
  add constraint restaurant_settings_phone_length check (contact_phone is null or length(contact_phone) <= 40),
  add constraint restaurant_settings_email_length check (contact_email is null or length(contact_email) <= 254),
  add constraint restaurant_settings_receipt_footer_length check (receipt_footer is null or length(receipt_footer) <= 500);

create table public.branch_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null unique,
  default_locale text not null default 'en' check (default_locale in ('en', 'zh', 'ms')),
  address_line_1 text,
  address_line_2 text,
  city text,
  postal_code text,
  country_code char(2) not null default 'MY' check (country_code ~ '^[A-Z]{2}$'),
  contact_phone text,
  contact_email text,
  version integer not null default 1 check (version > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade,
  check (address_line_1 is null or length(address_line_1) <= 200),
  check (address_line_2 is null or length(address_line_2) <= 200),
  check (city is null or length(city) <= 120),
  check (postal_code is null or length(postal_code) <= 24),
  check (contact_phone is null or length(contact_phone) <= 40),
  check (contact_email is null or length(contact_email) <= 254),
  unique (restaurant_id, branch_id, id)
);

insert into public.restaurant_settings (restaurant_id)
select r.id from public.restaurants r
on conflict (restaurant_id) do nothing;

insert into public.branch_settings (restaurant_id, branch_id)
select b.restaurant_id, b.id from public.branches b
on conflict (branch_id) do nothing;

alter table public.branch_settings enable row level security;

revoke all on public.branch_settings from anon, authenticated;
grant select on public.branch_settings to authenticated;
grant select on public.restaurants, public.branches, public.restaurant_settings, public.branch_settings to service_role;

revoke insert, update, delete on public.restaurant_settings from authenticated;
revoke update on public.restaurants, public.branches from authenticated;

drop policy if exists settings_staff_manage on public.restaurant_settings;
create policy restaurant_settings_staff_read on public.restaurant_settings
for select to authenticated
using (
  not app_private.is_anonymous_claim()
  and exists (
    select 1 from public.staff_memberships sm
    where sm.restaurant_id = restaurant_settings.restaurant_id
      and sm.user_id = auth.uid()
      and sm.status = 'ACTIVE'
  )
);

create policy branch_settings_staff_read on public.branch_settings
for select to authenticated
using (app_private.has_branch_permission(branch_id, 'staff.manage'));

create or replace function public.execute_settings_command(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_type text := p_command ->> 'type';
  v_restaurant_version integer;
  v_branch_version integer;
  v_settings_version integer;
  v_current_currency text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or app_private.is_anonymous_claim() then
    raise exception 'Permanent staff sign-in is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Branch scope is invalid.' using errcode = '22023';
  end if;

  if v_type = 'restaurant.settings.update' then
    if not exists (
      select 1
      from public.staff_memberships sm
      join public.roles r on r.id = sm.role_id
      where sm.user_id = auth.uid()
        and sm.restaurant_id = p_restaurant_id
        and sm.status = 'ACTIVE'
        and r.role_key in ('OWNER', 'PLATFORM')
    ) then
      raise exception 'Restaurant profile changes require an Owner identity.' using errcode = '42501';
    end if;
    if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_command ->> 'defaultTimezone') then
      raise exception 'Restaurant timezone is invalid.' using errcode = '22023';
    end if;

    update public.restaurants r set
      name = p_command ->> 'name',
      default_currency = upper(p_command ->> 'defaultCurrency'),
      default_timezone = p_command ->> 'defaultTimezone',
      version = r.version + 1,
      updated_at = now()
    where r.id = p_restaurant_id
      and r.version = (p_command ->> 'expectedRestaurantVersion')::integer
    returning r.version into v_restaurant_version;
    if not found then raise exception 'The Restaurant profile changed. Refresh before saving.' using errcode = 'P0003'; end if;

    update public.restaurant_settings rs set
      legal_name = nullif(trim(p_command ->> 'legalName'), ''),
      registration_number = nullif(trim(p_command ->> 'registrationNumber'), ''),
      tax_registration_number = nullif(trim(p_command ->> 'taxRegistrationNumber'), ''),
      contact_phone = nullif(trim(p_command ->> 'contactPhone'), ''),
      contact_email = nullif(trim(p_command ->> 'contactEmail'), ''),
      brand_accent = nullif(p_command ->> 'brandAccent', ''),
      receipt_footer = nullif(trim(p_command ->> 'receiptFooter'), ''),
      version = rs.version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where rs.restaurant_id = p_restaurant_id
      and rs.version = (p_command ->> 'expectedSettingsVersion')::integer
    returning rs.version into v_settings_version;
    if not found then raise exception 'The Restaurant settings changed. Refresh before saving.' using errcode = 'P0003'; end if;

    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (p_restaurant_id, p_branch_id, auth.uid(), 'OWNER', 'restaurant.settings_updated', 'restaurant_settings', p_restaurant_id, 'Authorized Owner settings update', jsonb_build_object('restaurantVersion', v_restaurant_version - 1, 'settingsVersion', v_settings_version - 1), jsonb_build_object('restaurantVersion', v_restaurant_version, 'settingsVersion', v_settings_version), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (p_restaurant_id, p_branch_id, 'restaurant.settings_updated', 'restaurant_settings', p_restaurant_id, v_settings_version, jsonb_build_object('restaurantId', p_restaurant_id, 'version', v_settings_version));
    return jsonb_build_object('restaurantVersion', v_restaurant_version, 'settingsVersion', v_settings_version);
  elsif v_type = 'branch.settings.update' then
    if not app_private.has_branch_permission(p_branch_id, 'staff.manage') then
      raise exception 'The staff identity cannot manage Branch settings.' using errcode = '42501';
    end if;
    if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_command ->> 'timezone') then
      raise exception 'Branch timezone is invalid.' using errcode = '22023';
    end if;
    select b.currency into v_current_currency from public.branches b where b.id = p_branch_id for update;
    if upper(p_command ->> 'currency') <> v_current_currency and exists (
      select 1 from public.dining_sessions ds where ds.branch_id = p_branch_id
    ) then
      raise exception 'Branch currency cannot change after Session activity.' using errcode = 'P0001';
    end if;

    update public.branches b set
      name = p_command ->> 'name',
      currency = upper(p_command ->> 'currency'),
      timezone = p_command ->> 'timezone',
      business_day_cutoff = (p_command ->> 'businessDayCutoff')::time,
      version = b.version + 1,
      updated_at = now()
    where b.id = p_branch_id
      and b.restaurant_id = p_restaurant_id
      and b.version = (p_command ->> 'expectedBranchVersion')::integer
    returning b.version into v_branch_version;
    if not found then raise exception 'The Branch profile changed. Refresh before saving.' using errcode = 'P0003'; end if;

    update public.branch_settings bs set
      default_locale = p_command ->> 'defaultLocale',
      address_line_1 = nullif(trim(p_command ->> 'addressLine1'), ''),
      address_line_2 = nullif(trim(p_command ->> 'addressLine2'), ''),
      city = nullif(trim(p_command ->> 'city'), ''),
      postal_code = nullif(trim(p_command ->> 'postalCode'), ''),
      country_code = upper(p_command ->> 'countryCode'),
      contact_phone = nullif(trim(p_command ->> 'contactPhone'), ''),
      contact_email = nullif(trim(p_command ->> 'contactEmail'), ''),
      version = bs.version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where bs.branch_id = p_branch_id
      and bs.restaurant_id = p_restaurant_id
      and bs.version = (p_command ->> 'expectedSettingsVersion')::integer
    returning bs.version into v_settings_version;
    if not found then raise exception 'The Branch settings changed. Refresh before saving.' using errcode = 'P0003'; end if;

    insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
    values (p_restaurant_id, p_branch_id, auth.uid(), 'ADMIN', 'branch.settings_updated', 'branch_settings', p_branch_id, 'Authorized Branch settings update', jsonb_build_object('branchVersion', v_branch_version - 1, 'settingsVersion', v_settings_version - 1), jsonb_build_object('branchVersion', v_branch_version, 'settingsVersion', v_settings_version), v_correlation_id);
    insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
    values (p_restaurant_id, p_branch_id, 'branch.settings_updated', 'branch_settings', p_branch_id, v_settings_version, jsonb_build_object('branchId', p_branch_id, 'version', v_settings_version));
    return jsonb_build_object('branchVersion', v_branch_version, 'settingsVersion', v_settings_version);
  end if;

  raise exception 'Settings command type is invalid.' using errcode = '22023';
end;
$$;

revoke all on function public.execute_settings_command(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.execute_settings_command(uuid, uuid, jsonb) to authenticated;

commit;
