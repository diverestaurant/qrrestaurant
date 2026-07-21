"use client";

import { useRef, useState } from "react";

type Tenant = { restaurantId: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; version: number; defaultCurrency: string; defaultTimezone: string; subscription: { id: string; planKey: string; status: "TRIAL" | "ACTIVE" | "SUSPENDED"; version: number }; branches: Array<{ id: string; name: string; slug: string; status: string; currency: string; timezone: string; version: number }> };

function TenantRow({ tenant, send, disabled }: { tenant: Tenant; send: (key: string, payload: Record<string, unknown>) => Promise<boolean>; disabled: boolean }) {
  const primaryBranch = tenant.branches[0];
  const [planKey, setPlanKey] = useState(tenant.subscription.planKey);
  const [subscriptionStatus, setSubscriptionStatus] = useState(tenant.subscription.status);
  if (!primaryBranch) return null;
  return <article className="rounded-2xl border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{tenant.name}</h3><p className="mt-1 font-mono text-xs text-muted">/{tenant.slug} · v{tenant.version}</p><p className="mt-1 text-xs text-muted">{primaryBranch.name} · {primaryBranch.timezone} · {primaryBranch.currency}</p></div><span aria-label={`${tenant.name} tenant status`} className={`rounded-full px-3 py-1 text-xs font-semibold ${tenant.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>{tenant.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_170px_auto]"><label className="text-sm">Manual plan key<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-mono uppercase disabled:opacity-60" disabled={disabled} value={planKey} onChange={(event) => setPlanKey(event.target.value.toUpperCase())} /></label><label className="text-sm">Subscription status<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 disabled:opacity-60" disabled={disabled} value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as Tenant["subscription"]["status"])}><option>TRIAL</option><option>ACTIVE</option><option>SUSPENDED</option></select></label><button className="min-h-11 self-end rounded-full border px-4 text-sm font-semibold disabled:opacity-60" disabled={disabled} onClick={() => void send(`subscription:${tenant.restaurantId}`, { type: "platform.subscription.update", restaurantId: tenant.restaurantId, branchId: primaryBranch.id, expectedVersion: tenant.subscription.version, planKey, status: subscriptionStatus })}>Save tracking</button></div><div className="mt-4 flex flex-wrap items-center gap-3"><button className={`min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${tenant.status === "ACTIVE" ? "border border-amber-400 text-amber-900" : "bg-brand text-white"}`} disabled={disabled} onClick={() => void send(`lifecycle:${tenant.restaurantId}`, { type: "platform.restaurant.lifecycle.set", restaurantId: tenant.restaurantId, branchId: primaryBranch.id, expectedVersion: tenant.version, status: tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE", reason: tenant.status === "ACTIVE" ? "Platform Admin suspended tenant access" : "Platform Admin restored tenant access" })}>{tenant.status === "ACTIVE" ? "Suspend access" : "Reactivate access"}</button><p className="text-xs text-muted">Suspension preserves all data and immediately removes ordinary staff/public access. No billing action is performed.</p></div></article>;
}

export function PlatformTenantLifecycle() {
  const keys = useRef<Record<string, string>>({});
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("main");

  async function load() {
    setBusy("load"); setError(null);
    try {
      const response = await fetch("/api/v1/platform/tenants", { cache: "no-store" });
      const body = await response.json() as { ok: boolean; data?: Tenant[]; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "Platform tenants could not be loaded.");
      setTenants(body.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Platform tenants could not be loaded."); } finally { setBusy(null); }
  }

  async function send(key: string, payload: Record<string, unknown>) {
    setBusy(key); setError(null); setFeedback(null);
    keys.current[key] ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/platform/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: keys.current[key] }) });
      const body = await response.json() as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Platform command could not be completed.");
      delete keys.current[key];
      setFeedback("Platform tenant command committed and audited.");
      await load();
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Platform command could not be completed."); return false; } finally { setBusy(null); }
  }

  async function createTenant() {
    const created = await send("tenant:create", { type: "platform.restaurant.create", name, slug, defaultCurrency: "MYR", defaultTimezone: "Asia/Kuching", branchName, branchSlug, planKey: "MANUAL_V1" });
    if (created) { setName(""); setSlug(""); setBranchName(""); setBranchSlug("main"); }
  }

  return <section className="mt-8 rounded-3xl border border-brand/30 bg-surface p-6 shadow-sm" aria-labelledby="platform-tenants"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Platform-only boundary</p><h2 id="platform-tenants" className="mt-2 text-xl font-semibold">Restaurant lifecycle and manual subscription tracking</h2><p className="mt-2 text-sm leading-6 text-muted">Create an isolated Restaurant and first Branch, or suspend/reactivate access without deleting data. Automated billing remains deferred.</p></div><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={busy !== null} onClick={() => void load()}>{busy === "load" ? "Loading…" : tenants ? "Refresh tenants" : "Load platform tenants"}</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Restaurant name<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm">Restaurant slug<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></label><label className="text-sm">First Branch name<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={branchName} onChange={(event) => setBranchName(event.target.value)} /></label><label className="text-sm">Branch slug<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" value={branchSlug} onChange={(event) => setBranchSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></label></div><button className="mt-4 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy !== null || !name.trim() || !slug || !branchName.trim() || !branchSlug} onClick={() => void createTenant()}>Create isolated tenant</button>{feedback && <p className="mt-4 text-sm text-emerald-700" role="status">{feedback}</p>}{error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}{tenants && <div className="mt-6 space-y-3">{tenants.map((tenant) => <TenantRow disabled={busy !== null} key={tenant.restaurantId} send={send} tenant={tenant} />)}</div>}</section>;
}
