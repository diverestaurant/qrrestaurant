"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/modules/realtime/contracts/events";
import { BoundedEventDeduper, reconcileEvent } from "@/modules/realtime/domain/reconcile-event";
import { getBrowserSupabaseClient } from "@/server/supabase/browser";

type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";
type RealtimeRow = Record<string, unknown>;
type PostgresChangePayload = { eventType: string; new: RealtimeRow; old: RealtimeRow };

type CustomerSessionRealtimeProps = {
  sessionId: string | null;
  restaurantId: string | null;
  branchId: string | null;
  sessionVersion: number;
  entityVersions: Readonly<Record<string, number>>;
  onResync: () => Promise<void>;
};

type CustomerSessionRealtimeState = { status: RealtimeStatus; lastReason: string | null };

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function positiveInteger(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function recordForPayload(payload: PostgresChangePayload) {
  return payload.eventType === "DELETE" ? payload.old : payload.new;
}

function toScopedEvent(table: string, payload: PostgresChangePayload, sessionId: string): RealtimeEvent | null {
  const record = recordForPayload(payload);
  const id = stringValue(record.id);
  const restaurantId = stringValue(record.restaurant_id);
  const branchId = stringValue(record.branch_id);
  const version = positiveInteger(record.version);
  const belongsToSession = table === "dining_sessions" ? id === sessionId : stringValue(record.session_id) === sessionId;
  if (!id || !restaurantId || !branchId || !version || !belongsToSession) return null;

  const entityType = table === "dining_sessions" ? "dining_session" : table === "orders" ? "order" : "service_request";
  const eventType = `${table}.${payload.eventType.toLowerCase()}`;
  const eventId = `${table}:${id}:${version}:${payload.eventType}`;
  return { eventId, eventType, schemaVersion: 1, restaurantId, branchId, entityType, entityId: id, entityVersion: version, correlationId: eventId };
}

export function useCustomerSessionRealtime({ sessionId, restaurantId, branchId, sessionVersion, entityVersions, onResync }: CustomerSessionRealtimeProps): CustomerSessionRealtimeState {
  const [state, setState] = useState<CustomerSessionRealtimeState>({ status: sessionId ? "connecting" : "idle", lastReason: null });
  const onResyncRef = useRef(onResync);
  const resyncInFlightRef = useRef<Promise<void> | null>(null);
  const wasConnectedRef = useRef(false);
  const sessionVersionRef = useRef(sessionVersion);
  const entityVersionsRef = useRef(entityVersions);

  useEffect(() => {
    onResyncRef.current = onResync;
    sessionVersionRef.current = sessionVersion;
    entityVersionsRef.current = entityVersions;
  }, [entityVersions, onResync, sessionVersion]);

  useEffect(() => {
    if (!sessionId || !restaurantId || !branchId) return;

    let cancelled = false;
    const deduper = new BoundedEventDeduper();
    const scope = { restaurantId, branchId };
    const seenEventIds = new Set<string>();
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel(`customer-session:${sessionId}`);
    let settleTimer: number | null = null;
    let fallbackTimer: number | null = null;

    const authoritativeResync = (reason: string) => {
      if (cancelled || resyncInFlightRef.current) return;
      const request = onResyncRef.current().catch(() => undefined).finally(() => {
        if (resyncInFlightRef.current === request) resyncInFlightRef.current = null;
      });
      resyncInFlightRef.current = request;
      setState((current) => ({ ...current, lastReason: reason }));
    };

    const scheduleSettledResync = () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => authoritativeResync("channel settled"), 750);
    };

    fallbackTimer = window.setInterval(() => authoritativeResync("realtime polling fallback"), 5_000);

    const handleChange = (table: string, payload: PostgresChangePayload) => {
      const event = toScopedEvent(table, payload, sessionId);
      if (!event) return;
      const localEntityVersion = event.entityType === "dining_session" ? sessionVersionRef.current : entityVersionsRef.current[event.entityId] ?? 0;
      const decision = reconcileEvent({ event, scope, localEntityVersion, seenEventIds });
      if (decision.kind === "reject") return;
      if (decision.kind === "ignore" && decision.reason === "duplicate_event") return;
      seenEventIds.add(event.eventId);
      const evicted = deduper.remember(event.eventId);
      if (evicted) seenEventIds.delete(evicted);
      authoritativeResync(`database ${event.eventType} · ${decision.reason}`);
    };

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_sessions", filter: `id=eq.${sessionId}` }, (payload) => handleChange("dining_sessions", payload as PostgresChangePayload))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `session_id=eq.${sessionId}` }, (payload) => handleChange("orders", payload as PostgresChangePayload))
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests", filter: `session_id=eq.${sessionId}` }, (payload) => handleChange("service_requests", payload as PostgresChangePayload))
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          const reconnect = wasConnectedRef.current;
          wasConnectedRef.current = true;
          setState({ status: "connected", lastReason: reconnect ? "channel reconnected" : "channel subscribed" });
          authoritativeResync(reconnect ? "channel reconnected" : "channel subscribed");
          scheduleSettledResync();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setState({ status: "reconnecting", lastReason: `channel ${status.toLowerCase()}` });
          authoritativeResync(`channel ${status.toLowerCase()}`);
        } else if (status === "CLOSED") {
          setState({ status: "offline", lastReason: "channel closed" });
          authoritativeResync("channel closed");
        }
      });

    const handleOffline = () => {
      setState({ status: "offline", lastReason: "browser offline" });
    };
    const handleOnline = () => {
      setState({ status: "reconnecting", lastReason: "browser online; resyncing" });
      authoritativeResync("browser reconnected");
      channel.subscribe();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [branchId, restaurantId, sessionId]);

  return !sessionId || !restaurantId || !branchId ? { status: "idle", lastReason: null } : state.status === "idle" ? { status: "connecting", lastReason: state.lastReason } : state;
}
