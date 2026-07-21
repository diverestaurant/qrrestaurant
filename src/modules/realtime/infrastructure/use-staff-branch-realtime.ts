"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/server/supabase/browser";
import type { RealtimeEvent } from "@/modules/realtime/contracts/events";
import { BoundedEventDeduper, reconcileEvent } from "@/modules/realtime/domain/reconcile-event";

type StaffRealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";
type RealtimeRow = Record<string, unknown>;
type ChangePayload = { eventType: string; commit_timestamp?: string; new: RealtimeRow; old: RealtimeRow };
type StaffBranchRealtimeProps = { restaurantId: string | null; branchId: string | null; onResync: () => void };

const tables = ["dining_sessions", "orders", "order_items", "service_requests", "menu_items", "payments", "discounts", "receipts"] as const;

function value(value: unknown) { return typeof value === "string" && value.length > 0 ? value : null; }
function recordFor(payload: ChangePayload) { return payload.eventType === "DELETE" ? payload.old : payload.new; }

function toScopedEvent(table: string, payload: ChangePayload, scope: { restaurantId: string; branchId: string }): RealtimeEvent | null {
  const record = recordFor(payload);
  const id = value(record.id);
  const restaurantId = value(record.restaurant_id);
  const branchId = value(record.branch_id);
  if (!id || restaurantId !== scope.restaurantId || branchId !== scope.branchId) return null;
  const versionValue = typeof record.version === "number" && Number.isInteger(record.version) && record.version > 0 ? record.version : 1;
  const eventId = `${table}:${id}:${payload.eventType}:${payload.commit_timestamp ?? "unknown"}`;
  return { eventId, eventType: `${table}.${payload.eventType.toLowerCase()}`, schemaVersion: 1, restaurantId, branchId, entityType: table, entityId: id, entityVersion: versionValue, correlationId: eventId };
}

export function useStaffBranchRealtime({ restaurantId, branchId, onResync }: StaffBranchRealtimeProps) {
  const [status, setStatus] = useState<StaffRealtimeStatus>(restaurantId && branchId ? "connecting" : "idle");
  const onResyncRef = useRef(onResync);
  useEffect(() => { onResyncRef.current = onResync; }, [onResync]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    let cancelled = false;
    const scope = { restaurantId, branchId };
    const seen = new Set<string>();
    const deduper = new BoundedEventDeduper();
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel(`staff-branch:${branchId}`);
    let fallbackTimer: number | null = null;
    const resync = () => { if (!cancelled) onResyncRef.current(); };
    const handleChange = (table: string, payload: ChangePayload) => {
      const event = toScopedEvent(table, payload, scope);
      if (!event) return;
      const decision = reconcileEvent({ event, scope, localEntityVersion: 0, seenEventIds: seen });
      if (decision.kind === "reject" || (decision.kind === "ignore" && decision.reason === "duplicate_event")) return;
      seen.add(event.eventId);
      const evicted = deduper.remember(event.eventId);
      if (evicted) seen.delete(evicted);
      resync();
    };
    for (const table of tables) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `branch_id=eq.${branchId}` }, (payload) => handleChange(table, payload as ChangePayload));
    channel.subscribe((nextStatus) => {
      if (cancelled) return;
      if (nextStatus === "SUBSCRIBED") { setStatus("connected"); resync(); }
      else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") { setStatus("reconnecting"); resync(); }
      else if (nextStatus === "CLOSED") { setStatus("offline"); resync(); }
    });
    fallbackTimer = window.setInterval(resync, 5_000);
    const offline = () => setStatus("offline");
    const online = () => { setStatus("reconnecting"); resync(); channel.subscribe(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { cancelled = true; if (fallbackTimer !== null) window.clearInterval(fallbackTimer); window.removeEventListener("offline", offline); window.removeEventListener("online", online); void supabase.removeChannel(channel); };
  }, [branchId, restaurantId]);

  return !restaurantId || !branchId ? "idle" : status === "idle" ? "connecting" : status;
}
