"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOverviewView } from "@/contracts/view-models";
import { formatMoney } from "@/lib/format";
import { formatMinorForAmountInput, parseMajorAmountToMinor } from "@/modules/pricing/application/major-amount";
import { AdminMenuStructure } from "@/ui/staff/AdminMenuStructure";
import { AdminSettings } from "@/ui/staff/AdminSettings";
import { AdminStaffInvitation } from "@/ui/staff/AdminStaffInvitation";
import { PrintableQrEntry } from "@/ui/staff/PrintableQrEntry";

type CommandPayload = Record<string, unknown>;
export type SendCommand = <T>(key: string, payload: CommandPayload) => Promise<T | null>;

function parseAdminAmount(value: string) {
  try {
    return parseMajorAmountToMinor(value);
  } catch {
    return null;
  }
}

function MenuRow({ item, stations, send }: { item: AdminOverviewView["menu"][number]; stations: AdminOverviewView["stations"]; send: SendCommand }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(formatMinorForAmountInput(item.basePriceMinor));
  const [stationKey, setStationKey] = useState(item.stationKey);
  const [visible, setVisible] = useState(item.visible);
  return <div className="rounded-2xl border bg-background p-4"><div className="grid gap-3 sm:grid-cols-4"><label className="text-sm sm:col-span-2">Name<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm">Price ({item.currency})<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="text-sm">Station<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={stationKey} onChange={(event) => setStationKey(event.target.value)}><option value="">Unassigned</option>{stations.map((station) => <option key={station.id} value={station.stationKey}>{station.name}</option>)}</select></label></div><div className="mt-3 flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Publicly visible</label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`menu-update:${item.id}`, { type: "menu_item.update", menuItemId: item.id, expectedVersion: item.version, name, description: item.description, basePriceMinor: parseAdminAmount(price), stationKey, visible })}>Save item</button><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`menu-availability:${item.id}`, { __availability: true, menuItemId: item.id, available: !item.available, expectedVersion: item.version })}>{item.available ? "Mark sold out" : "Mark available"}</button><span className="text-xs text-muted">v{item.version} · {item.available ? "available" : "sold out"}</span></div></div>;
}

function TableRow({ table, send, onQr }: { table: AdminOverviewView["tables"][number]; send: SendCommand; onQr: (value: { label: string; token: string; version: number }) => void }) {
  const [label, setLabel] = useState(table.label);
  const [area, setArea] = useState(table.area);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [active, setActive] = useState(table.active);
  return <div className="rounded-2xl border bg-background p-4" role="group" aria-label={`Table ${table.label}`}><div className="grid gap-3 sm:grid-cols-4"><label className="text-sm">Label<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={label} onChange={(event) => setLabel(event.target.value)} /></label><label className="text-sm sm:col-span-2">Area<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={area} onChange={(event) => setArea(event.target.value)} /></label><label className="text-sm">Capacity<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" inputMode="numeric" type="number" min={1} max={100} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label></div><div className="mt-3 flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`table-update:${table.id}`, { type: "table.update", tableId: table.id, expectedVersion: table.version, label, area, capacity: Number(capacity), active })}>Save table</button><button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={!active} onClick={() => void send<{ tableToken: string; tokenVersion: number }>(`table-qr:${table.id}`, { type: "table.qr.rotate", tableId: table.id }).then((result) => { if (result) onQr({ label, token: result.tableToken, version: result.tokenVersion }); })}>Rotate QR</button><span className="text-xs text-muted">v{table.version}</span></div></div>;
}

function MembershipRow({ membership, roles, send }: { membership: AdminOverviewView["memberships"][number]; roles: AdminOverviewView["roles"]; send: SendCommand }) {
  const [roleId, setRoleId] = useState(membership.roleId);
  const [status, setStatus] = useState(membership.status);
  return <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-background p-4"><div className="min-w-48 flex-1"><p className="text-xs text-muted">Synthetic-safe user reference</p><p className="mt-1 font-mono text-sm">{membership.userId.slice(0, 8)}…{membership.userId.slice(-4)}</p></div><label className="text-sm">Role<select className="mt-1 min-h-11 rounded-xl border bg-surface px-3" value={roleId} onChange={(event) => setRoleId(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label><label className="text-sm">Status<select className="mt-1 min-h-11 rounded-xl border bg-surface px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option>ACTIVE</option><option>SUSPENDED</option><option>REVOKED</option></select></label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`membership:${membership.id}`, { type: "membership.update", membershipId: membership.id, expectedVersion: membership.version, roleId, status })}>Save membership</button></div>;
}

