"use client";

import { useRef, useState } from "react";
import type { StaffProfileLocale, StaffProfileView } from "@/modules/identity/contracts/staff-profile";

export function StaffSelfProfile({ branchId, initialProfile, restaurantId }: { branchId: string; initialProfile: StaffProfileView | null; restaurantId: string }) {
  const [profile, setProfile] = useState(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? "");
  const [preferredLocale, setPreferredLocale] = useState<StaffProfileLocale>(initialProfile?.preferredLocale ?? "en");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/staff/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, branchId, displayName, preferredLocale, expectedVersion: profile?.version ?? 0, idempotencyKey: idempotencyKey.current }),
        cache: "no-store",
      });
      const body = await response.json() as { ok: boolean; data?: StaffProfileView; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "The staff profile could not be saved.");
      setProfile(body.data);
      setDisplayName(body.data.displayName);
      setPreferredLocale(body.data.preferredLocale);
      setMessage(`Profile saved · version ${body.data.version}`);
      idempotencyKey.current = null;
    } catch (caught) {
      setError(caught instanceof TypeError ? "Outcome unknown. Refresh before retrying this same profile change." : caught instanceof Error ? caught.message : "The staff profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="rounded-xl border border-emerald-300 bg-white/70 px-3 py-2 text-foreground">
    <summary className="min-h-7 cursor-pointer text-sm font-semibold">My profile{profile ? ` · ${profile.displayName}` : ""}</summary>
    <div className="mt-3 grid min-w-64 gap-3 sm:min-w-96 sm:grid-cols-2">
      <label className="text-xs">Display name<input className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label className="text-xs">Language preference<select className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm" value={preferredLocale} onChange={(event) => setPreferredLocale(event.target.value as StaffProfileLocale)}><option value="en">English · active</option><option value="zh">Chinese · English fallback</option><option value="ms">Bahasa Melayu · English fallback</option></select></label>
    </div>
    {preferredLocale !== "en" && <p className="mt-2 max-w-sm text-xs text-muted">This preference is saved, but English remains active until the translated catalog is approved.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3"><button className="min-h-10 rounded-full bg-brand px-4 text-xs font-semibold text-white disabled:bg-slate-300" disabled={busy || !displayName.trim()} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save my profile"}</button>{message && <span className="text-xs text-emerald-800" role="status">{message}</span>}{error && <span className="text-xs text-danger" role="alert">{error}</span>}</div>
  </details>;
}
