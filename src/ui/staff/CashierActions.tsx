"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { formatMinorForAmountInput, parseMajorAmountToMinor } from "@/modules/pricing/application/major-amount";

type PendingPayment = { id: string; method: string; amountMinor: number };
type CashierActionsProps = {
  sessionId: string;
  expectedSessionVersion: number;
  currency: string;
  outstandingMinor: number;
  receiptId?: string;
  pendingPayment?: PendingPayment;
};

class StaffCommandError extends Error {
  constructor(message: string, readonly code: string, readonly retryable: boolean) {
    super(message);
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const payload = await response.json() as { ok: boolean; data?: T; error?: { code?: string; message?: string; retryable?: boolean } };
  if (!response.ok || !payload.ok) throw new StaffCommandError(payload.error?.message ?? "The staff command could not be completed.", payload.error?.code ?? "INTERNAL_ERROR", payload.error?.retryable ?? false);
  return payload.data as T;
}

export function CashierActions({ sessionId, expectedSessionVersion, currency, outstandingMinor, receiptId, pendingPayment: initialPendingPayment }: CashierActionsProps) {
  const router = useRouter();
  const commandKeys = useRef<Record<string, string>>({});
  const [discountKind, setDiscountKind] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [tenderAmount, setTenderAmount] = useState(formatMinorForAmountInput(outstandingMinor));
  const [tenderMethod, setTenderMethod] = useState(initialPendingPayment?.method ?? "CASH");
  const [cashReceived, setCashReceived] = useState(formatMinorForAmountInput(initialPendingPayment?.amountMinor ?? outstandingMinor));
  const [observedReference, setObservedReference] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(initialPendingPayment ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uncertainAction, setUncertainAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [closeConfirmed, setCloseConfirmed] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function keyFor(command: string) {
    commandKeys.current[command] ??= crypto.randomUUID();
    return commandKeys.current[command];
  }

  async function command<T>(key: string, path: string, body: Record<string, unknown>) {
    try {
      const result = await postJson<T>(path, { ...body, idempotencyKey: keyFor(key) });
      delete commandKeys.current[key];
      return result;
    } catch (caught) {
      if (caught instanceof StaffCommandError && caught.code !== "UNKNOWN_OUTCOME") delete commandKeys.current[key];
      throw caught;
    }
  }

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    setFeedback(null);
    setError(null);
    try {
      const message = await action();
      setUncertainAction(null);
      setFeedback(message);
    } catch (caught) {
      if (caught instanceof TypeError || (caught instanceof StaffCommandError && caught.code === "UNKNOWN_OUTCOME")) {
        setUncertainAction(label);
        setError("Outcome unknown. Do not start a replacement tender. Refresh the authoritative bill or retry this same command.");
      } else {
        setError(caught instanceof Error ? caught.message : "The staff command could not be completed.");
      }
    } finally {
      setBusy(null);
    }
  }

  const applyDiscount = () => run("discount", async () => {
    const numeric = Number(discountValue);
    if (discountKind === "PERCENT" && (!Number.isFinite(numeric) || numeric <= 0)) throw new Error("Enter a positive discount percentage.");
    const body = {
      kind: discountKind,
      reason: discountReason,
      expectedSessionVersion,
      ...(discountKind === "PERCENT" ? { percentageBasisPoints: Math.round(numeric * 100) } : { fixedAmountMinor: parseMajorAmountToMinor(discountValue) }),
    };
    const result = await command<{ discountMinor: number }>("discount", `/api/v1/staff/sessions/${sessionId}/discounts`, body);
    router.refresh();
    return `Discount applied: ${formatMoney(result.discountMinor, currency)}. The authoritative bill is refreshing.`;
  });

  const beginTender = () => run("payment", async () => {
    const amountMinor = parseMajorAmountToMinor(tenderAmount);
    if (amountMinor <= 0 || amountMinor > outstandingMinor) throw new Error("Tender amount must be within the current outstanding balance.");
    const result = await command<{ paymentId: string }>("payment", `/api/v1/staff/sessions/${sessionId}/payments`, { amountMinor, currency, method: tenderMethod, expectedSessionVersion });
    setPendingPayment({ id: result.paymentId, method: tenderMethod, amountMinor });
    router.refresh();
    return `Payment started for ${formatMoney(amountMinor, currency)}. Confirm only after observing the tender.`;
  });

  const confirmTender = () => run("confirm", async () => {
    if (!pendingPayment) throw new Error("Start or recover a payment before confirming it.");
    const cashReceivedMinor = pendingPayment.method === "CASH" ? parseMajorAmountToMinor(cashReceived) : undefined;
    if (pendingPayment.method === "CASH" && (!cashReceivedMinor || cashReceivedMinor < pendingPayment.amountMinor)) throw new Error("Cash received must cover the pending tender amount.");
    if (pendingPayment.method !== "CASH" && !observedReference.trim()) throw new Error("Record the observed terminal or QR reference.");
    const result = await command<{ changeMinor: number }>("confirm", `/api/v1/staff/payments/${pendingPayment.id}/confirm`, pendingPayment.method === "CASH" ? { cashReceivedMinor } : { observedReference: observedReference.trim() });
    setPendingPayment(null);
    router.refresh();
    return `Tender confirmed${pendingPayment.method === "CASH" ? ` · change ${formatMoney(result.changeMinor, currency)}` : ""}. The authoritative balance is refreshing.`;
  });

  const issueReceipt = () => run("receipt", async () => {
    const result = await command<{ receiptNumber: string }>("receipt", `/api/v1/staff/sessions/${sessionId}/receipt`, {});
    router.refresh();
    return `Receipt ${result.receiptNumber} issued from the immutable bill snapshot.`;
  });
  const reprintReceipt = () => run("reprint", async () => {
    const result = await command<{ receiptNumber: string }>("reprint", `/api/v1/staff/receipts/${receiptId}/reprint`, {});
    return `Receipt ${result.receiptNumber} reprinted from the original snapshot.`;
  });
  const closeSession = () => run("close", async () => {
    await command<{ state: string }>("close", `/api/v1/staff/sessions/${sessionId}/close`, { expectedSessionVersion });
    router.refresh();
    return "Session closed and customer grants revoked.";
  });

  const activeMethod = pendingPayment?.method ?? tenderMethod;
  const commandsDisabled = busy !== null || !online;

  return <section className="mt-6 rounded-3xl border bg-surface p-5 shadow-sm" aria-labelledby="cashier-actions-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Authorized commands</p><h2 id="cashier-actions-title" className="mt-2 text-xl font-semibold">Complete the bill</h2></div><div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted">All amounts are server revalidated.</p><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => router.refresh()}>Refresh authoritative bill</button></div></div>
    {!online && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950" role="status">Offline. Financial commands are disabled until the connection returns.</p>}
    {pendingPayment && <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status"><strong>Pending tender recovered:</strong> {pendingPayment.method} · {formatMoney(pendingPayment.amountMinor, currency)}. Confirm this observed tender before starting another.</div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-background p-4"><h3 className="font-semibold">Apply discount</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || uncertainAction === "discount"} value={discountKind} onChange={(event) => setDiscountKind(event.target.value as "PERCENT" | "FIXED")}><option value="PERCENT">Percent</option><option value="FIXED">Fixed amount</option></select></label><label className="text-sm">{discountKind === "PERCENT" ? "Percent" : `Amount (${currency})`}<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || uncertainAction === "discount"} inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountKind === "PERCENT" ? "10" : "5.00"} /></label></div><label className="mt-3 block text-sm">Required reason<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || uncertainAction === "discount"} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Manager-approved reason" /></label><button onClick={applyDiscount} disabled={commandsDisabled || !discountReason.trim()} className="mt-4 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{busy === "discount" ? "Applying…" : uncertainAction === "discount" ? "Retry same discount" : "Apply discount"}</button></div>
      <div className="rounded-2xl bg-background p-4"><h3 className="font-semibold">{pendingPayment ? "Confirm pending tender" : "Start another tender"}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Amount ({currency})<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || pendingPayment !== null || uncertainAction === "payment"} inputMode="decimal" value={pendingPayment ? formatMinorForAmountInput(pendingPayment.amountMinor) : tenderAmount} onChange={(event) => setTenderAmount(event.target.value)} /></label><label className="text-sm">Method<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || pendingPayment !== null || uncertainAction === "payment"} value={activeMethod} onChange={(event) => setTenderMethod(event.target.value)}><option>CASH</option><option>CARD</option><option>DUITNOW</option><option>E_WALLET</option><option>OTHER</option></select></label></div>{activeMethod === "CASH" ? <label className="mt-3 block text-sm">Cash received ({currency})<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || uncertainAction === "confirm"} inputMode="decimal" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label> : <label className="mt-3 block text-sm">Observed terminal/QR reference<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" disabled={commandsDisabled || uncertainAction === "confirm"} value={observedReference} onChange={(event) => setObservedReference(event.target.value)} placeholder="Terminal reference" /></label>}<div className="mt-4 flex flex-wrap gap-3">{!pendingPayment && <button onClick={beginTender} disabled={commandsDisabled || outstandingMinor <= 0} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{busy === "payment" ? "Starting…" : uncertainAction === "payment" ? "Retry same payment" : "Start payment"}</button>}{pendingPayment && <button onClick={confirmTender} disabled={commandsDisabled} className="min-h-11 rounded-full border px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400">{busy === "confirm" ? "Confirming…" : uncertainAction === "confirm" ? "Retry same confirmation" : "Confirm observed tender"}</button>}</div><p className="mt-2 text-xs text-muted">The pending payment is read back from the database after refresh; method and amount cannot change after it starts.</p></div>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={issueReceipt} disabled={commandsDisabled || outstandingMinor !== 0} className="min-h-11 rounded-full border px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400">{busy === "receipt" ? "Issuing…" : uncertainAction === "receipt" ? "Retry same receipt" : "Issue receipt"}</button>{receiptId && <button onClick={reprintReceipt} disabled={commandsDisabled} className="min-h-11 rounded-full border px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400">{busy === "reprint" ? "Reprinting…" : "Reprint receipt"}</button>}<label className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="checkbox" checked={closeConfirmed} onChange={(event) => setCloseConfirmed(event.target.checked)} /> Confirm paid Session closure</label><button onClick={closeSession} disabled={commandsDisabled || outstandingMinor !== 0 || !receiptId || !closeConfirmed} className="min-h-11 rounded-full bg-[#123c37] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{busy === "close" ? "Closing…" : uncertainAction === "close" ? "Retry same close" : "Close Session"}</button></div>
    {(feedback || error) && <p className={`mt-4 rounded-2xl p-3 text-sm ${error ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`} role={error ? "alert" : "status"}>{error ?? feedback}</p>}
  </section>;
}
