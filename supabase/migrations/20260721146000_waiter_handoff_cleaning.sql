begin;

alter table public.restaurant_tables
  add column if not exists operational_state text not null default 'READY'
  check (operational_state in ('READY', 'CLEANING'));

create index restaurant_tables_operational_idx
on public.restaurant_tables (branch_id, active, operational_state, label);

create or replace function app_private.require_ready_table_for_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.restaurant_tables rt
    where rt.id = new.table_id and rt.restaurant_id = new.restaurant_id and rt.branch_id = new.branch_id
      and rt.active and rt.operational_state = 'READY'
  ) then raise exception 'The table is inactive or still being cleaned.' using errcode = 'P0001'; end if;
  return new;
end;
$$;

revoke all on function app_private.require_ready_table_for_session() from public, anon, authenticated;
create trigger dining_session_require_ready_table
before insert on public.dining_sessions
for each row execute function app_private.require_ready_table_for_session();

create or replace function app_private.mark_table_cleaning_after_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.state in ('CLOSED', 'CANCELLED') and old.state is distinct from new.state then
    update public.restaurant_tables rt
    set operational_state = 'CLEANING', version = rt.version + 1, updated_at = now()
    where rt.id = new.table_id;
  end if;
  return new;
end;
$$;

revoke all on function app_private.mark_table_cleaning_after_session() from public, anon, authenticated;
create trigger dining_session_marks_table_cleaning
after update of state on public.dining_sessions
for each row execute function app_private.mark_table_cleaning_after_session();

create or replace function public.request_session_payment(
  p_session_id uuid,
  p_expected_version integer
)
returns table(version integer, state public.session_state)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_version integer;
  v_new_version integer;
begin
  select s.restaurant_id, s.branch_id, s.state, s.version into v_restaurant_id, v_branch_id, v_state, v_version
  from public.dining_sessions s where s.id = p_session_id for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'order.serve') then raise exception 'Payment handoff permission is required.' using errcode = '42501'; end if;
  if v_version <> p_expected_version then raise exception 'The Session changed. Refresh before requesting payment.' using errcode = 'P0003'; end if;
  if v_state <> 'OPEN' then raise exception 'Only an open Session can request payment.' using errcode = 'P0001'; end if;
  if exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where o.session_id = p_session_id and oi.state in ('SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY')
  ) then raise exception 'Serve or resolve every active order item before requesting payment.' using errcode = 'P0001'; end if;
  v_new_version := v_version + 1;
  update public.dining_sessions s set state = 'PAYMENT_REQUESTED', version = v_new_version where s.id = p_session_id;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_type, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), 'STAFF', 'session.payment_requested', 'dining_session', p_session_id, 'Waiter cashier handoff', jsonb_build_object('state', v_state, 'version', v_version), jsonb_build_object('state', 'PAYMENT_REQUESTED', 'version', v_new_version), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'session.payment_requested', 'dining_session', p_session_id, v_new_version, jsonb_build_object('sessionId', p_session_id, 'state', 'PAYMENT_REQUESTED', 'version', v_new_version));
  return query select v_new_version, 'PAYMENT_REQUESTED'::public.session_state;
end;
$$;

create or replace function public.mark_restaurant_table_ready(
  p_table_id uuid,
  p_expected_version integer
)
returns table(version integer, operational_state text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_branch_id uuid;
  v_version integer;
  v_operational_state text;
  v_new_version integer;
begin
  select rt.branch_id, rt.version, rt.operational_state into v_branch_id, v_version, v_operational_state
  from public.restaurant_tables rt where rt.id = p_table_id and rt.active for update;
  if not found then raise exception 'Active table not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'order.serve') then raise exception 'Table-ready permission is required.' using errcode = '42501'; end if;
  if v_version <> p_expected_version then raise exception 'The table changed. Refresh before marking it ready.' using errcode = 'P0003'; end if;
  if v_operational_state <> 'CLEANING' then raise exception 'Only a cleaning table can be marked ready.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.dining_sessions s where s.table_id = p_table_id and s.state in ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PENDING', 'PAID')) then
    raise exception 'The table still has an active Session.' using errcode = 'P0001';
  end if;
  v_new_version := v_version + 1;
  update public.restaurant_tables rt set operational_state = 'READY', version = v_new_version, updated_at = now() where rt.id = p_table_id;
  return query select v_new_version, 'READY'::text;
end;
$$;

revoke all on function public.request_session_payment(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_restaurant_table_ready(uuid, integer) from public, anon, authenticated;
grant execute on function public.request_session_payment(uuid, integer) to authenticated;
grant execute on function public.mark_restaurant_table_ready(uuid, integer) to authenticated;

commit;
