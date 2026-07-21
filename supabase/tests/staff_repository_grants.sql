begin;

select plan(12);

select ok(has_table_privilege('service_role', 'public.branches', 'SELECT'), 'server repository can read branch scope');
select ok(has_table_privilege('service_role', 'public.restaurant_tables', 'SELECT'), 'server repository can read table scope');
select ok(has_table_privilege('service_role', 'public.dining_sessions', 'SELECT'), 'server repository can read Session scope');
select ok(has_table_privilege('service_role', 'public.orders', 'SELECT') and has_table_privilege('service_role', 'public.order_items', 'SELECT'), 'server repository can read committed order items');
select ok(has_table_privilege('service_role', 'public.service_requests', 'SELECT'), 'server repository can read service requests');
select ok(has_table_privilege('service_role', 'public.payments', 'SELECT') and has_table_privilege('service_role', 'public.payment_allocations', 'SELECT'), 'server repository can read payment facts');
select ok(has_table_privilege('service_role', 'public.receipts', 'SELECT'), 'server repository can read receipt facts');
select ok(has_table_privilege('service_role', 'public.menu_items', 'SELECT') and has_table_privilege('service_role', 'public.menu_item_variants', 'SELECT') and has_table_privilege('service_role', 'public.modifier_options', 'SELECT'), 'server repository can read published menu configuration');
select ok(has_table_privilege('service_role', 'public.staff_memberships', 'SELECT'), 'server repository can read staff membership scope');
select ok(has_table_privilege('service_role', 'public.dining_sessions', 'INSERT') and has_table_privilege('service_role', 'public.dining_sessions', 'DELETE'), 'server-only synthetic fixture can create and remove isolated Sessions');
select ok(has_table_privilege('service_role', 'public.table_qr_tokens', 'SELECT'), 'server-only verification can inspect hashed QR token facts');
select ok(has_table_privilege('service_role', 'public.table_qr_tokens', 'DELETE'), 'server-only verification can remove isolated QR token fixtures');

select * from finish();
rollback;
