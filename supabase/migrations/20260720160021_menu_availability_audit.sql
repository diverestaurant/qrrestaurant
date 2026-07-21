create or replace function app_private.audit_menu_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.available is distinct from old.available then
    insert into public.audit_logs (
      restaurant_id,
      branch_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      reason,
      before_masked,
      after_masked,
      correlation_id
    ) values (
      new.restaurant_id,
      new.branch_id,
      auth.uid(),
      'menu.item.availability_changed',
      'menu_item',
      new.id,
      'Manual menu availability change',
      jsonb_build_object('available', old.available, 'version', old.version),
      jsonb_build_object('available', new.available, 'version', new.version),
      gen_random_uuid()
    );

    insert into public.outbox_events (
      restaurant_id,
      branch_id,
      event_type,
      entity_type,
      entity_id,
      entity_version,
      payload
    ) values (
      new.restaurant_id,
      new.branch_id,
      'menu.item.availability_changed',
      'menu_item',
      new.id,
      new.version,
      jsonb_build_object('menuItemId', new.id, 'available', new.available, 'version', new.version)
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.audit_menu_availability() from public, anon, authenticated;

create trigger menu_item_availability_audit
after update of available on public.menu_items
for each row
execute function app_private.audit_menu_availability();
