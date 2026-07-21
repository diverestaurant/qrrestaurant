import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";
import { readAdminPage, readStaffPageAccess } from "@/server/role-queries";
import { StatusPill } from "@/ui/primitives/StatusPill";
import { RoleShell } from "@/ui/role-shells/RoleShell";
import { AdminActions } from "@/ui/staff/AdminActions";
import { AdminOperations } from "@/ui/staff/AdminOperations";
import { PlatformTenantLifecycle } from "@/ui/staff/PlatformTenantLifecycle";
import { StaffGate } from "@/ui/staff/StaffGate";

export const dynamic = "force-dynamic";

const description = "Configuration and reporting summaries are read from committed branch facts behind the authorized staff boundary.";

export default async function AdminPage() {
  const access = await readStaffPageAccess({ branchId: localDemoBranchId, restaurantId: localDemoRestaurantId, requiredCapabilities: ["menu.manage", "staff.manage", "table.manage", "report.read"] });
  if (access.status !== "authorized") {
    return <RoleShell role="Admin" title="Shape the operation" description={description} freshness="Protected staff workspace"><StaffGate role="Admin" access={access.status} email={access.status === "forbidden" ? access.email : undefined} /></RoleShell>;
  }

  const overview = await readAdminPage(localDemoBranchId, localDemoRestaurantId);
  const controls = [
    { title: "Menu", detail: `${overview.menuItems} visible items · ${overview.unavailableItems} unavailable`, action: "Use the authorized admin panel below." },
    { title: "People & roles", detail: `${overview.staffMembers} active staff memberships in branch scope`, action: "Use the authorized admin panel below." },
    { title: "Tables & QR", detail: `${overview.activeTables} active tables in committed branch scope`, action: "Use the authorized admin panel below." },
    { title: "Reports", detail: `${overview.openSessions} active Session${overview.openSessions === 1 ? "" : "s"} · repository snapshot`, action: "Open report boundary" },
  ];
  return <RoleShell role="Admin" title="Shape the operation" description={description} freshness={`${overview.branchName} · ${overview.lastSyncedAt}`}>
    <StaffGate role="Admin" access="authorized" email={access.email}>
      <div className="grid gap-4 sm:grid-cols-2">{controls.map((control) => <article className="rounded-3xl border bg-surface p-6 shadow-sm" key={control.title}><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{control.title}</h2><p className="mt-2 text-sm text-muted">{control.detail}</p></div><StatusPill label="Committed" tone="success" /></div><p className="mt-7 text-sm text-muted">{control.action}</p></article>)}</div>
      {access.roleKeys.includes("PLATFORM") && <PlatformTenantLifecycle />}
      <AdminActions branchId={localDemoBranchId} defaultDate={overview.lastSyncedAt.slice(0, 10)} />
      <AdminOperations branchId={localDemoBranchId} restaurantId={localDemoRestaurantId} overview={overview} canEditRestaurant={access.roleKeys.includes("OWNER") || access.roleKeys.includes("PLATFORM")} />
      <div className="mt-8 rounded-3xl border bg-surface p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Audit boundary</p><h2 className="mt-2 text-xl font-semibold">Server-only operational snapshot</h2></div><StatusPill label="Append-only" tone="info" /></div><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Admin reads are branch-scoped facts. Audit viewers never expose secret hashes, raw JWTs, or another branch&apos;s records; edits require the authorized command API and audit/outbox transaction.</p></div>
    </StaffGate>
  </RoleShell>;
}
