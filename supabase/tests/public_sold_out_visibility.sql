begin;

select plan(6);

update public.menu_items set available = false where id = '00000000-0000-4000-8000-000000000401';

set local role anon;
select is((select count(*)::integer from public.menu_items where id = '00000000-0000-4000-8000-000000000401'), 1, 'anonymous menu readers can see a visible sold-out item');
select is((select available from public.menu_items where id = '00000000-0000-4000-8000-000000000401'), false, 'sold-out state is exposed as non-sensitive menu metadata');
select is((select count(*)::integer from public.menu_item_modifier_groups where menu_item_id = '00000000-0000-4000-8000-000000000401'), 1, 'sold-out item keeps its public modifier configuration for display');
select is((select count(*)::integer from public.menu_items where id = '00000000-0000-4000-8000-000000000403'), 0, 'invisible staff fixture remains hidden from anonymous readers');

set local role postgres;
update public.restaurants set status = 'SUSPENDED' where id = '00000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*)::integer from public.menu_items where branch_id = '00000000-0000-4000-8000-000000000002'), 0, 'suspended Restaurant hides sold-out and available menu items');

set local role postgres;
update public.restaurants set status = 'ACTIVE' where id = '00000000-0000-4000-8000-000000000001';
update public.branches set status = 'SUSPENDED' where id = '00000000-0000-4000-8000-000000000002';
set local role anon;
select is((select count(*)::integer from public.menu_items where branch_id = '00000000-0000-4000-8000-000000000002'), 0, 'suspended Branch hides sold-out and available menu items');

select * from finish();
rollback;
