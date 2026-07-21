begin;

select plan(6);

select has_column('public', 'order_items', 'state_changed_at', 'order items retain state transition time');
select ok(exists (select 1 from pg_trigger where tgname = 'order_item_capture_state_change' and not tgisinternal), 'state transition timestamp trigger exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'order_items' and indexname = 'order_items_kds_recovery_idx'), 'KDS recovery query has a scoped index');

update public.order_items set state_changed_at = '2020-01-01T00:00:00Z' where id = '00000000-0000-4000-8000-000000000704';
update public.order_items set state = 'ACCEPTED' where id = '00000000-0000-4000-8000-000000000704';
select ok((select state_changed_at > '2020-01-01T00:00:00Z' from public.order_items where id = '00000000-0000-4000-8000-000000000704'), 'state transition advances state_changed_at');

update public.order_items set state_changed_at = '2021-01-01T00:00:00Z' where id = '00000000-0000-4000-8000-000000000704';
update public.order_items set note = 'Non-state edit' where id = '00000000-0000-4000-8000-000000000704';
select is((select state_changed_at from public.order_items where id = '00000000-0000-4000-8000-000000000704'), '2021-01-01T00:00:00Z'::timestamptz, 'non-state edit preserves transition time');
select is((select count(*)::integer from public.order_items where branch_id = '00000000-0000-4000-8000-000000000002' and state_changed_at >= now() - interval '30 minutes'), 0, 'recent-completion window excludes old transition facts deterministically');

select * from finish();
rollback;
