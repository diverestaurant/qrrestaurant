"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOverviewView } from "@/contracts/view-models";

type Props = { branchId: string; restaurantId: string; roles: AdminOverviewView["roles"] };

export function AdminStaffInvitation({ branchId, restaurantId, roles }: Props) {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    key.current ??= crypto.randomUUID();
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch("/api/v1/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, branchId, email, roleId, idempotencyKey: key.current }),
        cache: "no-store",
      });
      const body = await response.json() as { ok: boolean; data?: { membershipId: string }; error?: { message?: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "The staff invitation could not be sent.");
      key.current = null;
      setFeedback("Invitation sent and the Branch membership was committed. The staff member must choose their own password from the invitation email.");
      setEmail("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof TypeError ? "Outcome unknown. Refresh the membership list before retrying with the same button." : caught instanceof Error ? caught.message : "The staff invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-5 rounded-2xl border bg-background p-4"><h3 className="font-semibold">Invite Branch staff</h3><p className="mt-1 text-xs leading-5 text-muted">The service sends a one-time Auth invitation. No default password is created or displayed.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]"><label className="text-sm">Staff email<input autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" placeholder="staff@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-sm">Branch role<select className="mt-1 min-h-11 w-full rounded-xl border bg-surface px-3" value={roleId} onChange={(event) => setRoleId(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label><button className="min-h-11 self-end rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:bg-slate-300" disabled={busy || !email.trim() || !roleId} onClick={() => void invite()}>{busy ? "Inviting…" : "Send invite"}</button></div>{feedback && <p className="mt-3 text-sm text-emerald-700" role="status">{feedback}</p>}{error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b"><th className="p-2">Role</th><th className="p-2">Granted capabilities</th></tr></thead><tbody>{roles.map((role) => <tr className="border-b" key={role.id}><td className="p-2 font-semibold">{role.displayName}</td><td className="p-2 font-mono text-muted">{role.capabilities.join(", ") || "No operational capability"}</td></tr>)}</tbody></table></div></div>;
}
