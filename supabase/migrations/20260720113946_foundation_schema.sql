begin;

create extension if not exists pgcrypto;
create schema if not exists app_private;

create type public.restaurant_status as enum ('ACTIVE', 'SUSPENDED');
create type public.branch_status as enum ('ACTIVE', 'SUSPENDED');
create type public.staff_membership_status as enum ('ACTIVE', 'SUSPENDED', 'REVOKED');
create type public.session_state as enum ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'CANCELLED');
create type public.order_state as enum ('SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED', 'CANCELLED');
create type public.payment_state as enum ('PENDING', 'CONFIRMED', 'FAILED');
create type public.payment_method as enum ('CASH', 'CARD', 'DUITNOW', 'E_WALLET', 'OTHER');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 160),
  status public.restaurant_status not null default 'ACTIVE',
  default_currency char(3) not null default 'MYR',
  default_timezone text not null default 'Asia/Kuching',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 160),
  status public.branch_status not null default 'ACTIVE',
  currency char(3) not null default 'MYR',
  timezone text not null default 'Asia/Kuching',
  business_day_cutoff time not null default '04:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug),
  unique (restaurant_id, id)
);

create table public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  brand_accent text,
  receipt_footer text,
  version integer not null default 1 check (version > 0),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key ~ '^[A-Z_]+$'),
  display_name text not null,
  scope text not null check (scope in ('PLATFORM', 'RESTAURANT', 'BRANCH'))
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique check (permission_key ~ '^[a-z_]+\.[a-z_]+$'),
  display_name text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid,
  role_id uuid not null references public.roles(id),
  status public.staff_membership_status not null default 'ACTIVE',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (user_id, restaurant_id, branch_id, role_id)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 40),
  area text,
  capacity smallint not null default 2 check (capacity between 1 and 100),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (branch_id, label),
  unique (restaurant_id, branch_id, id)
);

create table public.table_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  table_id uuid not null,
  token_hash text not null unique,
  token_version integer not null default 1 check (token_version > 0),
  active boolean not null default true,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (restaurant_id, branch_id, table_id) references public.restaurant_tables(restaurant_id, branch_id, id),
  unique (table_id, token_version)
);

create unique index one_current_table_qr on public.table_qr_tokens(table_id) where active;

