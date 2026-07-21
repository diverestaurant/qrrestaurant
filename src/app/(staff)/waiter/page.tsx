import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";
import { formatMoney } from "@/lib/format";
import { readStaffPageAccess, readWaiterPage } from "@/server/role-queries";
import { StatusPill } from "@/ui/primitives/StatusPill";
import { RoleShell } from "@/ui/role-shells/RoleShell";
import { StaffGate } from "@/ui/staff/StaffGate";
import { WaiterActions } from "@/ui/staff/WaiterActions";
import { WaiterOrderActions } from "@/ui/staff/WaiterOrderActions";
import { WaiterServeAction } from "@/ui/staff/WaiterServeAction";
import { WaiterSessionActions } from "@/ui/staff/WaiterSessionActions";

export const dynamic = "force-dynamic";

const description = "Floor status and service inbox are read from committed Sessions and requests behind the authorized staff boundary.";

export default async function WaiterPage() {
  const access = await readStaffPageAccess({ branchId: localDemoBranchId, restaurantId: localDemoRestaurantId, requiredCapabilities: ["session.open", "order.serve"] });
  if (access.status !== "authorized") {
    return <RoleShell role="Waiter" title="Keep the floor moving" description={description} freshness="Protected staff workspace"><StaffGate role="Waiter" access={access.status} email={access.status === "forbidden" ? access.email : undefined} /></RoleShell>;
  }

  const [board, menu] = await readWaiterPage(localDemoBranchId);
  return <RoleShell role="Waiter" title="Keep the floor moving" description={description} freshness={`${board.sessionCount} active Session${board.sessionCount === 1 ? "" : "s"} · ${board.lastSyncedAt}`}>
    <StaffGate role="Waiter" access="authorized" branchId={localDemoBranchId} email={access.email} profile={access.profile} restaurantId={localDemoRestaurantId}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{board.tables.map((table) => { const tone = table.state === "AVAILABLE" ? "neutral" : table.state === "PAYMENT" || table.state === "CLEANING" || table.state === "SERVICE REQUEST" ? "warning" : table.state === "READY" ? "success" : "info"; return <article className="rounded-3xl border bg-surface p-5 shadow-sm" key={table.id}><div className="flex items-start justify-between gap-2"><span className="font-mono text-3xl font-semibold">{table.label}</span><StatusPill label={table.state} tone={tone} /></div><p className="mt-5 text-sm text-muted">{table.detail}</p>{table.totalDueMinor > 0 && <p className="mt-2 font-mono text-sm tabular-nums">{formatMoney(Math.max(0, table.totalDueMinor - table.totalPaidMinor))} outstanding</p>}</article>; })}</div>
      <WaiterSessionActions tables={board.tables} />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><section className="rounded-3xl border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Service inbox</h2><StatusPill label={`${board.requests.length} open`} tone={board.requests.length > 0 ? "warning" : "neutral"} /></div><div className="mt-5 space-y-3">{board.requests.length === 0 ? <p className="rounded-2xl bg-background p-4 text-sm text-muted">No open service requests in the committed snapshot.</p> : board.requests.map((request) => <div className="flex items-center justify-between gap-4 rounded-2xl bg-background p-4" key={request.id}><div><span className="text-sm font-medium">{request.tableLabel} · {request.requestType.replaceAll("_", " ")}</span><p className="mt-1 text-xs text-muted">Priority {request.priority}{request.assignedTo ? ` · assigned ${request.assignedTo.slice(0, 8)}…` : " · unassigned"}</p></div><WaiterActions request={request} /></div>)}</div></section><section className="rounded-3xl border bg-[#123c37] p-5 text-white shadow-sm"><p className="text-xs font-semibold tracking-[0.12em] text-[#a7e8db] uppercase">Join Code boundary</p><p className="mt-3 text-xl font-semibold">Protected server snapshot</p><p className="mt-3 text-sm leading-6 text-[#c9e0db]">Join Codes are stored as hashes. Open/rotate commands return a code only to an authorized staff caller; this read view never invents or reveals one.</p></section></div>
      <section className="mt-8 rounded-3xl border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Ready to serve</h2><StatusPill label={`${board.readyItems.length} ready`} tone={board.readyItems.length > 0 ? "success" : "neutral"} /></div><div className="mt-5 space-y-3">{board.readyItems.length === 0 ? <p className="rounded-2xl bg-background p-4 text-sm text-muted">No committed items are waiting to be served.</p> : board.readyItems.map((item) => <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-background p-4" key={item.id}><span className="text-sm font-medium">{item.tableLabel} · {item.quantity}× {item.name}</span><WaiterServeAction item={item} /></div>)}</div></section>
      <WaiterOrderActions currency={menu.currency} items={menu.items} sessions={board.tables.flatMap((table) => table.sessionId && table.sessionVersion ? [{ sessionId: table.sessionId, sessionVersion: table.sessionVersion, tableLabel: table.label }] : [])} />
    </StaffGate>
  </RoleShell>;
}
