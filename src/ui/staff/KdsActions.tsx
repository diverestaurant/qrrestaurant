"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type KdsTicket = { id: string; state: string; version: number; name: string };

export function KdsActions({ ticket }: { ticket: KdsTicket }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const nextState = ticket.state === "SUBMITTED" ? "ACCEPTED" : ticket.state === "ACCEPTED" ? "PREPARING" : ticket.state === "PREPARING" ? "READY" : null;
  if (!nextState) return <p className="text-xs text-muted">No next kitchen action.</p>;
  async function transition(targetState: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/staff/kds/items/${ticket.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextState: targetState, expectedVersion: ticket.version, idempotencyKey: crypto.randomUUID(), ...(targetState === "REJECTED" ? { reason: reason.trim() } : {}) }), cache: "no-store" });
      const body = await response.json() as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "The kitchen transition could not be completed.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The kitchen transition could not be completed."); } finally { setBusy(false); }
  }
  return <div className="space-y-2"><button className="min-h-12 flex-1 rounded-full bg-brand px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={busy} onClick={() => void transition(nextState)}>{busy ? "Saving…" : `Move to ${nextState}`}</button>{ticket.state === "SUBMITTED" && <div className="flex flex-col gap-2"><label className="text-xs text-muted">Rejection reason<input className="mt-1 min-h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="min-h-10 rounded-full border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:text-slate-400" disabled={busy || reason.trim().length < 3} onClick={() => void transition("REJECTED")}>Reject item</button></div>}{error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}</div>;
}
