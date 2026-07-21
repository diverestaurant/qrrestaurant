insert into public.restaurants (id, slug, name, status, default_currency, default_timezone)
values ('00000000-0000-4000-8000-000000000001', 'dive-demo', 'DIVE Restaurant Demo', 'ACTIVE', 'MYR', 'Asia/Kuching')
on conflict (id) do nothing;

insert into public.branches (id, restaurant_id, slug, name, status, currency, timezone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'main', 'DIVE Demo Branch', 'ACTIVE', 'MYR', 'Asia/Kuching')
on conflict (id) do nothing;

insert into public.roles (id, role_key, display_name, scope)
values
  ('00000000-0000-4000-8000-000000000101', 'PLATFORM', 'Platform Admin', 'PLATFORM'),
  ('00000000-0000-4000-8000-000000000102', 'OWNER', 'Restaurant Owner', 'RESTAURANT'),
  ('00000000-0000-4000-8000-000000000103', 'MANAGER', 'Branch Manager', 'BRANCH'),
  ('00000000-0000-4000-8000-000000000104', 'KITCHEN', 'Kitchen Lead', 'BRANCH'),
  ('00000000-0000-4000-8000-000000000105', 'WAITER', 'Waiter', 'BRANCH'),
  ('00000000-0000-4000-8000-000000000106', 'CASHIER', 'Cashier', 'BRANCH')
on conflict (id) do nothing;

insert into public.permissions (id, permission_key, display_name)
values
  ('00000000-0000-4000-8000-000000000201', 'session.open', 'Open Session'),
  ('00000000-0000-4000-8000-000000000202', 'session.rotate_join_code', 'Rotate Join Code'),
  ('00000000-0000-4000-8000-000000000203', 'order.submit', 'Submit Order'),
  ('00000000-0000-4000-8000-000000000204', 'order.accept', 'Accept Order'),
  ('00000000-0000-4000-8000-000000000205', 'order.prepare', 'Prepare Order'),
  ('00000000-0000-4000-8000-000000000206', 'order.serve', 'Serve Order'),
  ('00000000-0000-4000-8000-000000000207', 'payment.begin', 'Begin Payment'),
  ('00000000-0000-4000-8000-000000000208', 'payment.confirm', 'Confirm Payment'),
  ('00000000-0000-4000-8000-000000000209', 'discount.apply', 'Apply Discount'),
  ('00000000-0000-4000-8000-000000000210', 'receipt.issue', 'Issue Receipt'),
  ('00000000-0000-4000-8000-000000000211', 'menu.manage', 'Manage Menu'),
  ('00000000-0000-4000-8000-000000000212', 'table.manage', 'Manage Tables'),
  ('00000000-0000-4000-8000-000000000213', 'staff.manage', 'Manage Staff'),
  ('00000000-0000-4000-8000-000000000214', 'report.read', 'Read Reports'),
  ('00000000-0000-4000-8000-000000000215', 'audit.read', 'Read Audit'),
  ('00000000-0000-4000-8000-000000000216', 'session.close', 'Close Session')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.role_key in ('PLATFORM', 'OWNER')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-4000-8000-000000000103', p.id from public.permissions p where p.permission_key in ('session.open', 'session.close', 'session.rotate_join_code', 'order.submit', 'order.accept', 'order.prepare', 'order.serve', 'payment.begin', 'payment.confirm', 'discount.apply', 'receipt.issue', 'menu.manage', 'table.manage', 'staff.manage', 'report.read', 'audit.read')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-4000-8000-000000000104', p.id from public.permissions p where p.permission_key in ('order.accept', 'order.prepare')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-4000-8000-000000000105', p.id from public.permissions p where p.permission_key in ('session.open', 'session.rotate_join_code', 'order.submit', 'order.serve')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-4000-8000-000000000106', p.id from public.permissions p where p.permission_key in ('session.close', 'payment.begin', 'payment.confirm', 'receipt.issue')
on conflict do nothing;

