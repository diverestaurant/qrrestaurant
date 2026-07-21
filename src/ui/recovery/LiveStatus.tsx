"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Freshness } from "@/contracts/view-models";
import { presentFreshness } from "@/ui/recovery/freshness";

const HEALTH_POLL_INTERVAL_MS = 15_000;
const HEALTH_TIMEOUT_MS = 1_500;

function formatCheckedAt(timestamp: number | null) {
  if (!timestamp) return "Not checked yet";
  return `Checked ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(timestamp)}`;
}

export function LiveStatus({ healthUrl = "/api/health" }: { healthUrl?: string }) {
  const [freshness, setFreshness] = useState<Freshness>("fresh");
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const retryTimeoutRef = useRef<number | null>(null);
  const checkHealthRef = useRef<() => void>(() => undefined);

  const checkHealth = useCallback(async () => {
    if (!mountedRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFreshness("offline");
      return;
    }

    setFreshness((current) => (current === "fresh" ? current : "reconnecting"));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(healthUrl, { cache: "no-store", signal: controller.signal });
      if (!mountedRef.current) return;
      setCheckedAt(Date.now());
      setFreshness(response.ok ? "fresh" : "stale");
    } catch {
      if (!mountedRef.current) return;
      setFreshness(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "stale");
      if (typeof navigator === "undefined" || navigator.onLine) {
        retryTimeoutRef.current = window.setTimeout(() => checkHealthRef.current(), 750);
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, [healthUrl]);

  useEffect(() => {
    mountedRef.current = true;
    checkHealthRef.current = () => void checkHealth();
    const initialCheck = window.setTimeout(() => void checkHealth(), 0);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkHealth();
    }, HEALTH_POLL_INTERVAL_MS);
    const handleOffline = () => setFreshness("offline");
    const handleOnline = () => {
      setFreshness("reconnecting");
      void checkHealth();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setFreshness((current) => (current === "offline" ? "reconnecting" : current));
        void checkHealth();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      if (retryTimeoutRef.current !== null) window.clearTimeout(retryTimeoutRef.current);
      checkHealthRef.current = () => undefined;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkHealth]);

  const presentation = presentFreshness(freshness);
  const dotClass = freshness === "fresh" ? "bg-emerald-500" : freshness === "reconnecting" ? "bg-sky-500" : "bg-amber-500";

  return (
    <div className="flex items-center gap-2 text-xs text-muted" role="status" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span title={`${presentation.detail} · ${formatCheckedAt(checkedAt)}`}>{presentation.label}</span>
      {freshness !== "fresh" && (
        <button className="rounded-full border px-2 py-1 font-semibold hover:bg-background" onClick={() => window.location.reload()}>
          Refresh
        </button>
      )}
    </div>
  );
}
