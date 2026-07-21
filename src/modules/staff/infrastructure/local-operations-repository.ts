import "server-only";

import { AppError } from "@/lib/errors";
import type { AdminOverviewView } from "@/contracts/view-models";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

function minor(value: number | string) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new AppError("INTERNAL_ERROR", "A local financial snapshot contains an invalid amount.");
  return amount;
}

type TableRow = { id: string; label: string; active: boolean; capacity: number; version: number; operational_state: "READY" | "CLEANING" };
type SessionRow = { id: string; table_id: string; state: string; guest_count: number | null; total_due_minor: number | string; total_paid_minor: number | string; currency: string; version: number; opened_at: string };
type RequestRow = { id: string; session_id: string; request_type: "CALL_WAITER" | "CUTLERY" | "WATER" | "BILL" | "OTHER"; state: "OPEN" | "CLAIMED" | "RESOLVED" | "CANCELLED"; version: number; priority: number; assigned_to: string | null; created_at: string };
type OrderRow = { id: string; session_id: string; display_number: number };
type OrderItemRow = { order_id: string; name_snapshot: string; quantity: number; unit_price_minor: number | string };
type PaymentRow = { id: string; session_id: string; state: string; method: string; amount_minor: number | string };
type DiscountRow = { session_id: string; kind: string; discount_minor: number | string; reason: string };
type ReceiptRow = { id: string; session_id: string; receipt_number: string; issued_at: string; reprint_of: string | null };
type ReadyOrderItemRow = { id: string; order_id: string; name_snapshot: string; quantity: number; state: string; version: number };

async function readTables(supabase: ReturnType<typeof getServiceRoleSupabaseClient>, branchId: string) {
  const result = await supabase.from("restaurant_tables").select("id,label,active,capacity,version,operational_state").eq("branch_id", branchId).order("label", { ascending: true });
  if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to read committed table facts.", true);
  return (result.data ?? []) as TableRow[];
}

async function readSessions(supabase: ReturnType<typeof getServiceRoleSupabaseClient>, branchId: string) {
  const result = await supabase.from("dining_sessions").select("id,table_id,state,guest_count,total_due_minor,total_paid_minor,currency,version,opened_at").eq("branch_id", branchId).in("state", ["OPEN", "PAYMENT_REQUESTED", "PAYMENT_PENDING", "PAID"]).order("opened_at", { ascending: true });
  if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to read committed Session facts.", true);
  return (result.data ?? []) as SessionRow[];
}

export type LocalWaiterBoard = {
  tables: Array<{ id: string; label: string; capacity: number; state: string; detail: string; totalDueMinor: number; totalPaidMinor: number; sessionId: string | null; sessionVersion: number | null; sessionState: string | null; tableVersion: number; operationalState: "READY" | "CLEANING"; guestCount: number }>;
  requests: Array<{ id: string; tableLabel: string; requestType: string; state: string; version: number; priority: number; assignedTo: string | null }>;
  readyItems: Array<{ id: string; tableLabel: string; name: string; quantity: number; state: string; version: number }>;
  sessionCount: number;
  lastSyncedAt: string;
};

