begin;

-- Sold-out items remain visible to diners so the UI can explain availability;
-- transactional order submission still requires available=true and remains the
-- authoritative enforcement point.
drop policy if exists menu_items_public_select on public.menu_items;
create policy menu_items_public_select on public.menu_items
for select to anon, authenticated
using (
  visible
  and exists (
    select 1 from public.branches b
    join public.restaurants r on r.id = b.restaurant_id
    where b.id = menu_items.branch_id
      and b.restaurant_id = menu_items.restaurant_id
      and b.status = 'ACTIVE'
      and r.status = 'ACTIVE'
  )
);

drop policy if exists item_groups_public_select on public.menu_item_modifier_groups;
create policy item_groups_public_select on public.menu_item_modifier_groups
for select to anon, authenticated
using (
  exists (
    select 1
    from public.menu_items mi
    join public.branches b on b.id = mi.branch_id and b.restaurant_id = mi.restaurant_id
    join public.restaurants r on r.id = mi.restaurant_id
    join public.modifier_groups mg on mg.id = menu_item_modifier_groups.group_id
      and mg.branch_id = menu_item_modifier_groups.branch_id
      and mg.restaurant_id = menu_item_modifier_groups.restaurant_id
      and mg.active
    where mi.id = menu_item_modifier_groups.menu_item_id
      and mi.branch_id = menu_item_modifier_groups.branch_id
      and mi.restaurant_id = menu_item_modifier_groups.restaurant_id
      and mi.visible
      and b.status = 'ACTIVE'
      and r.status = 'ACTIVE'
  )
);

commit;
