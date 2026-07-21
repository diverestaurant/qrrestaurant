import "server-only";

import type { KdsQueueView } from "@/contracts/view-models";
import { AppError } from "@/lib/errors";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

type ItemRow = { id: string; order_id: string; name_snapshot: string; quantity: number; state: string; version: number; created_at: string; state_changed_at: string; station_key: string | null; note: string | null; variant_snapshot: unknown; modifier_snapshot: unknown };
type OrderRow = { id: string; display_number: number; session_id: string };
type SessionRow = { id: string; table_id: string };
type TableRow = { id: string; label: string };
type StationRow = { station_key: string; name: string };

function snapshotName(value: unknown) {
  return value && typeof value === "object" && "name" in value && typeof value.name === "string" ? value.name : null;
}

export async function readLocalKdsQueue(branchId: string, requestedStationKey?: string): Promise<KdsQueueView> {
  const supabase = getServiceRoleSupabaseClient();
  const stationsResult = await supabase.from("kitchen_stations").select("station_key,name").eq("branch_id", branchId).eq("active", true).order("sort_order", { ascending: true });
  if (stationsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read kitchen stations.", true);
  const stations = (stationsResult.data ?? []) as StationRow[];
  const stationKey = requestedStationKey === "all" || requestedStationKey === "unassigned" || stations.some((station) => station.station_key === requestedStationKey) ? requestedStationKey! : "all";
  let itemQuery = supabase.from("order_items").select("id,order_id,name_snapshot,quantity,state,version,created_at,state_changed_at,station_key,note,variant_snapshot,modifier_snapshot").eq("branch_id", branchId).in("state", ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"]);
  let completedQuery = supabase.from("order_items").select("id,order_id,name_snapshot,quantity,state,version,created_at,state_changed_at,station_key,note,variant_snapshot,modifier_snapshot").eq("branch_id", branchId).in("state", ["SERVED", "CANCELLED", "REJECTED"]).gte("state_changed_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
  if (stationKey === "unassigned") { itemQuery = itemQuery.is("station_key", null); completedQuery = completedQuery.is("station_key", null); }
  else if (stationKey !== "all") { itemQuery = itemQuery.eq("station_key", stationKey); completedQuery = completedQuery.eq("station_key", stationKey); }
  const [itemResult, completedResult] = await Promise.all([itemQuery.order("created_at", { ascending: true }), completedQuery.order("state_changed_at", { ascending: false }).limit(20)]);
  if (itemResult.error || completedResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the committed kitchen queue.", true);
  const items = (itemResult.data ?? []) as ItemRow[];
  const recentlyCompleted = (completedResult.data ?? []) as ItemRow[];
  const allItems = [...items, ...recentlyCompleted];
  const orderIds = [...new Set(allItems.map((item) => item.order_id))];
  const ordersResult = orderIds.length > 0 ? await supabase.from("orders").select("id,display_number,session_id").in("id", orderIds) : { data: [], error: null };
  if (ordersResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read kitchen order context.", true);
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const sessionIds = [...new Set(orders.map((order) => order.session_id))];
  const sessionsResult = sessionIds.length > 0 ? await supabase.from("dining_sessions").select("id,table_id").in("id", sessionIds) : { data: [], error: null };
  if (sessionsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read kitchen table context.", true);
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const tableIds = [...new Set(sessions.map((session) => session.table_id))];
  const tablesResult = tableIds.length > 0 ? await supabase.from("restaurant_tables").select("id,label").in("id", tableIds) : { data: [], error: null };
  if (tablesResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read kitchen table labels.", true);
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const tablesById = new Map((tablesResult.data ?? [] as TableRow[]).map((table) => [table.id, table as TableRow]));
  const now = Date.now();
  return {
    status: items.length > 0 ? "ready" : "empty",
    freshness: "fresh",
    serverTime: new Date(now).toISOString(),
    lastSyncedAt: new Date(now).toISOString(),
    version: items.reduce((max, item) => Math.max(max, item.version), 0),
    stationKey,
    stationName: stationKey === "all" ? "All stations / Expo" : stationKey === "unassigned" ? "Unassigned" : stations.find((station) => station.station_key === stationKey)?.name ?? "Kitchen queue",
    stations: [{ key: "all", name: "All stations" }, ...stations.map((station) => ({ key: station.station_key, name: station.name })), { key: "unassigned", name: "Unassigned" }],
    items: items.map((item) => {
      const order = ordersById.get(item.order_id);
      const session = order ? sessionsById.get(order.session_id) : undefined;
      const table = session ? tablesById.get(session.table_id) : undefined;
      const modifierLabels = Array.isArray(item.modifier_snapshot) ? item.modifier_snapshot.map(snapshotName).filter((name): name is string => Boolean(name)) : [];
      return { id: item.id, tableLabel: table?.label ?? "Table", name: item.name_snapshot, quantity: item.quantity, state: item.state, elapsedMinutes: Math.max(0, Math.floor((now - Date.parse(item.created_at)) / 60000)), version: item.version, note: item.note, variantLabel: snapshotName(item.variant_snapshot), modifierLabels };
    }),
    recentlyCompleted: recentlyCompleted.map((item) => {
      const order = ordersById.get(item.order_id);
      const session = order ? sessionsById.get(order.session_id) : undefined;
      const table = session ? tablesById.get(session.table_id) : undefined;
      const modifierLabels = Array.isArray(item.modifier_snapshot) ? item.modifier_snapshot.map(snapshotName).filter((name): name is string => Boolean(name)) : [];
      return { id: item.id, tableLabel: table?.label ?? "Table", name: item.name_snapshot, quantity: item.quantity, state: item.state, elapsedMinutes: Math.max(0, Math.floor((now - Date.parse(item.created_at)) / 60000)), version: item.version, note: item.note, variantLabel: snapshotName(item.variant_snapshot), modifierLabels, completedAt: item.state_changed_at };
    }),
  };
}
