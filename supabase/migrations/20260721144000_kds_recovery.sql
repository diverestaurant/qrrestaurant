begin;

alter table public.order_items
  add column if not exists state_changed_at timestamptz not null default now();

create or replace function app_private.capture_order_item_state_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.state is distinct from old.state then new.state_changed_at := now(); end if;
  return new;
end;
$$;

revoke all on function app_private.capture_order_item_state_change() from public, anon, authenticated;

create trigger order_item_capture_state_change
before update of state on public.order_items
for each row execute function app_private.capture_order_item_state_change();

create index order_items_kds_recovery_idx
on public.order_items (branch_id, station_key, state, state_changed_at desc);

commit;
