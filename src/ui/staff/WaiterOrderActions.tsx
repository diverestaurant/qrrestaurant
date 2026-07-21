"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerMenuItemView } from "@/contracts/view-models";
import { formatMoney } from "@/lib/format";

type SessionChoice = { sessionId: string; sessionVersion: number; tableLabel: string };
type OrderLine = { lineId: string; menuItemId: string; variantId?: string; quantity: number; modifierOptionIds: string[]; note?: string; label: string; totalMinor: number };

export function WaiterOrderActions({ currency, items, sessions }: { currency: string; items: CustomerMenuItemView[]; sessions: SessionChoice[] }) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState(sessions[0]?.sessionId ?? "");
  const [menuItemId, setMenuItemId] = useState(items[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [modifierOptionIds, setModifierOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === menuItemId) ?? items[0];
  const selectedSession = sessions.find((session) => session.sessionId === sessionId) ?? sessions[0];
  const estimate = useMemo(() => lines.reduce((total, line) => total + line.totalMinor, 0), [lines]);

  function toggleModifier(optionId: string) {
    setModifierOptionIds((current) => current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]);
  }

  function addLine() {
    if (!selectedItem) return;
    setError(null);
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 20) { setError("Quantity must be between 1 and 20."); return; }
    for (const group of selectedItem.modifierGroups) {
      const count = group.options.filter((option) => modifierOptionIds.includes(option.id)).length;
      if (count < group.minSelections || count > group.maxSelections || (group.required && count === 0)) { setError(`${group.name} requires ${group.minSelections}–${group.maxSelections} selection(s).`); return; }
    }
    const variant = selectedItem.variants.find((candidate) => candidate.id === variantId);
    const modifiers = selectedItem.modifierGroups.flatMap((group) => group.options).filter((option) => modifierOptionIds.includes(option.id));
    const unitMinor = selectedItem.priceMinor + (variant?.priceDeltaMinor ?? 0) + modifiers.reduce((total, option) => total + option.priceDeltaMinor, 0);
    setLines((current) => [...current, { lineId: crypto.randomUUID(), menuItemId: selectedItem.id, ...(variant ? { variantId: variant.id } : {}), quantity: parsedQuantity, modifierOptionIds, ...(note.trim() ? { note: note.trim() } : {}), label: [selectedItem.name, variant?.name, ...modifiers.map((option) => option.name)].filter(Boolean).join(" · "), totalMinor: unitMinor * parsedQuantity }]);
    setVariantId("");
    setModifierOptionIds([]);
    setQuantity("1");
    setNote("");
  }

  async function submit() {
    if (!selectedSession || lines.length === 0) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/v1/staff/sessions/${selectedSession.sessionId}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedSessionVersion: selectedSession.sessionVersion, idempotencyKey: idempotencyKey.current, items: lines.map(({ menuItemId: itemId, variantId: lineVariantId, quantity: lineQuantity, modifierOptionIds: optionIds, note: lineNote }) => ({ menuItemId: itemId, ...(lineVariantId ? { variantId: lineVariantId } : {}), quantity: lineQuantity, modifierOptionIds: optionIds, ...(lineNote ? { note: lineNote } : {}) })) }), cache: "no-store" });
      const body = await response.json() as { ok: boolean; data?: { orderId: string }; error?: { code?: string; message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "The assisted order could not be submitted.");
      idempotencyKey.current = null;
      setUncertain(false);
      setLines([]);
      setFeedback(`Assisted order committed for ${selectedSession.tableLabel}.`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof TypeError) {
        setUncertain(true);
        setError("Outcome unknown. Keep this order unchanged, refresh the floor, then retry the same command.");
      } else {
        idempotencyKey.current = null;
        setError(caught instanceof Error ? caught.message : "The assisted order could not be submitted.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (sessions.length === 0 || items.length === 0) return <section className="mt-8 rounded-3xl border bg-surface p-5 text-sm text-muted shadow-sm">Assisted ordering becomes available when an open Session and an available menu item exist.</section>;
  return <section className="mt-8 rounded-3xl border bg-surface p-5 shadow-sm" aria-labelledby="assisted-order-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Staff-assisted order</p><h2 id="assisted-order-title" className="mt-2 text-xl font-semibold">Build an order from the live menu</h2></div><p className="text-sm text-muted">Server pricing remains authoritative.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="text-sm">Open Session<select className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain || lines.length > 0} value={selectedSession.sessionId} onChange={(event) => setSessionId(event.target.value)}>{sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.tableLabel}</option>)}</select></label><label className="text-sm sm:col-span-2">Menu item<select className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain} value={selectedItem.id} onChange={(event) => { setMenuItemId(event.target.value); setVariantId(""); setModifierOptionIds([]); }}>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.priceMinor, currency)}</option>)}</select></label></div>{selectedItem.variants.length > 0 && <fieldset className="mt-4"><legend className="text-sm font-semibold">Variant</legend><div className="mt-2 flex flex-wrap gap-2"><label className="rounded-full border px-3 py-2 text-sm"><input className="mr-2" type="radio" name="waiter-variant" checked={!variantId} onChange={() => setVariantId("")} />Standard</label>{selectedItem.variants.map((variant) => <label className="rounded-full border px-3 py-2 text-sm" key={variant.id}><input className="mr-2" type="radio" name="waiter-variant" checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} />{variant.name} {variant.priceDeltaMinor ? `+${formatMoney(variant.priceDeltaMinor, currency)}` : ""}</label>)}</div></fieldset>}{selectedItem.modifierGroups.map((group) => <fieldset className="mt-4" key={group.id}><legend className="text-sm font-semibold">{group.name} · choose {group.minSelections}–{group.maxSelections}</legend><div className="mt-2 flex flex-wrap gap-2">{group.options.map((option) => <label className="rounded-full border px-3 py-2 text-sm" key={option.id}><input className="mr-2" type="checkbox" checked={modifierOptionIds.includes(option.id)} onChange={() => toggleModifier(option.id)} />{option.name} {option.priceDeltaMinor ? `+${formatMoney(option.priceDeltaMinor, currency)}` : ""}</label>)}</div></fieldset>)}<div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_auto]"><label className="text-sm">Quantity<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain} inputMode="numeric" type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="text-sm">Kitchen note<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy || uncertain} maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="min-h-11 self-end rounded-full border px-5 text-sm font-semibold" disabled={busy || uncertain} onClick={addLine}>Add line</button></div><div className="mt-5 rounded-2xl bg-background p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Assisted cart</h3><span className="font-mono text-sm">Estimate {formatMoney(estimate, currency)}</span></div>{lines.length === 0 ? <p className="mt-3 text-sm text-muted">No lines added.</p> : <ul className="mt-3 space-y-2">{lines.map((line) => <li className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm" key={line.lineId}><span>{line.quantity}× {line.label}</span><button className="min-h-10 rounded-full border px-3" disabled={busy || uncertain} onClick={() => setLines((current) => current.filter((candidate) => candidate.lineId !== line.lineId))}>Remove</button></li>)}</ul>}<button className="mt-4 min-h-11 w-full rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy || lines.length === 0} onClick={() => void submit()}>{busy ? "Submitting…" : uncertain ? "Retry same assisted order" : "Submit assisted order"}</button></div>{feedback && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950" role="status">{feedback}</p>}{error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}</section>;
}
