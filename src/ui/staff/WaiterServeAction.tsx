"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function WaiterServeAction({ item }: { item: { id: string; name: string; version: number } }) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function serve() {
    setBusy(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/v1/staff/kds/items/${item.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextState: "SERVED", expectedVersion: item.version, idempotencyKey: idempotencyKey.current }), cache: "no-store" });
      const body = await response.json() as { ok: boolean; error?: { code?: string; message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "The item could not be marked served.");
      idempotencyKey.current = null;
      router.refresh();
    } catch (caught) {
      setError(caught instanceof TypeError ? "Outcome unknown. Refresh before retrying this same action." : caught instanceof Error ? caught.message : "The item could not be marked served.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-col items-end gap-1"><button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy} onClick={() => void serve()}>{busy ? "Saving…" : `Mark ${item.name} served`}</button>{error && <p className="max-w-64 text-right text-xs text-danger" role="alert">{error}</p>}</div>;
}
