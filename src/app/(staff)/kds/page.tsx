import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";
import { formatElapsed } from "@/lib/format";
import Link from "next/link";
import { readKdsPage, readStaffPageAccess } from "@/server/role-queries";
import { StatusPill } from "@/ui/primitives/StatusPill";
import { RoleShell } from "@/ui/role-shells/RoleShell";
import { KdsActions } from "@/ui/staff/KdsActions";
import { KdsDisplayControls } from "@/ui/staff/KdsDisplayControls";
import { StaffGate } from "@/ui/staff/StaffGate";
import { KdsSoundControl } from "@/ui/staff/KdsSoundControl";

export const dynamic = "force-dynamic";

const description = "Station queue read from committed order items. Audio is never the only alert.";

export default async function KdsPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const access = await readStaffPageAccess({ branchId: localDemoBranchId, restaurantId: localDemoRestaurantId, requiredCapabilities: ["order.accept", "order.prepare"] });
  if (access.status !== "authorized") {
    return <RoleShell role="Kitchen" title="Pass, without the panic" description={description} freshness="Protected staff workspace"><StaffGate role="Kitchen" access={access.status} email={access.status === "forbidden" ? access.email : undefined} /></RoleShell>;
  }

  const { station } = await searchParams;
  const queue = await readKdsPage(localDemoBranchId, station);
  return <RoleShell role="Kitchen" title="Pass, without the panic" description={description} freshness={`${queue.items.length} committed ticket${queue.items.length === 1 ? "" : "s"} · ${queue.lastSyncedAt ?? "pending"}`}>
    <StaffGate role="Kitchen" access="authorized" branchId={localDemoBranchId} email={access.email} profile={access.profile} restaurantId={localDemoRestaurantId}>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Kitchen stations">{queue.stations.map((candidate) => <Link aria-current={candidate.key === queue.stationKey ? "page" : undefined} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${candidate.key === queue.stationKey ? "border-brand bg-brand text-white" : "bg-surface hover:bg-background"}`} href={`/kds?station=${encodeURIComponent(candidate.key)}`} key={candidate.key}>{candidate.name}</Link>)}</nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-surface p-5 shadow-sm"><div><p className="text-sm font-semibold">{queue.stationName}</p><p className="mt-1 text-sm text-muted">{queue.items.length} active ticket{queue.items.length === 1 ? "" : "s"} · repository snapshot v{queue.version ?? 0}</p></div><div className="flex flex-wrap items-center gap-2"><StatusPill label="Polling fallback ready" tone="info" /><KdsDisplayControls /><KdsSoundControl ticketCount={queue.items.length} /></div></div>
      {queue.items.length === 0 ? <div className="rounded-3xl border border-dashed p-6 text-sm text-muted">No committed kitchen items are waiting.</div> : <div className="grid gap-4 lg:grid-cols-3">{queue.items.map((ticket) => { const tone = ticket.state === "READY" ? "success" : ticket.state === "SUBMITTED" ? "info" : "warning"; const overdue = ticket.elapsedMinutes >= 15; return <article data-kds-ticket className={`rounded-3xl border bg-surface p-5 shadow-sm ${overdue ? "border-red-400 ring-2 ring-red-100" : ""}`} key={ticket.id}><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-2xl font-semibold">{ticket.tableLabel}</p><p className={overdue ? "text-sm font-semibold text-danger" : "text-sm text-muted"}>Elapsed {formatElapsed(ticket.elapsedMinutes)}{overdue ? " · SLA attention" : ""}</p></div><StatusPill label={ticket.state} tone={tone} /></div><div data-kds-secondary className="mt-7 border-t pt-5"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">{ticket.name}</h2><span className="font-mono text-2xl font-semibold">×{ticket.quantity}</span></div><p className="mt-3 rounded-2xl bg-background p-3 text-sm text-muted">Committed order item · version {ticket.version}</p>{(ticket.variantLabel || ticket.modifierLabels.length > 0 || ticket.note) && <details className="mt-3 rounded-2xl border bg-background p-3 text-sm"><summary className="min-h-8 cursor-pointer font-semibold">Order details</summary>{ticket.variantLabel && <p className="mt-2">Variant: {ticket.variantLabel}</p>}{ticket.modifierLabels.length > 0 && <p className="mt-1">Modifiers: {ticket.modifierLabels.join(", ")}</p>}{ticket.note && <p className="mt-1 font-semibold text-danger">Note: {ticket.note}</p>}</details>}</div><div className="mt-6"><KdsActions ticket={ticket} /></div></article>; })}</div>}
      <section className="mt-6 rounded-3xl border bg-surface p-5 shadow-sm" aria-labelledby="recent-kds"><div className="flex items-center justify-between gap-3"><h2 id="recent-kds" className="text-lg font-semibold">Recently completed</h2><StatusPill label={`${queue.recentlyCompleted.length} in 30 min`} tone="neutral" /></div>{queue.recentlyCompleted.length === 0 ? <p className="mt-4 text-sm text-muted">No recent served, rejected, or cancelled items for this station view.</p> : <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{queue.recentlyCompleted.map((item) => <li className="rounded-2xl bg-background p-3 text-sm" key={item.id}><div className="flex justify-between gap-3"><strong>{item.tableLabel} · {item.quantity}× {item.name}</strong><StatusPill label={item.state} tone={item.state === "SERVED" ? "success" : "warning"} /></div><p className="mt-1 text-xs text-muted">Completed {new Date(item.completedAt).toLocaleTimeString()}</p></li>)}</ul>}</section>
      <div className="mt-6 rounded-3xl border border-dashed bg-transparent p-5 text-sm leading-6 text-muted"><strong className="text-foreground">Recovery rule:</strong> Realtime is not the source of truth. A gap, stale badge, or reconnect must resync from committed database facts before the queue is considered current.</div>
    </StaffGate>
  </RoleShell>;
}
