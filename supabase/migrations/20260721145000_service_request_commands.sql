begin;

alter table public.service_requests
  add column if not exists priority smallint not null default 2 check (priority between 1 and 3),
  add column if not exists assigned_to uuid references auth.users(id);

create index service_requests_priority_inbox_idx
on public.service_requests (branch_id, state, priority desc, created_at asc);

create or replace function public.create_customer_service_request(
  p_session_id uuid,
  p_request_type text,
  p_note text,
  p_request_id uuid
)
returns table(request_id uuid, version integer, deduplicated boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_existing_id uuid;
  v_existing_version integer;
begin
  if auth.uid() is null or not app_private.is_anonymous_claim() then
    raise exception 'An anonymous customer identity is required.' using errcode = '42501';
  end if;
  if p_request_type not in ('CALL_WAITER', 'CUTLERY', 'WATER', 'BILL', 'OTHER') or length(coalesce(p_note, '')) > 240 then
    raise exception 'Service request fields are invalid.' using errcode = '22023';
  end if;
  select s.restaurant_id, s.branch_id, s.state into v_restaurant_id, v_branch_id, v_state
  from public.dining_sessions s where s.id = p_session_id;
  if not found or not app_private.has_session_grant(p_session_id) then
    raise exception 'This Session cannot accept service requests.' using errcode = '42501';
  end if;
  if v_state in ('CLOSED', 'CANCELLED') then raise exception 'This Session is closed.' using errcode = '42501'; end if;

  select sr.id, sr.version into v_existing_id, v_existing_version
  from public.service_requests sr
  where sr.session_id = p_session_id and sr.request_type = p_request_type and sr.state in ('OPEN', 'CLAIMED')
  order by sr.created_at desc limit 1;
  if found then return query select v_existing_id, v_existing_version, true; return; end if;

  insert into public.service_requests (id, restaurant_id, branch_id, session_id, request_type, note, priority)
  values (p_request_id, v_restaurant_id, v_branch_id, p_session_id, p_request_type, nullif(trim(p_note), ''), case when p_request_type = 'BILL' then 3 when p_request_type = 'CALL_WAITER' then 2 else 1 end);
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_type, action, entity_type, entity_id, reason, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), 'CUSTOMER', 'service_request.created', 'service_request', p_request_id, 'Customer Session capability', jsonb_build_object('requestType', p_request_type, 'state', 'OPEN', 'version', 1), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'service_request.created', 'service_request', p_request_id, 1, jsonb_build_object('sessionId', p_session_id, 'requestType', p_request_type, 'state', 'OPEN', 'version', 1));
  return query select p_request_id, 1, false;
end;
$$;

create or replace function public.transition_service_request(
  p_request_id uuid,
  p_next_state text,
  p_expected_version integer
)
returns table(version integer, state text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_session_id uuid;
  v_current_state text;
  v_current_version integer;
  v_new_version integer;
begin
  select sr.restaurant_id, sr.branch_id, sr.session_id, sr.state, sr.version
  into v_restaurant_id, v_branch_id, v_session_id, v_current_state, v_current_version
  from public.service_requests sr where sr.id = p_request_id for update;
  if not found then raise exception 'Service request not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'order.serve') then
    raise exception 'Service request permission is required.' using errcode = '42501';
  end if;
  if v_current_version <> p_expected_version then raise exception 'This service request changed. Refresh the floor view.' using errcode = 'P0003'; end if;
  if not ((v_current_state = 'OPEN' and p_next_state in ('CLAIMED', 'CANCELLED')) or (v_current_state = 'CLAIMED' and p_next_state in ('RESOLVED', 'CANCELLED'))) then
    raise exception 'The service request transition conflicts with its current state.' using errcode = 'P0001';
  end if;
  v_new_version := v_current_version + 1;
  update public.service_requests sr set state = p_next_state, version = v_new_version, assigned_to = case when p_next_state = 'CLAIMED' then auth.uid() else sr.assigned_to end where sr.id = p_request_id;
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_type, action, entity_type, entity_id, reason, before_masked, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, auth.uid(), 'STAFF', 'service_request.transitioned', 'service_request', p_request_id, 'Authorized waiter command', jsonb_build_object('state', v_current_state, 'version', v_current_version), jsonb_build_object('state', p_next_state, 'version', v_new_version), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'service_request.transitioned', 'service_request', p_request_id, v_new_version, jsonb_build_object('sessionId', v_session_id, 'state', p_next_state, 'version', v_new_version));
  return query select v_new_version, p_next_state;
end;
$$;

revoke all on function public.create_customer_service_request(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.transition_service_request(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_customer_service_request(uuid, text, text, uuid) to authenticated;
grant execute on function public.transition_service_request(uuid, text, integer) to authenticated;

revoke insert, update, delete on public.service_requests from authenticated;
grant select, insert, update, delete on public.service_requests to service_role;

commit;
