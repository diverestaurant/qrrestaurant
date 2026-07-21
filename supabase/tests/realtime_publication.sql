begin;

select plan(5);

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dining_sessions'), 'Realtime can invalidate Session changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'), 'Realtime can invalidate order changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'), 'Realtime can invalidate order-item changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests'), 'Realtime can invalidate service-request changes');
select ok((select relreplident from pg_class where oid = 'public.dining_sessions'::regclass) = 'f' and (select relreplident from pg_class where oid = 'public.orders'::regclass) = 'f', 'Realtime updates retain enough committed scope/version data for resync decisions');

select * from finish();
rollback;
