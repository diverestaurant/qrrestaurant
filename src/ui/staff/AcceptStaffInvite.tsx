"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/browser/staff-runtime";

export function AcceptStaffInvite() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    void supabase.auth.getUser().then((result) => setReady(Boolean(result.data.user) && !result.error));
    const listener = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session?.user)));
    return () => listener.data.subscription.unsubscribe();
  }, []);

  async function savePassword() {
    if (password.length < 12 || password !== confirmation) return;
    setBusy(true);
    setError(null);
    const result = await getBrowserSupabaseClient().auth.updateUser({ password });
    setBusy(false);
    if (result.error) {
      setError("The password could not be saved. Request a new invitation if this link expired.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <section className="w-full rounded-3xl border bg-surface p-6 shadow-sm" aria-labelledby="accept-invite"><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">DIVE staff access</p><h1 className="mt-2 text-2xl font-semibold" id="accept-invite">Choose your staff password</h1><p className="mt-3 text-sm leading-6 text-muted">The invitation grants only its assigned Branch role. Use a unique password that you do not use elsewhere.</p>{!ready ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">Checking the invitation Session. If this does not complete, the link is expired or already used.</div> : <><label className="mt-5 block text-sm">New password<input autoComplete="new-password" className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3" minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="mt-4 block text-sm">Confirm password<input autoComplete="new-password" className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3" minLength={12} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><p className="mt-2 text-xs text-muted">Minimum 12 characters. MFA policy is configured separately before release.</p><button className="mt-5 min-h-12 w-full rounded-full bg-brand px-5 font-semibold text-white disabled:bg-slate-300" disabled={busy || password.length < 12 || password !== confirmation} onClick={() => void savePassword()}>{busy ? "Saving…" : "Save password"}</button>{error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}</>}</section>;
}