function StationRow({ station, send }: { station: AdminOverviewView["stations"][number]; send: SendCommand }) {
  const [name, setName] = useState(station.name);
  const [active, setActive] = useState(station.active);
  return <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-background p-4"><label className="min-w-48 flex-1 text-sm">{station.stationKey}<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`station:${station.id}`, { type: "station.upsert", stationId: station.id, expectedVersion: station.version, stationKey: station.stationKey, name, active })}>Save station</button></div>;
}

function FlagRow({ flag, send }: { flag: AdminOverviewView["featureFlags"][number]; send: SendCommand }) {
  const [enabled, setEnabled] = useState(flag.enabled);
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-4"><div className="min-w-48 flex-1"><p className="font-mono text-sm font-semibold">{flag.flagKey}</p><p className="mt-1 text-xs text-muted">{flag.description || "No description"} · v{flag.version}</p></div><label className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => void send(`flag:${flag.id}`, { type: "feature_flag.set", flagKey: flag.flagKey, description: flag.description, enabled, expectedVersion: flag.version })}>Save flag</button></div>;
}

export function AdminOperations({ branchId, restaurantId, overview, canEditRestaurant }: { branchId: string; restaurantId: string; overview: AdminOverviewView; canEditRestaurant: boolean }) {
  const router = useRouter();
  const keys = useRef<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState(overview.categories[0]?.id ?? "");
  const [tableLabel, setTableLabel] = useState("");
  const [tableArea, setTableArea] = useState("");
  const [tableCapacity, setTableCapacity] = useState("2");
  const [stationKey, setStationKey] = useState("");
  const [stationName, setStationName] = useState("");
  const [flagKey, setFlagKey] = useState("");
  const [flagDescription, setFlagDescription] = useState("");
  const [qrResult, setQrResult] = useState<{ label: string; token: string; version: number } | null>(null);

  const send: SendCommand = async <T,>(key: string, payload: CommandPayload) => {
    setBusy(key);
    setFeedback(null);
    setError(null);
    keys.current[key] ??= crypto.randomUUID();
    try {
      const availability = payload.__availability === true;
      const path = availability ? `/api/v1/staff/menu/items/${payload.menuItemId}/availability` : "/api/v1/staff/admin/commands";
      const body = availability
        ? { available: payload.available, expectedVersion: payload.expectedVersion, idempotencyKey: keys.current[key] }
        : { ...payload, restaurantId, branchId, idempotencyKey: keys.current[key] };
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json() as { ok: boolean; data?: T; error?: { code?: string; message?: string } };
      if (!response.ok || !result.ok || !result.data) throw new Error(result.error?.message ?? "The Admin command could not be completed.");
      delete keys.current[key];
      setFeedback("Admin command committed. Refreshing authoritative data.");
      router.refresh();
      return result.data;
    } catch (caught) {
      setError(caught instanceof TypeError ? "Outcome unknown. Refresh before retrying this same Admin command." : caught instanceof Error ? caught.message : "The Admin command could not be completed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  return <div className="mt-8 space-y-8" aria-busy={busy !== null}>
    <AdminSettings canEditRestaurant={canEditRestaurant} overview={overview} send={send} />
    <section className="rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="admin-menu"><h2 id="admin-menu" className="text-xl font-semibold">Menu and categories</h2><p className="mt-2 text-sm text-muted">Changes publish immediately and are audited. Existing order snapshots never change.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm">New category<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label><button className="min-h-11 self-end rounded-full border px-5 text-sm font-semibold" disabled={!categoryName.trim() || busy !== null} onClick={() => void send("category:create", { type: "menu_category.create", name: categoryName }).then((result) => { if (result) setCategoryName(""); })}>Create category</button></div>{overview.categories.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-4"><label className="text-sm">Category<select className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={itemCategoryId} onChange={(event) => setItemCategoryId(event.target.value)}>{overview.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm sm:col-span-2">New item name<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={itemName} onChange={(event) => setItemName(event.target.value)} /></label><label className="text-sm">Price ({overview.menu[0]?.currency ?? "MYR"})<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" inputMode="decimal" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} /></label><button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300 sm:col-start-4" disabled={!itemName.trim() || !itemPrice || busy !== null} onClick={() => void send("menu:create", { type: "menu_item.create", categoryId: itemCategoryId, name: itemName, basePriceMinor: parseAdminAmount(itemPrice), currency: overview.menu[0]?.currency ?? "MYR" }).then((result) => { if (result) { setItemName(""); setItemPrice(""); } })}>Create item</button></div>}<div className="mt-6 space-y-3">{overview.menu.map((item) => <MenuRow item={item} stations={overview.stations} send={send} key={item.id} />)}</div></section>
    <AdminMenuStructure branchId={branchId} restaurantId={restaurantId} overview={overview} send={send} />
    <section className="rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="admin-tables"><h2 id="admin-tables" className="text-xl font-semibold">Tables and secure QR</h2><div className="mt-5 grid gap-3 sm:grid-cols-4"><label className="text-sm">New table label<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} /></label><label className="text-sm sm:col-span-2">New table area<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={tableArea} onChange={(event) => setTableArea(event.target.value)} /></label><label className="text-sm">New table capacity<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" type="number" min={1} max={100} value={tableCapacity} onChange={(event) => setTableCapacity(event.target.value)} /></label><button className="min-h-11 rounded-full border px-5 text-sm font-semibold sm:col-start-4" disabled={!tableLabel.trim() || busy !== null} onClick={() => void send("table:create", { type: "table.create", label: tableLabel, area: tableArea, capacity: Number(tableCapacity) }).then(() => { setTableLabel(""); setTableArea(""); })}>Create table</button></div>{qrResult && <PrintableQrEntry entryPath={`/order/${overview.settings.restaurant.slug}/${overview.settings.branch.slug}/${qrResult.token}`} label={qrResult.label} version={qrResult.version} />}<div className="mt-6 space-y-3">{overview.tables.map((table) => <TableRow key={table.id} table={table} send={send} onQr={setQrResult} />)}</div></section>
    <section className="rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="admin-staff"><h2 id="admin-staff" className="text-xl font-semibold">Staff and branch roles</h2><p className="mt-2 text-sm text-muted">Invite permanent staff without creating or exposing a default password. Owner and Platform assignment remain separate privileged operations.</p><AdminStaffInvitation branchId={branchId} restaurantId={restaurantId} roles={overview.roles} /><div className="mt-5 space-y-3">{overview.memberships.length === 0 ? <p className="rounded-2xl bg-background p-4 text-sm text-muted">No branch memberships.</p> : overview.memberships.map((membership) => <MembershipRow key={membership.id} membership={membership} roles={overview.roles} send={send} />)}</div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border bg-surface p-6 shadow-sm"><h2 className="text-xl font-semibold">Kitchen stations</h2><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm">Key<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={stationKey} onChange={(event) => setStationKey(event.target.value.toLowerCase())} /></label><label className="text-sm">Name<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={stationName} onChange={(event) => setStationName(event.target.value)} /></label><button className="min-h-11 self-end rounded-full border px-4 text-sm font-semibold" disabled={!stationKey || !stationName || busy !== null} onClick={() => void send("station:create", { type: "station.upsert", stationKey, name: stationName, active: true }).then(() => { setStationKey(""); setStationName(""); })}>Create</button></div><div className="mt-5 space-y-3">{overview.stations.map((station) => <StationRow key={station.id} station={station} send={send} />)}</div></div><div className="rounded-3xl border bg-surface p-6 shadow-sm"><h2 className="text-xl font-semibold">Basic feature flags</h2><div className="mt-5 grid gap-3"><label className="text-sm">Flag key<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={flagKey} onChange={(event) => setFlagKey(event.target.value.toLowerCase())} placeholder="customer.notes" /></label><label className="text-sm">Description<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={flagDescription} onChange={(event) => setFlagDescription(event.target.value)} /></label><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={!flagKey || busy !== null} onClick={() => void send("flag:create", { type: "feature_flag.set", flagKey, description: flagDescription, enabled: false }).then(() => { setFlagKey(""); setFlagDescription(""); })}>Create disabled flag</button></div><div className="mt-5 space-y-3">{overview.featureFlags.map((flag) => <FlagRow key={flag.id} flag={flag} send={send} />)}</div></div></section>
    <section className="rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="admin-audit"><h2 id="admin-audit" className="text-xl font-semibold">Masked audit viewer</h2><p className="mt-2 text-sm text-muted">Latest 20 branch facts; token hashes, JWTs and payment secrets are never rendered.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Reason</th></tr></thead><tbody>{overview.audits.map((audit) => <tr className="border-b" key={audit.id}><td className="p-3 text-muted">{new Date(audit.createdAt).toLocaleString()}</td><td className="p-3 font-mono">{audit.action}</td><td className="p-3">{audit.entityType} {audit.entityId ? audit.entityId.slice(0, 8) : ""}</td><td className="p-3 text-muted">{audit.reason}</td></tr>)}</tbody></table>{overview.audits.length === 0 && <p className="p-4 text-sm text-muted">No audited branch commands yet.</p>}</div></section>
    {(feedback || error) && <div className={`sticky bottom-4 rounded-2xl p-4 text-sm shadow-lg ${error ? "bg-red-50 text-red-950" : "bg-emerald-50 text-emerald-950"}`} role={error ? "alert" : "status"}>{error ?? feedback}</div>}
    <p className="text-xs text-muted">Current committed menu value: {overview.menu[0] ? `${overview.menu[0].name} · ${formatMoney(overview.menu[0].basePriceMinor, overview.menu[0].currency)}` : "No menu items"}</p>
  </div>;
}
