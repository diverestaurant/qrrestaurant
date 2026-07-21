begin;

create or replace function public.issue_receipt(
  p_session_id uuid,
  p_actor_id uuid
)
returns table(receipt_id uuid, receipt_number text, snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_state public.session_state;
  v_business_date date;
  v_total_due_minor bigint;
  v_total_paid_minor bigint;
  v_currency char(3);
  v_receipt_id uuid;
  v_receipt_number text;
  v_sequence bigint;
  v_snapshot jsonb;
begin
  if p_actor_id is distinct from v_actor_id then
    raise exception 'The receipt actor does not match the authenticated staff actor.' using errcode = '42501';
  end if;
  select s.restaurant_id, s.branch_id, s.state, s.business_date, s.total_due_minor, s.total_paid_minor, s.currency
    into v_restaurant_id, v_branch_id, v_state, v_business_date, v_total_due_minor, v_total_paid_minor, v_currency
  from public.dining_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Session not found.' using errcode = 'P0002'; end if;
  if not app_private.has_branch_permission(v_branch_id, 'receipt.issue') then
    raise exception 'Receipt permission is required.' using errcode = '42501';
  end if;
  if v_state not in ('PAID', 'CLOSED') or v_total_paid_minor <> v_total_due_minor then
    raise exception 'A fully paid Session is required before issuing a receipt.' using errcode = 'P0001';
  end if;
  select r.id, r.receipt_number, r.snapshot into v_receipt_id, v_receipt_number, v_snapshot
  from public.receipts r
  where r.session_id = p_session_id and r.reprint_of is null;
  if found then return query select v_receipt_id, v_receipt_number, v_snapshot; return; end if;

  perform pg_advisory_xact_lock(hashtextextended(('receipt:' || v_branch_id::text), 0));
  select count(*) + 1 into v_sequence
  from public.receipts r
  where r.branch_id = v_branch_id
    and r.receipt_number like to_char(v_business_date, 'YYYYMMDD') || '-%';
  v_receipt_id := gen_random_uuid();
  v_receipt_number := to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_sequence::text, 6, '0');
  v_snapshot := jsonb_build_object(
    'snapshotVersion', 1,
    'receiptNumber', v_receipt_number,
    'sessionId', p_session_id,
    'businessDate', v_business_date,
    'currency', v_currency,
    'restaurant', (select jsonb_build_object(
      'name', restaurant.name,
      'legalName', settings.legal_name,
      'registrationNumber', settings.registration_number,
      'taxRegistrationNumber', settings.tax_registration_number,
      'contactPhone', settings.contact_phone,
      'contactEmail', settings.contact_email,
      'receiptFooter', settings.receipt_footer
    ) from public.restaurants restaurant join public.restaurant_settings settings on settings.restaurant_id = restaurant.id where restaurant.id = v_restaurant_id),
    'branch', (select jsonb_build_object(
      'name', branch.name,
      'addressLine1', settings.address_line_1,
      'addressLine2', settings.address_line_2,
      'city', settings.city,
      'postalCode', settings.postal_code,
      'countryCode', settings.country_code,
      'contactPhone', settings.contact_phone,
      'contactEmail', settings.contact_email
    ) from public.branches branch join public.branch_settings settings on settings.branch_id = branch.id where branch.id = v_branch_id),
    'tableLabel', (select restaurant_table.label from public.dining_sessions session_row join public.restaurant_tables restaurant_table on restaurant_table.id = session_row.table_id where session_row.id = p_session_id),
    'totalDueMinor', v_total_due_minor,
    'totalPaidMinor', v_total_paid_minor,
    'discounts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'discountMinor', d.discount_minor, 'reason', d.reason) order by d.created_at, d.id) from public.discounts d where d.session_id = p_session_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'displayNumber', o.display_number, 'totalMinor', o.total_minor, 'items', coalesce((select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity, 'unitPriceMinor', oi.unit_price_minor, 'variant', oi.variant_snapshot, 'modifiers', oi.modifier_snapshot) order by oi.created_at, oi.id) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb)) order by o.created_at, o.id) from public.orders o where o.session_id = p_session_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'method', p.method, 'amountMinor', p.amount_minor, 'cashReceivedMinor', p.cash_received_minor, 'changeMinor', p.change_minor, 'reference', p.observed_reference) order by p.created_at, p.id) from public.payments p where p.session_id = p_session_id and p.state = 'CONFIRMED'), '[]'::jsonb),
    'issuedAt', now()
  );
  insert into public.receipts (id, restaurant_id, branch_id, session_id, receipt_number, snapshot, issued_by)
  values (v_receipt_id, v_restaurant_id, v_branch_id, p_session_id, v_receipt_number, v_snapshot, v_actor_id);
  insert into public.audit_logs (restaurant_id, branch_id, actor_id, actor_role, action, entity_type, entity_id, after_masked, correlation_id)
  values (v_restaurant_id, v_branch_id, v_actor_id, 'STAFF', 'receipt.issued', 'receipt', v_receipt_id, jsonb_build_object('receiptNumber', v_receipt_number, 'sessionId', p_session_id, 'totalPaidMinor', v_total_paid_minor), gen_random_uuid());
  insert into public.outbox_events (restaurant_id, branch_id, event_type, entity_type, entity_id, entity_version, payload)
  values (v_restaurant_id, v_branch_id, 'receipt.issued', 'receipt', v_receipt_id, (select version from public.dining_sessions where id = p_session_id), jsonb_build_object('receiptId', v_receipt_id, 'receiptNumber', v_receipt_number, 'sessionId', p_session_id));
  return query select v_receipt_id, v_receipt_number, v_snapshot;
end;
$$;

revoke all on function public.issue_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_receipt(uuid, uuid) to authenticated;

commit;
