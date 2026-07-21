-- Staff branch workspaces use these tables as scoped invalidation sources.
-- RLS remains the authorization boundary; browsers still resync through the
-- repository-backed server page/query after every accepted notification.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['menu_items', 'payments', 'discounts', 'receipts'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

alter table public.menu_items replica identity full;
alter table public.payments replica identity full;
alter table public.discounts replica identity full;
alter table public.receipts replica identity full;
