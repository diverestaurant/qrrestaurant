begin;

select plan(52);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-4000-8000-000000009921', 'authenticated', 'authenticated', 'synthetic-menu-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('00000000-0000-4000-8000-000000009922', 'authenticated', 'authenticated', 'synthetic-menu-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);
insert into public.staff_memberships (id, user_id, restaurant_id, branch_id, role_id, status)
values ('00000000-0000-4000-8000-000000009923', '00000000-0000-4000-8000-000000009921', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'ACTIVE');

select has_column('public', 'menu_items', 'sort_order', 'menu item sort order exists');
select has_column('public', 'menu_items', 'image_path', 'private image path metadata exists');
select has_column('public', 'menu_items', 'image_alt', 'required image alt metadata exists');
select has_column('public', 'menu_items', 'featured', 'featured menu state exists');
select has_column('public', 'menu_items', 'spice_level', 'spice level exists');
select has_column('public', 'menu_items', 'operating_rules', 'operating-hour rule document exists');
select has_column('public', 'menu_item_variants', 'version', 'variants support optimistic concurrency');
select has_column('public', 'modifier_groups', 'version', 'modifier groups support optimistic concurrency');
select has_column('public', 'modifier_options', 'version', 'modifier options support optimistic concurrency');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'menu_items_public_sort_idx'), 'public menu sort has a scoped index');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'menu_variants_admin_idx'), 'variant editor has a scoped index');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'modifier_groups_admin_idx'), 'modifier group editor has a scoped index');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'modifier_options_admin_idx'), 'modifier option editor has a scoped index');
select ok(has_function_privilege('authenticated', 'public.execute_menu_structure_command(uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated staff can call guarded menu structure commands');
select ok(not has_function_privilege('anon', 'public.execute_menu_structure_command(uuid, uuid, jsonb)', 'EXECUTE'), 'anonymous role cannot call menu structure commands');
select ok(not has_table_privilege('authenticated', 'public.menu_item_variants', 'INSERT'), 'raw variant insertion is revoked');
select ok(not has_table_privilege('authenticated', 'public.modifier_groups', 'UPDATE'), 'raw modifier group updates are revoked');
select ok(not has_table_privilege('authenticated', 'public.modifier_options', 'INSERT'), 'raw modifier option insertion is revoked');
select ok(not has_table_privilege('authenticated', 'public.menu_item_modifier_groups', 'DELETE'), 'raw modifier unlink is revoked');
select ok(has_table_privilege('service_role', 'public.menu_item_variants', 'DELETE'), 'server-only test adapter has menu structure cleanup privilege');
select ok(not has_function_privilege('authenticated', 'app_private.menu_item_within_operating_window(uuid)', 'EXECUTE'), 'operating-window authority is not exposed to clients');
select has_trigger('public', 'order_items', 'order_item_operating_window', 'order inserts enforce menu operating windows');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_categories'), 'category changes can invalidate customer menus');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_item_variants'), 'variant changes can invalidate customer menus');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'modifier_groups'), 'modifier-group changes can invalidate customer menus');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'modifier_options'), 'modifier-option changes can invalidate customer menus');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_item_modifier_groups'), 'modifier-link changes can invalidate customer menus');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009921', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009921', true);

select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_category.update","categoryId":"00000000-0000-4000-8000-000000000301","expectedVersion":1,"name":"Main dishes","sortOrder":2,"visible":true}'::jsonb
) ->> 'version')::integer, 2, 'manager updates category sort and visibility');
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_item.configuration.update","menuItemId":"00000000-0000-4000-8000-000000000403","expectedVersion":1,"name":"Configured Test Item","description":"Configured","basePriceMinor":250,"stationKey":"wok","visible":true,"sortOrder":3,"featured":true,"spiceLevel":2,"taxEligible":false,"serviceEligible":true,"operatingRules":{"availableFrom":"10:00","availableUntil":"22:00"}}'::jsonb
) ->> 'version')::integer, 2, 'manager updates complete item configuration');
select is((select spice_level from public.menu_items where id = '00000000-0000-4000-8000-000000000403'), 2::smallint, 'spice level is committed');
select is((select operating_rules ->> 'availableUntil' from public.menu_items where id = '00000000-0000-4000-8000-000000000403'), '22:00', 'operating rule is committed');
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_item.image.set","menuItemId":"00000000-0000-4000-8000-000000000403","expectedVersion":2,"imagePath":"00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000403/synthetic.webp","imageAlt":"Synthetic plated item"}'::jsonb
) ->> 'version')::integer, 3, 'manager attaches branch-scoped private image metadata');
select throws_ok(
  $$select public.execute_menu_structure_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"menu_item.image.set","menuItemId":"00000000-0000-4000-8000-000000000403","expectedVersion":3,"imagePath":"other/path.webp","imageAlt":"Bad"}'::jsonb)$$,
  '22023', 'The image path is outside the menu item scope.', 'image path cannot escape restaurant/branch/item scope'
);