create table public.dining_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  table_id uuid not null,
  state public.session_state not null default 'OPEN',
  guest_count smallint check (guest_count is null or guest_count > 0),
  business_date date not null,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_by uuid,
  closed_at timestamptz,
  total_due_minor bigint not null default 0 check (total_due_minor >= 0),
  total_paid_minor bigint not null default 0 check (total_paid_minor >= 0 and total_paid_minor <= total_due_minor),
  currency char(3) not null default 'MYR',
  version integer not null default 1 check (version > 0),
  foreign key (restaurant_id, branch_id, table_id) references public.restaurant_tables(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create unique index one_active_session_per_table on public.dining_sessions(table_id) where state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID');

create table public.session_join_codes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dining_sessions(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (session_id, code_hash)
);

create unique index one_live_join_code on public.session_join_codes(session_id) where revoked_at is null;

create table public.customer_session_grants (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null references public.dining_sessions(id) on delete cascade,
  table_id uuid not null,
  expires_at timestamptz not null,
  capability_version integer not null default 1 check (capability_version > 0),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  foreign key (restaurant_id, branch_id, table_id) references public.restaurant_tables(restaurant_id, branch_id, id),
  unique (anonymous_user_id, session_id)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  sort_order integer not null default 0,
  visible boolean not null default true,
  version integer not null default 1 check (version > 0),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  category_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  base_price_minor bigint not null check (base_price_minor >= 0),
  currency char(3) not null default 'MYR',
  visible boolean not null default true,
  available boolean not null default true,
  tax_eligible boolean not null default true,
  service_eligible boolean not null default true,
  station_key text,
  version integer not null default 1 check (version > 0),
  foreign key (restaurant_id, branch_id, category_id) references public.menu_categories(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  menu_item_id uuid not null,
  name text not null,
  price_delta_minor bigint not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  foreign key (restaurant_id, branch_id, menu_item_id) references public.menu_items(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  name text not null,
  required boolean not null default false,
  min_selections smallint not null default 0 check (min_selections >= 0),
  max_selections smallint not null default 1 check (max_selections >= min_selections),
  active boolean not null default true,
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  group_id uuid not null,
  name text not null,
  price_delta_minor bigint not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  foreign key (restaurant_id, branch_id, group_id) references public.modifier_groups(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.menu_item_modifier_groups (
  restaurant_id uuid not null,
  branch_id uuid not null,
  menu_item_id uuid not null,
  group_id uuid not null,
  sort_order integer not null default 0,
  primary key (menu_item_id, group_id),
  foreign key (restaurant_id, branch_id, menu_item_id) references public.menu_items(restaurant_id, branch_id, id),
  foreign key (restaurant_id, branch_id, group_id) references public.modifier_groups(restaurant_id, branch_id, id)
);

create table public.kitchen_stations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  station_key text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id),
  unique (branch_id, station_key)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null,
  display_number integer not null,
  actor_type text not null check (actor_type in ('CUSTOMER', 'WAITER')),
  actor_id uuid,
  state public.order_state not null default 'SUBMITTED',
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  service_minor bigint not null default 0 check (service_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency char(3) not null default 'MYR',
  version integer not null default 1 check (version > 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  unique (branch_id, display_number),
  unique (restaurant_id, branch_id, id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid,
  name_snapshot text not null,
  variant_snapshot jsonb,
  modifier_snapshot jsonb,
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  quantity smallint not null check (quantity between 1 and 20),
  note text,
  station_key text,
  state public.order_state not null default 'SUBMITTED',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, order_id) references public.orders(restaurant_id, branch_id, id) on delete cascade,
  unique (restaurant_id, branch_id, id)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null,
  request_type text not null check (request_type in ('CALL_WAITER', 'CUTLERY', 'WATER', 'BILL', 'OTHER')),
  note text,
  state text not null default 'OPEN' check (state in ('OPEN', 'CLAIMED', 'RESOLVED', 'CANCELLED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null,
  state public.payment_state not null default 'PENDING',
  method public.payment_method not null,
  amount_minor bigint not null check (amount_minor > 0),
  cash_received_minor bigint check (cash_received_minor is null or cash_received_minor >= amount_minor),
  change_minor bigint not null default 0 check (change_minor >= 0),
  currency char(3) not null,
  observed_reference text,
  actor_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, id)
);

create table public.payment_allocations (
  payment_id uuid not null references public.payments(id) on delete cascade,
  session_id uuid not null references public.dining_sessions(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (payment_id, session_id)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  session_id uuid not null,
  receipt_number text not null,
  snapshot jsonb not null,
  issued_by uuid,
  issued_at timestamptz not null default now(),
  reprint_of uuid references public.receipts(id),
  foreign key (restaurant_id, branch_id, session_id) references public.dining_sessions(restaurant_id, branch_id, id),
  unique (branch_id, receipt_number)
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  command_type text not null,
  actor_fingerprint text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  result jsonb,
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, branch_id, command_type, actor_fingerprint, idempotency_key)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  entity_version integer not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid,
  branch_id uuid,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  before_masked jsonb,
  after_masked jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);

create index staff_memberships_user_scope on public.staff_memberships(user_id, restaurant_id, branch_id) where status = 'ACTIVE';
create index customer_grants_user_session on public.customer_session_grants(anonymous_user_id, session_id, expires_at) where revoked_at is null;
create index orders_session_created on public.orders(session_id, created_at);
create index order_items_queue on public.order_items(branch_id, station_key, state, created_at);
create index service_requests_inbox on public.service_requests(branch_id, state, created_at);
create index audit_logs_scope_time on public.audit_logs(restaurant_id, branch_id, created_at);

create function app_private.is_anonymous_claim()
returns boolean
language sql stable security invoker
set search_path = pg_catalog, public
as $$ select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false); $$;

create function app_private.has_branch_permission(p_branch_id uuid, p_permission_key text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.staff_memberships sm
      join public.roles r on r.id = sm.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'
        and (sm.branch_id = p_branch_id or sm.branch_id is null)
        and p.permission_key = p_permission_key
    );
$$;

create function app_private.has_session_grant(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1 from public.customer_session_grants g
      where g.anonymous_user_id = auth.uid()
        and g.session_id = p_session_id
        and g.revoked_at is null
        and g.expires_at > now()
    );
$$;

revoke all on function app_private.has_branch_permission(uuid, text) from public;
revoke all on function app_private.has_session_grant(uuid) from public;
grant execute on function app_private.has_branch_permission(uuid, text) to authenticated;
grant execute on function app_private.has_session_grant(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'restaurants', 'branches', 'restaurant_settings', 'roles', 'permissions', 'role_permissions', 'staff_memberships',
    'restaurant_tables', 'table_qr_tokens', 'dining_sessions', 'session_join_codes', 'customer_session_grants',
    'menu_categories', 'menu_items', 'menu_item_variants', 'modifier_groups', 'modifier_options', 'menu_item_modifier_groups',
    'kitchen_stations', 'orders', 'order_items', 'service_requests', 'payments', 'payment_allocations', 'receipts',
    'idempotency_keys', 'outbox_events', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.menu_categories, public.menu_items, public.menu_item_variants, public.modifier_groups, public.modifier_options, public.kitchen_stations to anon, authenticated;
grant select on public.restaurants, public.branches, public.dining_sessions, public.customer_session_grants, public.orders, public.order_items, public.service_requests to authenticated;
grant insert on public.customer_session_grants, public.orders, public.order_items, public.service_requests to authenticated;
grant update on public.customer_session_grants, public.orders, public.order_items, public.service_requests to authenticated;
grant select, insert, update on public.restaurant_settings, public.roles, public.permissions, public.role_permissions, public.staff_memberships, public.restaurant_tables, public.table_qr_tokens, public.session_join_codes, public.menu_categories, public.menu_items, public.menu_item_variants, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups, public.kitchen_stations, public.payments, public.payment_allocations, public.receipts to authenticated;
grant select on public.audit_logs to authenticated;

-- Server-only command bookkeeping is not exposed to browser roles. The API's
-- service-role adapter needs explicit table privileges because public schema
-- objects are not auto-exposed or auto-granted.
grant select, insert, update on public.idempotency_keys to service_role;
grant select, insert, update on public.staff_memberships to service_role;

create policy restaurants_staff_select on public.restaurants for select to authenticated using (exists (select 1 from public.staff_memberships sm where sm.restaurant_id = restaurants.id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'));
create policy branches_staff_select on public.branches for select to authenticated using (app_private.has_branch_permission(id, 'report.read') or app_private.has_branch_permission(id, 'table.manage'));
create policy settings_staff_manage on public.restaurant_settings for all to authenticated using (exists (select 1 from public.staff_memberships sm join public.roles r on r.id = sm.role_id join public.role_permissions rp on rp.role_id = r.id join public.permissions p on p.id = rp.permission_id where sm.restaurant_id = restaurant_settings.restaurant_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE' and p.permission_key = 'menu.manage')) with check (exists (select 1 from public.staff_memberships sm join public.roles r on r.id = sm.role_id join public.role_permissions rp on rp.role_id = r.id join public.permissions p on p.id = rp.permission_id where sm.restaurant_id = restaurant_settings.restaurant_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE' and p.permission_key = 'menu.manage'));
create policy role_catalog_staff_select on public.roles for select to authenticated using (not app_private.is_anonymous_claim() and exists (select 1 from public.staff_memberships sm where sm.user_id = auth.uid() and sm.status = 'ACTIVE'));
create policy permission_catalog_staff_select on public.permissions for select to authenticated using (not app_private.is_anonymous_claim() and exists (select 1 from public.staff_memberships sm where sm.user_id = auth.uid() and sm.status = 'ACTIVE'));
create policy role_permissions_staff_select on public.role_permissions for select to authenticated using (not app_private.is_anonymous_claim() and exists (select 1 from public.staff_memberships sm where sm.user_id = auth.uid() and sm.status = 'ACTIVE'));
create policy staff_memberships_select on public.staff_memberships for select to authenticated using (user_id = auth.uid() or app_private.has_branch_permission(branch_id, 'staff.manage'));
create policy staff_memberships_manage on public.staff_memberships for all to authenticated using (app_private.has_branch_permission(branch_id, 'staff.manage')) with check (app_private.has_branch_permission(branch_id, 'staff.manage'));

create policy table_staff_manage on public.restaurant_tables for all to authenticated using (app_private.has_branch_permission(branch_id, 'table.manage')) with check (app_private.has_branch_permission(branch_id, 'table.manage'));
create policy qr_staff_manage on public.table_qr_tokens for all to authenticated using (app_private.has_branch_permission(branch_id, 'table.manage')) with check (app_private.has_branch_permission(branch_id, 'table.manage'));

create policy session_staff_select on public.dining_sessions for select to authenticated using (app_private.has_branch_permission(branch_id, 'session.open'));
create policy session_staff_insert on public.dining_sessions for insert to authenticated with check (app_private.has_branch_permission(branch_id, 'session.open'));
create policy session_staff_update on public.dining_sessions for update to authenticated using (app_private.has_branch_permission(branch_id, 'session.open')) with check (app_private.has_branch_permission(branch_id, 'session.open'));
create policy session_customer_select on public.dining_sessions for select to authenticated using (app_private.has_session_grant(id));
create policy join_code_staff_manage on public.session_join_codes for all to authenticated using (exists (select 1 from public.dining_sessions s where s.id = session_id and app_private.has_branch_permission(s.branch_id, 'session.rotate_join_code'))) with check (exists (select 1 from public.dining_sessions s where s.id = session_id and app_private.has_branch_permission(s.branch_id, 'session.rotate_join_code')));
create policy grant_customer_select on public.customer_session_grants for select to authenticated using (anonymous_user_id = auth.uid() and app_private.is_anonymous_claim());
create policy grant_staff_manage on public.customer_session_grants for all to authenticated using (app_private.has_branch_permission(branch_id, 'session.rotate_join_code')) with check (app_private.has_branch_permission(branch_id, 'session.rotate_join_code'));

create policy menu_categories_public_select on public.menu_categories for select to anon, authenticated using (visible and exists (select 1 from public.branches b join public.restaurants r on r.id = b.restaurant_id where b.id = branch_id and b.status = 'ACTIVE' and r.status = 'ACTIVE'));
create policy menu_categories_staff_manage on public.menu_categories for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy menu_items_public_select on public.menu_items for select to anon, authenticated using (visible and available and exists (select 1 from public.branches b join public.restaurants r on r.id = b.restaurant_id where b.id = branch_id and b.status = 'ACTIVE' and r.status = 'ACTIVE'));
create policy menu_items_staff_manage on public.menu_items for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy variants_public_select on public.menu_item_variants for select to anon, authenticated using (active);
create policy variants_staff_manage on public.menu_item_variants for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy modifier_groups_public_select on public.modifier_groups for select to anon, authenticated using (active);
create policy modifier_groups_staff_manage on public.modifier_groups for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy modifier_options_public_select on public.modifier_options for select to anon, authenticated using (active);
create policy modifier_options_staff_manage on public.modifier_options for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy item_groups_staff_manage on public.menu_item_modifier_groups for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));
create policy stations_staff_manage on public.kitchen_stations for all to authenticated using (app_private.has_branch_permission(branch_id, 'menu.manage')) with check (app_private.has_branch_permission(branch_id, 'menu.manage'));

create policy orders_staff_select on public.orders for select to authenticated using (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'payment.begin') or app_private.has_branch_permission(branch_id, 'order.serve'));
create policy orders_staff_insert on public.orders for insert to authenticated with check (app_private.has_branch_permission(branch_id, 'order.submit'));
create policy orders_staff_update on public.orders for update to authenticated using (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'order.serve')) with check (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'order.serve'));
create policy orders_customer_select on public.orders for select to authenticated using (app_private.has_session_grant(session_id));
create policy orders_customer_insert on public.orders for insert to authenticated with check (actor_type = 'CUSTOMER' and app_private.has_session_grant(session_id));
create policy order_items_staff_select on public.order_items for select to authenticated using (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'order.serve'));
create policy order_items_staff_manage on public.order_items for all to authenticated using (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'order.serve')) with check (app_private.has_branch_permission(branch_id, 'order.accept') or app_private.has_branch_permission(branch_id, 'order.serve'));
create policy order_items_customer_select on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and app_private.has_session_grant(o.session_id)));
create policy order_items_customer_insert on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o where o.id = order_id and app_private.has_session_grant(o.session_id)));

