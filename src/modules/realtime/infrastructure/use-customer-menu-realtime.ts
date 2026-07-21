"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/server/supabase/browser";

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";
type CustomerMenuRealtimeState = { status: RealtimeStatus; lastReason: string | null };

type Props = {
  restaurantId: string;
  branchId: string;
  onResync: () => Promise<void>;
};

const MENU_TABLES = ["menu_categories", "menu_items", "menu_item_variants", "modifier_groups", "modifier_options", "menu_item_modifier_groups"] as const;

export function useCustomerMenuRealtime({ restaurantId, branchId, onResync }: Props): CustomerMenuRealtimeState {
  const [state, setState] = useState<CustomerMenuRealtimeState>({ status: "connecting", lastReason: null });
  const onResyncRef = useRef(onResync);
  const resyncInFlightRef = useRef<Promise<void> | null>(null);
  const pendingReasonRef = useRef<string | null>(null);

  useEffect(() => {
    onResyncRef.current = onResync;
  }, [onResync]);

  useEffect(() => {
    let cancelled = false;
    let settleTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let connectedOnce = false;
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel(`customer-menu:${restaurantId}:${branchId}`);

    const authoritativeResync = (reason: string) => {
      if (cancelled) return;
      if (resyncInFlightRef.current) {
        pendingReasonRef.current = reason;
        return;
      }
      const request = onResyncRef.current()
        .then(() => setState((current) => ({ ...current, lastReason: reason })))
        .catch(() => setState({ status: navigator.onLine ? "reconnecting" : "offline", lastReason: `${reason}; authoritative refresh failed` }))
        .finally(() => {
          if (resyncInFlightRef.current === request) resyncInFlightRef.current = null;
          const pendingReason = pendingReasonRef.current;
          pendingReasonRef.current = null;
          if (pendingReason) authoritativeResync(pendingReason);
        });
      resyncInFlightRef.current = request;
    };

    const scheduleResync = (reason: string) => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => authoritativeResync(reason), 350);
    };

    for (const table of MENU_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `branch_id=eq.${branchId}` }, () => scheduleResync(`${table} changed`));
    }
    channel.subscribe((status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        const reconnected = connectedOnce;
        connectedOnce = true;
        setState({ status: "connected", lastReason: reconnected ? "channel reconnected" : "channel subscribed" });
        authoritativeResync(reconnected ? "channel reconnected" : "channel subscribed");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setState({ status: "reconnecting", lastReason: `channel ${status.toLowerCase()}` });
        authoritativeResync(`channel ${status.toLowerCase()}`);
      } else if (status === "CLOSED") {
        setState({ status: "offline", lastReason: "channel closed" });
      }
    });

    fallbackTimer = window.setInterval(() => authoritativeResync("menu polling fallback"), 30_000);
    const handleOffline = () => setState({ status: "offline", lastReason: "browser offline" });
    const handleOnline = () => {
      setState({ status: "reconnecting", lastReason: "browser online; resyncing" });
      authoritativeResync("browser reconnected");
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
  }, [branchId, restaurantId]);

  return state;
}
