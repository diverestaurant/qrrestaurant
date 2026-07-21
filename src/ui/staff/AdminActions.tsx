"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

type Report = { branchName: string; activeTables: number; openSessions: number; outstandingServiceRequests: number; unavailableMenuItems: number; totalDueMinor: number; totalPaidMinor: number };

export function AdminActions({ branchId }: { branchId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function readReport() {
    setBusy("report"); setError(null);
    try {
      const response = await fetch(`/api/v1/staff/reports/branch-summary?branchId=${branchId}`, { cache: "no-store" });
      const body = await response.json() as { ok: boolean; data?: Report; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "The branch report could not be loaded.");
      setReport(body.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The branch report could not be loaded."); } finally { setBusy(null); }
  }

  return <section className="mt-8 rounded-3xl border bg-surface p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Authorized report boundary</p><h2 className="mt-2 text-xl font-semibold">Read committed branch totals</h2></div><p className="text-sm text-muted">The report is server-authorized and tenant scoped.</p></div><div className="mt-5 flex flex-wrap gap-3"><button className="min-h-11 rounded-full border px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400" disabled={busy !== null} onClick={() => void readReport()}>{busy === "report" ? "Loading…" : "Load branch report"}</button></div>{report && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Branch report"><p className="rounded-2xl bg-background p-3 text-sm">{report.activeTables} active tables</p><p className="rounded-2xl bg-background p-3 text-sm">{report.openSessions} open Sessions</p><p className="rounded-2xl bg-background p-3 text-sm">{report.outstandingServiceRequests} open requests</p><p className="rounded-2xl bg-background p-3 text-sm">{formatMoney(Math.max(0, report.totalDueMinor - report.totalPaidMinor))} outstanding</p></div>}{error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}</section>;
}