create policy requests_staff_select on public.service_requests for select to authenticated using (app_private.has_branch_permission(branch_id, 'order.serve'));
create policy requests_staff_manage on public.service_requests for update to authenticated using (app_private.has_branch_permission(branch_id, 'order.serve')) with check (app_private.has_branch_permission(branch_id, 'order.serve'));
create policy requests_customer_select on public.service_requests for select to authenticated using (app_private.has_session_grant(session_id));
create policy requests_customer_insert on public.service_requests for insert to authenticated with check (app_private.has_session_grant(session_id));

create policy payments_staff_manage on public.payments for all to authenticated using (app_private.has_branch_permission(branch_id, 'payment.begin') or app_private.has_branch_permission(branch_id, 'payment.confirm')) with check (app_private.has_branch_permission(branch_id, 'payment.begin') or app_private.has_branch_permission(branch_id, 'payment.confirm'));
create policy allocations_staff_manage on public.payment_allocations for all to authenticated using (exists (select 1 from public.payments p where p.id = payment_id and app_private.has_branch_permission(p.branch_id, 'payment.confirm'))) with check (exists (select 1 from public.payments p where p.id = payment_id and app_private.has_branch_permission(p.branch_id, 'payment.confirm')));
create policy receipts_staff_manage on public.receipts for all to authenticated using (app_private.has_branch_permission(branch_id, 'receipt.issue')) with check (app_private.has_branch_permission(branch_id, 'receipt.issue'));
create policy audit_staff_select on public.audit_logs for select to authenticated using (branch_id is null or app_private.has_branch_permission(branch_id, 'audit.read'));

commit;