select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_variant.upsert","id":"00000000-0000-4000-8000-000000009924","menuItemId":"00000000-0000-4000-8000-000000000403","name":"Large","priceDeltaMinor":300,"active":true,"sortOrder":1}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a variant');
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_variant.upsert","variantId":"00000000-0000-4000-8000-000000009924","expectedVersion":1,"menuItemId":"00000000-0000-4000-8000-000000000403","name":"Large plate","priceDeltaMinor":350,"active":true,"sortOrder":1}'::jsonb
) ->> 'version')::integer, 2, 'variant update advances version');
select throws_ok(
  $$select public.execute_menu_structure_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"menu_variant.upsert","variantId":"00000000-0000-4000-8000-000000009924","expectedVersion":1,"menuItemId":"00000000-0000-4000-8000-000000000403","name":"Stale","priceDeltaMinor":0,"active":true,"sortOrder":1}'::jsonb)$$,
  'P0003', 'The variant changed. Refresh before saving.', 'stale variant update is rejected'
);

select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_modifier_group.upsert","id":"00000000-0000-4000-8000-000000009925","name":"Sauce","required":true,"minSelections":1,"maxSelections":2,"active":true}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a bounded required modifier group');
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_modifier_option.upsert","id":"00000000-0000-4000-8000-000000009926","groupId":"00000000-0000-4000-8000-000000009925","name":"Sambal","priceDeltaMinor":100,"active":true,"sortOrder":1}'::jsonb
) ->> 'version')::integer, 1, 'manager creates a modifier option');
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_modifier_link.set","menuItemId":"00000000-0000-4000-8000-000000000403","expectedMenuItemVersion":3,"groupId":"00000000-0000-4000-8000-000000009925","enabled":true,"sortOrder":1}'::jsonb
) ->> 'enabled')::boolean, true, 'manager links modifier group to an item');
select is((select count(*)::integer from public.menu_item_modifier_groups where menu_item_id = '00000000-0000-4000-8000-000000000403' and group_id = '00000000-0000-4000-8000-000000009925'), 1, 'modifier link is durable');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009922', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009922', true);
select throws_ok(
  $$select public.execute_menu_structure_command('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '{"type":"menu_modifier_link.set","menuItemId":"00000000-0000-4000-8000-000000000403","expectedMenuItemVersion":4,"groupId":"00000000-0000-4000-8000-000000009925","enabled":false,"sortOrder":1}'::jsonb)$$,
  '42501', 'Menu management permission is required.', 'outsider cannot mutate menu structure'
);

set local role postgres;
select ok((select count(*) >= 7 from public.audit_logs where actor_id = '00000000-0000-4000-8000-000000009921'), 'menu structure writes append audit facts');
select ok((select count(*) >= 7 from public.outbox_events where entity_id in ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009925','00000000-0000-4000-8000-000000009926')), 'menu structure writes emit invalidation events');
select is((select name_snapshot from public.order_items where id = '00000000-0000-4000-8000-000000000704'), 'Nasi Lemak DIVE', 'historical order item snapshot is unchanged');
select is((select image_alt from public.menu_items where id = '00000000-0000-4000-8000-000000000403'), 'Synthetic plated item', 'image alt text remains attached to metadata');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000009921', 'role', 'authenticated', 'is_anonymous', false)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009921', true);
select is((public.execute_menu_structure_command(
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '{"type":"menu_modifier_link.set","menuItemId":"00000000-0000-4000-8000-000000000403","expectedMenuItemVersion":4,"groupId":"00000000-0000-4000-8000-000000009925","enabled":false,"sortOrder":1}'::jsonb
) ->> 'enabled')::boolean, false, 'manager can unlink modifier group');

set local role postgres;
select is((select count(*)::integer from public.menu_item_modifier_groups where menu_item_id = '00000000-0000-4000-8000-000000000403' and group_id = '00000000-0000-4000-8000-000000009925'), 0, 'modifier unlink is durable');
select is((select version from public.menu_items where id = '00000000-0000-4000-8000-000000000403'), 5, 'configuration, image and modifier-link commands advance item version exactly four times');
select is((select version from public.menu_item_variants where id = '00000000-0000-4000-8000-000000009924'), 2, 'variant version remains authoritative');
select is((select version from public.modifier_groups where id = '00000000-0000-4000-8000-000000009925'), 1, 'new modifier group starts at version one');
update public.menu_items set operating_rules = '{"availableFrom":"10:00","availableUntil":"10:00"}'::jsonb where id = '00000000-0000-4000-8000-000000000403';
select ok(app_private.menu_item_within_operating_window('00000000-0000-4000-8000-000000000403'), 'equal operating-window bounds mean always available');
update public.menu_items set operating_rules = '{"availableFrom":"invalid","availableUntil":"10:00"}'::jsonb where id = '00000000-0000-4000-8000-000000000403';
select ok(not app_private.menu_item_within_operating_window('00000000-0000-4000-8000-000000000403'), 'invalid operating-window configuration fails closed');

select * from finish();
rollback;
