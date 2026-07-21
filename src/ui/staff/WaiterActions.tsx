"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WaiterRequest = { id: string; state: string; version: number };

export function WaiterActions({ request }: { request: WaiterRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextState = request.state === "OPEN" ? "CLAIMED" : request.state === "CLAIMED" ? "RESOLVED" : null;
  if (!nextState) return <span className="text-xs text-muted">{request.state}</span>;
  async function transition() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/staff/service-requests/${request.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextState, expectedVersion: request.version, idempotencyKey: crypto.randomUUID() }), cache: "no-store" });
      const body = await response.json() as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "The service request could not be updated.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The service request could not be updated."); } finally { setBusy(false); }
  }
  return <div className="flex flex-col items-end gap-1"><button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={busy} onClick={() => void transition()}>{busy ? "Saving…" : nextState === "CLAIMED" ? "Claim" : "Resolve"}</button>{error && <p className="max-w-48 text-right text-xs text-danger" role="alert">{error}</p>}</div>;
}
