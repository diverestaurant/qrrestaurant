import { formatMoney } from "@/lib/format";
import type { ReceiptSnapshot } from "@/modules/payments/contracts/receipt-snapshot";
import { PrintButton } from "@/ui/staff/PrintButton";

function optionalLine(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim())).join(", ");
}

function snapshotLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" ? name : "";
}

function modifierLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const name = (entry as Record<string, unknown>).name;
    return typeof name === "string" ? [name] : [];
  });
}

export function PrintableReceipt({ id, number, reprintOf, snapshot }: { id: string; number: string; reprintOf: string | null; snapshot: ReceiptSnapshot }) {
  const restaurantName = snapshot.restaurant?.legalName || snapshot.restaurant?.name || "Restaurant";
  const address = optionalLine([snapshot.branch?.addressLine1, snapshot.branch?.addressLine2, snapshot.branch?.city, snapshot.branch?.postalCode, snapshot.branch?.countryCode]);
  return <main className="mx-auto my-8 w-full max-w-[760px] rounded-3xl border bg-white p-6 shadow-sm sm:p-10" data-print-root>
    <header className="border-b pb-6 text-center"><p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">Immutable receipt snapshot</p><h1 className="mt-3 text-2xl font-semibold">{restaurantName}</h1>{snapshot.branch?.name && <p className="mt-1 text-sm">{snapshot.branch.name}</p>}{address && <p className="mt-1 text-sm text-muted">{address}</p>}<p className="mt-4 font-mono text-lg font-semibold">Receipt {number}</p>{reprintOf && <p className="mt-1 text-xs font-semibold text-warning">REPRINT · original {snapshot.receiptNumber}</p>}</header>
    <section className="grid grid-cols-2 gap-3 border-b py-5 text-sm"><p><span className="text-muted">Business date</span><br />{snapshot.businessDate}</p><p className="text-right"><span className="text-muted">Table</span><br />{snapshot.tableLabel || "—"}</p><p><span className="text-muted">Issued</span><br />{new Date(snapshot.issuedAt).toLocaleString()}</p><p className="text-right"><span className="text-muted">Snapshot</span><br />v{snapshot.snapshotVersion ?? "legacy"}</p></section>
    <section className="py-5"><h2 className="font-semibold">Items</h2><div className="mt-3 divide-y">{snapshot.orders.flatMap((order) => order.items.map((item, index) => { const detail = [snapshotLabel(item.variant), ...modifierLabels(item.modifiers)].filter(Boolean).join(" · "); return <div className="flex justify-between gap-4 py-3 text-sm" key={`${order.id}:${index}`}><div><p>{item.quantity} × {item.name}</p>{detail && <p className="mt-1 text-xs text-muted">{detail}</p>}</div><p className="font-mono">{formatMoney(item.unitPriceMinor * item.quantity, snapshot.currency)}</p></div>; }))}{snapshot.orders.length === 0 && <p className="py-3 text-sm text-muted">No item lines captured.</p>}</div></section>
    {snapshot.discounts.length > 0 && <section className="border-t py-5"><h2 className="font-semibold">Discounts</h2>{snapshot.discounts.map((discount) => <div className="mt-2 flex justify-between gap-4 text-sm" key={discount.id}><span>{discount.kind} · {discount.reason}</span><span className="font-mono">−{formatMoney(discount.discountMinor, snapshot.currency)}</span></div>)}</section>}
    <section className="border-t py-5"><div className="flex justify-between text-lg font-semibold"><span>Total</span><span className="font-mono">{formatMoney(snapshot.totalDueMinor, snapshot.currency)}</span></div><div className="mt-2 flex justify-between text-sm text-muted"><span>Paid</span><span className="font-mono">{formatMoney(snapshot.totalPaidMinor, snapshot.currency)}</span></div></section>
    <section className="border-t py-5"><h2 className="font-semibold">Payments</h2>{snapshot.payments.map((payment) => <div className="mt-2 flex justify-between gap-4 text-sm" key={payment.id}><span>{payment.method}{payment.changeMinor ? ` · change ${formatMoney(payment.changeMinor, snapshot.currency)}` : ""}</span><span className="font-mono">{formatMoney(payment.amountMinor, snapshot.currency)}</span></div>)}</section>
    <footer className="border-t pt-5 text-center text-xs text-muted">{snapshot.restaurant?.receiptFooter && <p className="mb-3 text-sm text-foreground">{snapshot.restaurant.receiptFooter}</p>}<p>Receipt record {id.slice(0, 8)}… · rendered from the committed snapshot; no amount is recalculated in the browser.</p><div className="mt-5"><PrintButton /></div></footer>
  </main>;
}
