"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/browser/staff-runtime";
import { StaffRealtimeStatus } from "@/ui/staff/StaffRealtimeStatus";
import type { StaffProfileView } from "@/modules/identity/contracts/staff-profile";
import { StaffSelfProfile } from "@/ui/staff/StaffSelfProfile";

type StaffGateProps = { access: "authorized" | "forbidden" | "signed_out"; branchId?: string; children?: ReactNode; email?: string; profile?: StaffProfileView | null; restaurantId?: string; role: string };
type GateState = { status: "checking" | "signed_out" | "signed_in" | "forbidden"; email?: string; error?: string };

export function StaffGate({ access, branchId, children, email: initialEmail, profile, restaurantId, role }: StaffGateProps) {
  const router = useRouter();
  const [localState, setLocalState] = useState<GateState>({ status: "signed_out" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const state: GateState = access === "authorized" ? { status: "signed_in", email: initialEmail } : access === "forbidden" ? { status: "forbidden", email: initialEmail } : localState;

  async function signIn() {
    setBusy(true);
    setLocalState({ status: "signed_out" });
    const result = await getBrowserSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error || !result.data.user) {
      setLocalState({ status: "signed_out", error: "Staff sign-in failed. Check the account and try again." });
      return;
    }
    setLocalState({ status: "checking" });
    router.refresh();
  }

  async function signOut() {
    setBusy(true);
    await getBrowserSupabaseClient().auth.signOut();
    setBusy(false);
    setLocalState({ status: "signed_out" });
    router.refresh();
  }

  if (state.status === "checking") return <div className="mt-6 rounded-3xl border bg-surface p-5 text-sm text-muted" role="status">Checking staff Session…</div>;
  if (state.status === "signed_out") return <section className="mt-6 rounded-3xl border border-brand/30 bg-brand-soft/20 p-5 shadow-sm" aria-labelledby={`${role.toLowerCase()}-staff-sign-in`}><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Authorized staff boundary</p><h2 id={`${role.toLowerCase()}-staff-sign-in`} className="mt-2 text-xl font-semibold">Sign in to operate {role}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Operational data and commands require an authenticated staff membership with the correct branch permissions.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Staff email<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-sm">Password<input className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label></div>{state.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}<button className="mt-4 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={busy || !email.trim() || !password} onClick={() => void signIn()}>{busy ? "Signing in…" : "Sign in"}</button></section>;
  if (state.status === "forbidden") return <section className="mt-6 rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm" role="alert"><p className="text-xs font-semibold tracking-[0.12em] uppercase">Access denied</p><h2 className="mt-2 text-xl font-semibold">This account cannot operate {role}</h2><p className="mt-2 text-sm leading-6">The signed-in account has no active membership with all required permissions for this branch.</p><button className="mt-4 min-h-11 rounded-full border border-amber-500 px-5 text-sm font-semibold" disabled={busy} onClick={() => void signOut()}>Sign out</button></section>;
  return <div className="mt-6"><div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><span className="py-2">Signed in as {state.email}</span><div className="flex flex-wrap items-start gap-4"><StaffRealtimeStatus />{branchId && restaurantId && <StaffSelfProfile branchId={branchId} initialProfile={profile ?? null} restaurantId={restaurantId} />}<button className="min-h-10 font-semibold underline underline-offset-2" disabled={busy} onClick={() => void signOut()}>Sign out</button></div></div>{children}</div>;
}
