"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type WaiterTable = { id: string; label: string; capacity: number; sessionId: string | null; sessionVersion: number | null; sessionState: string | null; tableVersion: number; operationalState: "READY" | "CLEANING"; state: string };
type SessionResult = { sessionId: string; version: number; joinCode: string; expiresAt: string };

export function WaiterSessionActions({ tables }: { tables: WaiterTable[] }) {
  const router = useRouter();
  const keys = useRef<Record<string, string>>({});
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [guestCount, setGuestCount] = useState("2");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = tables.find((table) => table.id === tableId) ?? tables[0];

  async function execute(kind: "open" | "rotate" | "request-payment" | "ready") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    keys.current[kind] ??= crypto.randomUUID();
    try {
      const path = kind === "open" ? "/api/v1/staff/sessions" : kind === "rotate" ? `/api/v1/staff/sessions/${selected.sessionId}/join-code` : kind === "request-payment" ? `/api/v1/staff/sessions/${selected.sessionId}/payment-request` : `/api/v1/staff/tables/${selected.id}/ready`;
      const payload = kind === "open"
        ? { tableId: selected.id, guestCount: Number(guestCount), idempotencyKey: keys.current[kind] }
        : kind === "ready"
          ? { expectedVersion: selected.tableVersion, idempotencyKey: keys.current[kind] }
          : kind === "request-payment"
            ? { expectedVersion: selected.sessionVersion, idempotencyKey: keys.current[kind] }
            : { expectedSessionVersion: selected.sessionVersion, idempotencyKey: keys.current[kind] };
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
      const body = await response.json() as { ok: boolean; data?: Partial<SessionResult> & { state?: string; operational_state?: string }; error?: { code?: string; message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "The Session command could not be completed.");
      delete keys.current[kind];
      setUncertain(false);
      if ((kind === "open" || kind === "rotate") && body.data.joinCode && body.data.expiresAt && body.data.sessionId && body.data.version) setResult(body.data as SessionResult);
      else setResult(null);
      setFeedback(kind === "request-payment" ? "Cashier handoff committed." : kind === "ready" ? "Table marked ready for the next Session." : null);
      router.refresh();
    } catch (caught) {
      if (caught instanceof TypeError) {
        setUncertain(true);
        setError("Outcome unknown. Refresh the floor before retrying this same command.");
      } else {
        delete keys.current[kind];
        setError(caught instanceof Error ? caught.message : "The Session command could not be completed.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (tables.length === 0) return <p className="rounded-2xl bg-background p-4 text-sm text-muted">No active tables are configured.</p>;
  const canOpen = !selected.sessionId && selected.operationalState === "READY";
  return <section className="mt-8 rounded-3xl border bg-surface p-5 shadow-sm" aria-labelledby="waiter-session-actions"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Session control</p><h2 id="waiter-session-actions" className="mt-2 text-xl font-semibold">Open, hand off, or reset a table Session</h2></div><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => router.refresh()}>Refresh floor</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="text-sm">Table<select className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain} value={selected.id} onChange={(event) => { setTableId(event.target.value); setResult(null); setFeedback(null); }}>{tables.map((table) => <option key={table.id} value={table.id}>{table.label} · {table.state}</option>)}</select></label><label className="text-sm">Guests<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain || selected.sessionId !== null || selected.operationalState === "CLEANING"} inputMode="numeric" min={1} max={selected.capacity} type="number" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} /></label><div className="flex items-end"><button className="min-h-11 w-full rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy || (!selected.sessionId && (!canOpen || Number(guestCount) < 1 || Number(guestCount) > selected.capacity))} onClick={() => void execute(selected.sessionId ? "rotate" : "open")}>{busy ? "Saving…" : uncertain ? "Retry same command" : selected.sessionId ? "Rotate Join Code" : selected.operationalState === "CLEANING" ? "Cleaning in progress" : "Open Session"}</button></div></div><div className="mt-4 flex flex-wrap gap-3">{selected.sessionId && selected.sessionState === "OPEN" && <button className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={busy || uncertain} onClick={() => void execute("request-payment")}>Request payment / Cashier handoff</button>}{!selected.sessionId && selected.operationalState === "CLEANING" && <button className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={busy || uncertain} onClick={() => void execute("ready")}>Cleaning complete · Mark ready</button>}</div>{result && <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950" role="status"><p className="text-sm font-semibold">One-time Join Code</p><p className="mt-2 font-mono text-3xl font-semibold tracking-[0.25em]">{result.joinCode}</p><p className="mt-2 text-xs">Expires {new Date(result.expiresAt).toLocaleString()}. Share only with diners at {selected.label}.</p></div>}{feedback && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950" role="status">{feedback}</p>}{error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}</section>;
}
