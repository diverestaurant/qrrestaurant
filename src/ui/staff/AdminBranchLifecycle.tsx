"use client";

import { useRef, useState } from "react";

type Branch = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; currency: string; timezone: string; businessDayCutoff: string; defaultLocale: "en" | "zh" | "ms"; version: number; createdAt: string };

export function AdminBranchLifecycle({ restaurantId, anchorBranchId, defaultCurrency, defaultTimezone }: { restaurantId: string; anchorBranchId: string; defaultCurrency: string; defaultTimezone: string }) {
  const keys = useRef<Record<string, string>>({});
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [cutoff, setCutoff] = useState("04:00");

  async function load() {
    setBusy("load"); setError(null);
    try {
      const query = new URLSearchParams({ restaurantId, anchorBranchId });
      const response = await fetch(`/api/v1/staff/branches?${query}`, { cache: "no-store" });
      const body = await response.json() as { ok: boolean; data?: Branch[]; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "Branch catalog could not be loaded.");
      setBranches(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Branch catalog could not be loaded.");
    } finally { setBusy(null); }
  }

  async function send(key: string, payload: Record<string, unknown>) {
    setBusy(key); setError(null); setFeedback(null);
    keys.current[key] ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/staff/branches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, restaurantId, anchorBranchId, idempotencyKey: keys.current[key] }) });
      const body = await response.json() as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Branch lifecycle command could not be completed.");
      delete keys.current[key];
      setFeedback("Branch lifecycle command committed and audited.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof TypeError ? "Outcome unknown. Refresh before retrying the same Branch command." : caught instanceof Error ? caught.message : "Branch lifecycle command could not be completed.");
      return false;
    } finally { setBusy(null); }
  }

  return <section className="mt-8 rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="branch-lifecycle" aria-busy={busy !== null}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Owner-only Restaurant scope</p><h2 id="branch-lifecycle" className="mt-2 text-xl font-semibold">Branches and lifecycle</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Create an isolated Branch or suspend access without deleting records. Suspension revokes Table Entry QR tokens and customer grants; reactivation requires new customer entry credentials.</p></div><button className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={busy !== null} onClick={() => void load()}>{busy === "load" ? "Loading…" : branches ? "Refresh Branches" : "Load Branches"}</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm lg:col-span-2">Branch name<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy !== null} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm">Slug<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy !== null} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></label><label className="text-sm">Currency<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 uppercase" disabled={busy !== null} maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label><label className="text-sm">Business-day cutoff<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy !== null} type="time" value={cutoff} onChange={(event) => setCutoff(event.target.value)} /></label><label className="text-sm lg:col-span-2">Timezone<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" disabled={busy !== null} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><button className="min-h-11 self-end rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy !== null || !name.trim() || !slug || currency.length !== 3 || !timezone || !cutoff} onClick={() => void send("branch:create", { type: "branch.create", name, slug, currency, timezone, businessDayCutoff: cutoff, defaultLocale: "en", countryCode: "MY" }).then((created) => { if (created) { setName(""); setSlug(""); } })}>Create Branch</button></div>
    {feedback && <p className="mt-4 text-sm text-emerald-700" role="status">{feedback}</p>}{error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
    {branches && <div className="mt-6 space-y-3">{branches.map((branch) => <article className="rounded-2xl border bg-background p-4" key={branch.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{branch.name}</h3><p className="mt-1 font-mono text-xs text-muted">/{branch.slug} · v{branch.version}</p><p className="mt-1 text-xs text-muted">{branch.timezone} · {branch.currency} · cutoff {branch.businessDayCutoff}</p></div><span aria-label={`${branch.name} Branch status`} className={`rounded-full px-3 py-1 text-xs font-semibold ${branch.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>{branch.status}</span></div><div className="mt-4 flex flex-wrap items-center gap-3"><button className={`min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${branch.status === "ACTIVE" ? "border border-amber-400 text-amber-950" : "bg-brand text-white"}`} disabled={busy !== null} onClick={() => void send(`branch:lifecycle:${branch.id}`, { type: "branch.lifecycle.set", branchId: branch.id, expectedVersion: branch.version, status: branch.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE", reason: branch.status === "ACTIVE" ? "Restaurant Owner suspended Branch access" : "Restaurant Owner restored Branch access" })}>{branch.status === "ACTIVE" ? "Suspend Branch" : "Reactivate Branch"}</button>{branch.id === anchorBranchId && <span className="text-xs text-muted">Current Admin Branch</span>}</div></article>)}</div>}
  </section>;
}
