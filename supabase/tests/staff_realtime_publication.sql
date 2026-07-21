begin;

select plan(8);

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items'), 'Realtime can invalidate menu availability changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'), 'Realtime can invalidate payment changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'discounts'), 'Realtime can invalidate discount changes');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receipts'), 'Realtime can invalidate receipt changes');
select ok((select relreplident from pg_class where oid = 'public.menu_items'::regclass) = 'f', 'Menu changes retain committed scope data');
select ok((select relreplident from pg_class where oid = 'public.payments'::regclass) = 'f', 'Payment changes retain committed scope data');
select ok((select relreplident from pg_class where oid = 'public.discounts'::regclass) = 'f', 'Discount changes retain committed scope data');
select ok((select relreplident from pg_class where oid = 'public.receipts'::regclass) = 'f', 'Receipt changes retain committed scope data');

select * from finish();
rollback;
