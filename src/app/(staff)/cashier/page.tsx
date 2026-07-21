import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import { readCashierPage, readStaffPageAccess } from "@/server/role-queries";
import { StatusPill } from "@/ui/primitives/StatusPill";
import { RoleShell } from "@/ui/role-shells/RoleShell";
import { CashierActions } from "@/ui/staff/CashierActions";
import { StaffGate } from "@/ui/staff/StaffGate";

export const dynamic = "force-dynamic";

const description = "The bill view displays server-authoritative Session, order, discount and payment snapshots. Tender confirmation, receipt issuance and closure stay explicit, retryable, and auditable.";

export default async function CashierPage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  const access = await readStaffPageAccess({ branchId: localDemoBranchId, restaurantId: localDemoRestaurantId, requiredCapabilities: ["payment.begin", "payment.confirm"] });
  if (access.status !== "authorized") {
    return <RoleShell role="Cashier" title="Close with confidence" description={description} freshness="Protected staff workspace"><StaffGate role="Cashier" access={access.status} email={access.status === "forbidden" ? access.email : undefined} /></RoleShell>;
  }

  const { sessionId } = await searchParams;
  const board = await readCashierPage(localDemoBranchId, sessionId);
  const session = board.session;
  const pendingPayment = board.payments.find((payment) => payment.state === "PENDING");
  const outstanding = session ? Math.max(0, session.totalDueMinor - session.totalPaidMinor) : 0;
  return <RoleShell role="Cashier" title="Close with confidence" description={description} freshness={`${session ? `${session.tableLabel} · ${session.state}` : "No payable Session"} · ${board.lastSyncedAt}`}>
    <StaffGate role="Cashier" access="authorized" email={access.email}>
      <nav className="mb-6 rounded-3xl border bg-surface p-5 shadow-sm" aria-label="Select Session"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Open bills</p><h2 className="mt-1 text-lg font-semibold">Choose a Session</h2></div><StatusPill label={`${board.sessions.length} active`} tone="info" /></div><div className="mt-4 flex flex-wrap gap-2">{board.sessions.map((choice) => <Link aria-current={choice.id === session?.id ? "page" : undefined} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${choice.id === session?.id ? "border-brand bg-brand text-white" : "hover:bg-background"}`} href={`/cashier?sessionId=${choice.id}`} key={choice.id}>{choice.tableLabel} · {formatMoney(choice.outstandingMinor)} · {choice.state.replaceAll("_", " ")}</Link>)}</div></nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-2xl font-semibold">{session?.tableLabel ?? "No table"}</p><p className="mt-1 text-sm text-muted">{session ? `${session.guestCount} guests · Session version ${session.version}` : "No committed payable Session"}</p></div><StatusPill label={session?.state.replaceAll("_", " ") ?? "EMPTY"} tone={session ? "warning" : "neutral"} /></div>
          <div className="mt-8 divide-y">{board.items.length === 0 ? <p className="py-4 text-sm text-muted">No committed bill items.</p> : board.items.map((item, index) => <div className="flex items-center justify-between gap-4 py-4" key={`${item.name}-${index}`}><div><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted">Qty {item.quantity}</p></div><span className="font-mono tabular-nums">{formatMoney(item.totalMinor, session?.currency ?? "MYR")}</span></div>)}</div>
          {board.discounts.length > 0 && <div className="mt-6 border-t pt-5"><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Applied discounts</p>{board.discounts.map((discount, index) => <p className="mt-2 text-sm text-muted" key={`${discount.kind}-${index}`}>{discount.kind} · {formatMoney(discount.discountMinor, session?.currency ?? "MYR")} · {discount.reason}</p>)}</div>}
          <div className="mt-6 rounded-2xl bg-background p-4 text-sm leading-6 text-muted">The browser never recalculates the bill. Discount caps, payment allocation, receipt snapshots and close/reconciliation are revalidated by the server boundary.</div>
        </section>
        <aside className="h-fit rounded-3xl border bg-surface p-5 shadow-sm"><div className="flex justify-between text-sm text-muted"><span>Due snapshot</span><span className="font-mono">{formatMoney(session?.totalDueMinor ?? 0, session?.currency ?? "MYR")}</span></div><div className="mt-3 flex justify-between text-sm text-muted"><span>Paid snapshot</span><span className="font-mono">{formatMoney(session?.totalPaidMinor ?? 0, session?.currency ?? "MYR")}</span></div><div className="mt-5 flex justify-between border-t pt-5 text-lg font-semibold"><span>Outstanding</span><span className="font-mono">{formatMoney(outstanding, session?.currency ?? "MYR")}</span></div>{board.payments.length > 0 && <div className="mt-5 border-t pt-4"><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Committed tenders</p>{board.payments.map((payment, index) => <p className="mt-2 text-sm text-muted" key={`${payment.method}-${index}`}>{payment.method} · {payment.state} · {formatMoney(payment.amountMinor, session?.currency ?? "MYR")}</p>)}</div>}{board.receipt && <div className="mt-5 border-t pt-4 text-sm text-muted"><p className="font-semibold text-foreground">Receipt {board.receipt.receiptNumber}</p><p className="mt-1">Immutable original snapshot available for reprint.</p></div>}</aside>
      </div>
      {session && <CashierActions key={`${session.id}:${session.version}:${pendingPayment?.id ?? "none"}:${board.receipt?.id ?? "none"}`} sessionId={session.id} expectedSessionVersion={session.version} currency={session.currency} outstandingMinor={outstanding} receiptId={board.receipt?.id} pendingPayment={pendingPayment ? { id: pendingPayment.id, method: pendingPayment.method, amountMinor: pendingPayment.amountMinor } : undefined} />}
    </StaffGate>
  </RoleShell>;
}
