grant select on public.restaurants, public.branches to anon, authenticated;

create policy restaurants_public_select on public.restaurants
for select to anon, authenticated
using (status = 'ACTIVE');

create policy branches_public_select on public.branches
for select to anon, authenticated
using (
  status = 'ACTIVE'
  and exists (
    select 1
    from public.restaurants r
    where r.id = branches.restaurant_id
      and r.status = 'ACTIVE'
  )
);