export async function readLocalWaiterBoard(branchId: string): Promise<LocalWaiterBoard> {
  const supabase = getServiceRoleSupabaseClient();
  const [tables, sessions, requestsResult, ordersResult, activeItemsResult] = await Promise.all([
    readTables(supabase, branchId),
    readSessions(supabase, branchId),
    supabase.from("service_requests").select("id,session_id,request_type,state,version,priority,assigned_to,created_at").eq("branch_id", branchId).in("state", ["OPEN", "CLAIMED"]).order("priority", { ascending: false }).order("created_at", { ascending: true }),
    supabase.from("orders").select("id,session_id,display_number").eq("branch_id", branchId),
    supabase.from("order_items").select("id,order_id,name_snapshot,quantity,state,version").eq("branch_id", branchId).in("state", ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"]).order("created_at", { ascending: true }),
  ]);
  if (requestsResult.error || ordersResult.error || activeItemsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read committed waiter facts.", true);
  const sessionByTable = new Map(sessions.map((session) => [session.table_id, session]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const requests = (requestsResult.data ?? []) as RequestRow[];
  const orderById = new Map(((ordersResult.data ?? []) as OrderRow[]).map((order) => [order.id, order]));
  const activeItems = (activeItemsResult.data ?? []) as ReadyOrderItemRow[];
  const activeItemsBySession = new Map<string, ReadyOrderItemRow[]>();
  for (const item of activeItems) {
    const order = orderById.get(item.order_id);
    if (!order) continue;
    const current = activeItemsBySession.get(order.session_id) ?? [];
    current.push(item);
    activeItemsBySession.set(order.session_id, current);
  }
  const tablesView = tables.filter((table) => table.active).map((table) => {
    const session = sessionByTable.get(table.id);
    const due = session ? minor(session.total_due_minor) : 0;
    const paid = session ? minor(session.total_paid_minor) : 0;
    const kitchenItems = session ? activeItemsBySession.get(session.id) ?? [] : [];
    const state = !session ? table.operational_state === "CLEANING" ? "CLEANING" : "AVAILABLE" : session.state === "PAYMENT_REQUESTED" || session.state === "PAYMENT_PENDING" ? "PAYMENT" : requests.some((request) => request.session_id === session.id) ? "SERVICE REQUEST" : kitchenItems.some((item) => item.state === "READY") ? "READY" : kitchenItems.length > 0 ? "PREPARING" : "ORDERING";
    const detail = !session ? table.operational_state === "CLEANING" ? "Closed Session · table reset required" : "No active Session" : `${session.guest_count ?? 0} guests · ${requests.filter((request) => request.session_id === session.id).length} open request${requests.filter((request) => request.session_id === session.id).length === 1 ? "" : "s"} · ${session.currency} ${((due - paid) / 100).toFixed(2)} outstanding`;
    return { id: table.id, label: table.label, capacity: table.capacity, state, detail, totalDueMinor: due, totalPaidMinor: paid, sessionId: session?.id ?? null, sessionVersion: session?.version ?? null, sessionState: session?.state ?? null, tableVersion: table.version, operationalState: table.operational_state, guestCount: session?.guest_count ?? 0 };
  });
  const readyItems = activeItems.filter((item) => item.state === "READY").map((item) => {
    const order = orderById.get(item.order_id);
    const session = order ? sessionById.get(order.session_id) : undefined;
    return { id: item.id, tableLabel: tableById.get(session?.table_id ?? "")?.label ?? "Table", name: item.name_snapshot, quantity: item.quantity, state: item.state, version: item.version };
  });
  return { tables: tablesView, requests: requests.map((request) => ({ id: request.id, tableLabel: tableById.get(sessionById.get(request.session_id)?.table_id ?? "")?.label ?? "Table", requestType: request.request_type, state: request.state, version: request.version, priority: request.priority, assignedTo: request.assigned_to })), readyItems, sessionCount: sessions.length, lastSyncedAt: new Date().toISOString() };
}

export type LocalCashierBoard = { session: { id: string; tableLabel: string; state: string; guestCount: number; totalDueMinor: number; totalPaidMinor: number; currency: string; version: number } | null; sessions: Array<{ id: string; tableLabel: string; state: string; outstandingMinor: number }>; items: Array<{ name: string; quantity: number; totalMinor: number }>; payments: Array<{ id: string; method: string; state: string; amountMinor: number }>; discounts: Array<{ kind: string; discountMinor: number; reason: string }>; receipt: { id: string; receiptNumber: string; issuedAt: string } | null; lastSyncedAt: string };

export async function readLocalCashierBoard(branchId: string, preferredSessionId?: string): Promise<LocalCashierBoard> {
  const supabase = getServiceRoleSupabaseClient();
  const [tables, sessions, ordersResult, paymentsResult, discountsResult, receiptsResult] = await Promise.all([
    readTables(supabase, branchId),
    readSessions(supabase, branchId),
    supabase.from("orders").select("id,session_id,display_number").eq("branch_id", branchId),
    supabase.from("payments").select("id,session_id,state,method,amount_minor").eq("branch_id", branchId).order("created_at", { ascending: true }),
    supabase.from("discounts").select("session_id,kind,discount_minor,reason").eq("branch_id", branchId).order("created_at", { ascending: true }),
    supabase.from("receipts").select("id,session_id,receipt_number,issued_at,reprint_of").eq("branch_id", branchId).order("issued_at", { ascending: false }),
  ]);
  if (ordersResult.error || paymentsResult.error || discountsResult.error || receiptsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read committed cashier facts.", true);
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const sessionChoices = sessions.map((candidate) => ({ id: candidate.id, tableLabel: tableById.get(candidate.table_id)?.label ?? "Table", state: candidate.state, outstandingMinor: Math.max(0, minor(candidate.total_due_minor) - minor(candidate.total_paid_minor)) }));
  const session = sessions.find((candidate) => candidate.id === preferredSessionId) ?? sessions.find((candidate) => minor(candidate.total_due_minor) > minor(candidate.total_paid_minor)) ?? sessions[0];
  if (!session) return { session: null, sessions: [], items: [], payments: [], discounts: [], receipt: null, lastSyncedAt: new Date().toISOString() };
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const orderIds = orders.filter((order) => order.session_id === session.id).map((order) => order.id);
  const itemsResult = orderIds.length > 0 ? await supabase.from("order_items").select("order_id,name_snapshot,quantity,unit_price_minor").in("order_id", orderIds) : { data: [], error: null };
  if (itemsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read committed bill items.", true);
  const table = tableById.get(session.table_id);
  const receipt = ((receiptsResult.data ?? []) as ReceiptRow[]).find((candidate) => candidate.session_id === session.id && candidate.reprint_of === null);
  return { session: { id: session.id, tableLabel: table?.label ?? "Table", state: session.state, guestCount: session.guest_count ?? 0, totalDueMinor: minor(session.total_due_minor), totalPaidMinor: minor(session.total_paid_minor), currency: session.currency, version: session.version }, sessions: sessionChoices, items: ((itemsResult.data ?? []) as OrderItemRow[]).map((item) => ({ name: item.name_snapshot, quantity: item.quantity, totalMinor: minor(item.unit_price_minor) * item.quantity })), payments: ((paymentsResult.data ?? []) as PaymentRow[]).filter((payment) => payment.session_id === session.id).map((payment) => ({ id: payment.id, method: payment.method, state: payment.state, amountMinor: minor(payment.amount_minor) })), discounts: ((discountsResult.data ?? []) as DiscountRow[]).filter((discount) => discount.session_id === session.id).map((discount) => ({ kind: discount.kind, discountMinor: minor(discount.discount_minor), reason: discount.reason })), receipt: receipt ? { id: receipt.id, receiptNumber: receipt.receipt_number, issuedAt: receipt.issued_at } : null, lastSyncedAt: new Date().toISOString() };
}

export type LocalAdminOverview = AdminOverviewView;

export async function readLocalAdminOverview(branchId: string): Promise<LocalAdminOverview> {
  const supabase = getServiceRoleSupabaseClient();
  const [branchResult, menuResult, categoriesResult, variantsResult, groupsResult, optionsResult, linksResult, tablesResult, sessions, staffResult, rolesResult, rolePermissionsResult, permissionsResult, stationsResult, flagsResult, auditsResult] = await Promise.all([
    supabase.from("branches").select("name").eq("id", branchId).maybeSingle(),
    supabase.from("menu_items").select("id,category_id,name,description,base_price_minor,currency,station_key,visible,available,sort_order,featured,spice_level,tax_eligible,service_eligible,operating_rules,image_path,image_alt,version").eq("branch_id", branchId).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("menu_categories").select("id,name,sort_order,visible,version").eq("branch_id", branchId).order("sort_order", { ascending: true }),
    supabase.from("menu_item_variants").select("id,menu_item_id,name,price_delta_minor,active,sort_order,version").eq("branch_id", branchId).order("sort_order", { ascending: true }),
    supabase.from("modifier_groups").select("id,name,required,min_selections,max_selections,active,version").eq("branch_id", branchId).order("name", { ascending: true }),
    supabase.from("modifier_options").select("id,group_id,name,price_delta_minor,active,sort_order,version").eq("branch_id", branchId).order("sort_order", { ascending: true }),
    supabase.from("menu_item_modifier_groups").select("menu_item_id,group_id,sort_order").eq("branch_id", branchId).order("sort_order", { ascending: true }),
    supabase.from("restaurant_tables").select("id,label,area,capacity,active,version").eq("branch_id", branchId).order("label", { ascending: true }),
    readSessions(supabase, branchId),
    supabase.from("staff_memberships").select("id,user_id,role_id,status,version").eq("branch_id", branchId).order("created_at", { ascending: true }),
    supabase.from("roles").select("id,role_key,display_name").in("role_key", ["MANAGER", "KITCHEN", "WAITER", "CASHIER"]).order("display_name", { ascending: true }),
    supabase.from("role_permissions").select("role_id,permission_id"),
    supabase.from("permissions").select("id,permission_key"),
    supabase.from("kitchen_stations").select("id,station_key,name,active,version").eq("branch_id", branchId).order("sort_order", { ascending: true }),
    supabase.from("feature_flags").select("id,flag_key,description,enabled,version").eq("branch_id", branchId).order("flag_key", { ascending: true }),
    supabase.from("audit_logs").select("id,action,entity_type,entity_id,reason,created_at").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (branchResult.error || menuResult.error || categoriesResult.error || variantsResult.error || groupsResult.error || optionsResult.error || linksResult.error || tablesResult.error || staffResult.error || rolesResult.error || rolePermissionsResult.error || permissionsResult.error || stationsResult.error || flagsResult.error || auditsResult.error || !branchResult.data) throw new AppError("INTERNAL_ERROR", "Unable to read the committed admin overview.", true);
  const variantsByItem = new Map<string, AdminOverviewView["menu"][number]["variants"]>();
  for (const variant of variantsResult.data ?? []) {
    const current = variantsByItem.get(variant.menu_item_id) ?? [];
    current.push({ id: variant.id, name: variant.name, priceDeltaMinor: minor(variant.price_delta_minor), active: variant.active, sortOrder: variant.sort_order, version: variant.version });
    variantsByItem.set(variant.menu_item_id, current);
  }
  const menu = (menuResult.data ?? []).map((item) => ({ id: item.id, categoryId: item.category_id, name: item.name, description: item.description ?? "", basePriceMinor: minor(item.base_price_minor), currency: item.currency, stationKey: item.station_key ?? "", visible: item.visible, available: item.available, sortOrder: item.sort_order, featured: item.featured, spiceLevel: item.spice_level, taxEligible: item.tax_eligible, serviceEligible: item.service_eligible, operatingRules: item.operating_rules && typeof item.operating_rules === "object" && !Array.isArray(item.operating_rules) ? item.operating_rules as Record<string, unknown> : {}, imagePath: item.image_path ?? "", imageAlt: item.image_alt ?? "", version: item.version, variants: variantsByItem.get(item.id) ?? [] }));
  const tables = (tablesResult.data ?? []).map((table) => ({ id: table.id, label: table.label, area: table.area ?? "", capacity: table.capacity, active: table.active, version: table.version }));
  const memberships = (staffResult.data ?? []).map((membership) => ({ id: membership.id, userId: membership.user_id, roleId: membership.role_id, status: membership.status, version: membership.version }));
  const permissionById = new Map((permissionsResult.data ?? []).map((permission) => [permission.id, permission.permission_key]));
  return {
    branchName: branchResult.data.name,
    menuItems: menu.length,
    menu,
    categories: (categoriesResult.data ?? []).map((category) => ({ id: category.id, name: category.name, sortOrder: category.sort_order, visible: category.visible, version: category.version })),
    modifierGroups: (groupsResult.data ?? []).map((group) => ({ id: group.id, name: group.name, required: group.required, minSelections: group.min_selections, maxSelections: group.max_selections, active: group.active, version: group.version, linkedMenuItemIds: (linksResult.data ?? []).filter((link) => link.group_id === group.id).map((link) => link.menu_item_id), options: (optionsResult.data ?? []).filter((option) => option.group_id === group.id).map((option) => ({ id: option.id, name: option.name, priceDeltaMinor: minor(option.price_delta_minor), active: option.active, sortOrder: option.sort_order, version: option.version })) })),
    tables,
    memberships,
    roles: (rolesResult.data ?? []).map((role) => ({ id: role.id, roleKey: role.role_key, displayName: role.display_name, capabilities: (rolePermissionsResult.data ?? []).filter((permission) => permission.role_id === role.id).map((permission) => permissionById.get(permission.permission_id)).filter((permission): permission is string => Boolean(permission)).sort() })),
    stations: (stationsResult.data ?? []).map((station) => ({ id: station.id, stationKey: station.station_key, name: station.name, active: station.active, version: station.version })),
    featureFlags: (flagsResult.data ?? []).map((flag) => ({ id: flag.id, flagKey: flag.flag_key, description: flag.description ?? "", enabled: flag.enabled, version: flag.version })),
    audits: (auditsResult.data ?? []).map((audit) => ({ id: audit.id, action: audit.action, entityType: audit.entity_type, entityId: audit.entity_id, reason: audit.reason ?? "", createdAt: audit.created_at })),
    unavailableItems: menu.filter((item) => !item.available).length,
    activeTables: tables.filter((table) => table.active).length,
    staffMembers: memberships.filter((membership) => membership.status === "ACTIVE").length,
    openSessions: sessions.length,
    lastSyncedAt: new Date().toISOString(),
  };
}