insert into public.menu_categories (id, restaurant_id, branch_id, name, description, sort_order)
values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Mains', 'Local demo menu', 1)
on conflict (id) do nothing;
insert into public.menu_items (id, restaurant_id, branch_id, category_id, name, description, base_price_minor, currency, visible, available, station_key)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 'Nasi Lemak DIVE', 'Coconut rice, sambal, cucumber, egg, peanuts', 1680, 'MYR', true, true, 'wok'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 'Char Kway Teow', 'Wok-tossed flat noodles, prawns, bean sprouts', 1880, 'MYR', true, true, 'wok'),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 'Synthetic Staff Test Item', 'Hidden local-only mutation fixture', 100, 'MYR', false, true, 'wok')
on conflict (id) do nothing;
insert into public.menu_item_variants (id, restaurant_id, branch_id, menu_item_id, name, price_delta_minor, active, sort_order)
values
  ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000401', 'Regular', 0, true, 1),
  ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000401', 'Extra spicy', 100, true, 2)
on conflict (id) do nothing;
insert into public.modifier_groups (id, restaurant_id, branch_id, name, required, min_selections, max_selections, active)
values ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Extras', false, 0, 2, true)
on conflict (id) do nothing;
insert into public.modifier_options (id, restaurant_id, branch_id, group_id, name, price_delta_minor, active, sort_order)
values
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000511', 'Fried egg', 200, true, 1),
  ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000511', 'Peanuts', 100, true, 2)
on conflict (id) do nothing;
insert into public.menu_item_modifier_groups (restaurant_id, branch_id, menu_item_id, group_id, sort_order)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000511', 1)
on conflict (menu_item_id, group_id) do nothing;
insert into public.kitchen_stations (id, restaurant_id, branch_id, station_key, name)
values ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'wok', 'Wok Station')
on conflict (id) do nothing;
insert into public.restaurant_tables (id, restaurant_id, branch_id, label, area, capacity, active)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'T12', 'Main floor', 4, true),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'T14', 'Main floor', 4, true),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'T99 synthetic', 'Local test fixture', 2, true)
on conflict (id) do nothing;

insert into public.table_qr_tokens (id, restaurant_id, branch_id, table_id, token_hash, token_version, active)
values ('00000000-0000-4000-8000-000000000609', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000603', encode(extensions.digest('local-table-token', 'sha256'), 'hex'), 1, true)
on conflict (id) do nothing;

insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, currency)
values ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000603', 'OPEN', 2, current_date, 0, 'MYR')
on conflict (id) do nothing;

insert into public.session_join_codes (session_id, code_hash, expires_at)
values ('00000000-0000-4000-8000-000000000701', encode(extensions.digest('123456', 'sha256'), 'hex'), now() + interval '7 days')
on conflict (session_id, code_hash) do nothing;

-- Hidden local-only fixtures for authenticated staff command success/replay tests.
insert into public.restaurant_tables (id, restaurant_id, branch_id, label, area, capacity, active)
values ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'T98 synthetic ops', 'Local test fixture', 4, true)
on conflict (id) do nothing;
insert into public.dining_sessions (id, restaurant_id, branch_id, table_id, state, guest_count, business_date, total_due_minor, currency)
values ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000604', 'OPEN', 2, current_date, 0, 'MYR')
on conflict (id) do nothing;
insert into public.orders (id, restaurant_id, branch_id, session_id, display_number, actor_type, state, subtotal_minor, total_minor, currency, idempotency_key)
values ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000702', 9901, 'WAITER', 'SUBMITTED', 1680, 1680, 'MYR', '00000000-0000-4000-8000-000000000707')
on conflict (id) do nothing;
insert into public.order_items (id, restaurant_id, branch_id, order_id, menu_item_id, name_snapshot, unit_price_minor, quantity, station_key, state)
values ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000401', 'Nasi Lemak DIVE', 1680, 1, 'wok', 'SUBMITTED')
on conflict (id) do nothing;
insert into public.service_requests (id, restaurant_id, branch_id, session_id, request_type, note, state)
values ('00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000702', 'WATER', 'Synthetic staff transition fixture', 'OPEN')
on conflict (id) do nothing;
insert into public.payments (id, restaurant_id, branch_id, session_id, method, amount_minor, currency, idempotency_key)
values ('00000000-0000-4000-8000-000000000706', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000702', 'CASH', 1680, 'MYR', '00000000-0000-4000-8000-000000000708')
on conflict (id) do nothing;
