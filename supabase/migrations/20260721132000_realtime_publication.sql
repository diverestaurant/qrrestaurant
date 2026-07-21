-- Local Realtime invalidation sources. Database rows remain authoritative;
-- clients must resync through the scoped HTTP queries after every accepted
-- notification, duplicate/gap, reconnect or channel error.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['dining_sessions', 'orders', 'order_items', 'service_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

alter table public.dining_sessions replica identity full;
alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.service_requests replica identity full;
