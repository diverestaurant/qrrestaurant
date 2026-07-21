begin;
select plan(4);
select ok(to_regprocedure('app_private.audit_menu_availability()') is not null, 'menu availability audit function exists');
select ok(exists (select 1 from pg_trigger where tgname = 'menu_item_availability_audit'), 'menu availability audit trigger exists');
update public.menu_items set available = false, version = version + 1 where id = '00000000-0000-4000-8000-000000000401';
select is((select count(*)::integer from public.audit_logs where action = 'menu.item.availability_changed' and entity_id = '00000000-0000-4000-8000-000000000401'), 1, 'availability change creates one audit event');
select is((select count(*)::integer from public.outbox_events where event_type = 'menu.item.availability_changed' and entity_id = '00000000-0000-4000-8000-000000000401'), 1, 'availability change creates one outbox event');
select * from finish();
rollback;
