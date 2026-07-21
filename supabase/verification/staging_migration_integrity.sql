-- Read-only verification for the explicitly authorized Staging project.
-- Do not add writes here: execute this file only through `supabase db query`.
select json_build_object(
  'migration_history_versions', (
    select count(*)
    from supabase_migrations.schema_migrations
    where version in (
      '20260720113946', '20260720115858', '20260720153847', '20260720160021',
      '20260720161132', '20260720162010', '20260720163210', '20260720165010',
      '20260720170010', '20260720171510', '20260721100000', '20260721110000',
      '20260721112000', '20260721130000', '20260721132000', '20260721133000'
    )
  ),
  'public_table_count', (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'public_tables_without_rls', (
    select coalesce(json_agg(format('%I.%I', n.nspname, c.relname) order by c.relname), '[]'::json)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  'public_policy_count', (
    select count(*) from pg_policies where schemaname = 'public'
  ),
  'realtime_public_tables', (
    select coalesce(json_agg(tablename order by tablename), '[]'::json)
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  ),
  'duplicate_order_idempotency_groups', (
    select count(*) from (
      select branch_id, idempotency_key
      from public.orders
      group by branch_id, idempotency_key
      having count(*) > 1
    ) duplicates
  ),
  'orphan_orders', (
    select count(*)
    from public.orders o
    left join public.dining_sessions s on s.id = o.session_id
      and s.restaurant_id = o.restaurant_id
      and s.branch_id = o.branch_id
    where s.id is null
  ),
  'orphan_order_items', (
    select count(*)
    from public.order_items oi
    left join public.orders o on o.id = oi.order_id
      and o.restaurant_id = oi.restaurant_id
      and o.branch_id = oi.branch_id
    where o.id is null
  ),
  'orphan_payments', (
    select count(*)
    from public.payments p
    left join public.dining_sessions s on s.id = p.session_id
      and s.restaurant_id = p.restaurant_id
      and s.branch_id = p.branch_id
    where s.id is null
  ),
  'orphan_discounts', (
    select count(*)
    from public.discounts d
    left join public.dining_sessions s on s.id = d.session_id
      and s.restaurant_id = d.restaurant_id
      and s.branch_id = d.branch_id
    where s.id is null
  ),
  'tenant_scope_policy_gaps', (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'branches', 'restaurant_tables', 'dining_sessions', 'orders', 'order_items',
        'service_requests', 'payments', 'payment_allocations', 'receipts', 'discounts'
      )
      and coalesce(qual, '') || coalesce(with_check, '') !~ '(restaurant_id|branch_id|session_id|has_branch_permission|has_session_grant)'
  ),
  'anon_sensitive_table_privileges', (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in (
        'dining_sessions', 'session_join_codes', 'customer_session_grants', 'orders',
        'order_items', 'service_requests', 'payments', 'payment_allocations',
        'receipts', 'discounts', 'audit_logs', 'outbox_events'
      )
  ),
  'data_counts', (
    select json_build_object(
      'restaurants', (select count(*) from public.restaurants),
      'branches', (select count(*) from public.branches),
      'menu_items', (select count(*) from public.menu_items),
      'dining_sessions', (select count(*) from public.dining_sessions),
      'orders', (select count(*) from public.orders),
      'payments', (select count(*) from public.payments)
    )
  )
) as staging_migration_integrity;
