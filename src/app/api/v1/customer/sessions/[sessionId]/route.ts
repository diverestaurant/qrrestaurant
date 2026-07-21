import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import type { CustomerSessionView } from "@/contracts/view-models";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ sessionId: string }> };
type SessionRow = { id: string; restaurant_id: string; branch_id: string; state: CustomerSessionView["state"]; version: number; total_due_minor: number | string; total_paid_minor: number | string; currency: string };

function safeMinor(value: number | string, label: string) {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new AppError("INTERNAL_ERROR", `The Session ${label} is invalid.`);
  return minor;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { sessionId } = await context.params;
    if (!z.uuid().safeParse(sessionId).success) throw new AppError("VALIDATION_ERROR", "Session id is invalid.");
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can read a customer Session.");

    const [sessionResult, grantResult] = await Promise.all([
      supabase.from("dining_sessions").select("id,restaurant_id,branch_id,state,version,total_due_minor,total_paid_minor,currency").eq("id", sessionId).maybeSingle(),
      supabase.from("customer_session_grants").select("expires_at").eq("session_id", sessionId).is("revoked_at", null).order("expires_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (sessionResult.error || grantResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the customer Session.", true);
    if (!sessionResult.data || !grantResult.data) throw new AppError("FORBIDDEN", "Join the table before reading this Session.");
    const session = sessionResult.data as SessionRow;
    const data: CustomerSessionView = {
      status: "ready",
      freshness: "fresh",
      sessionId: session.id,
      restaurantId: session.restaurant_id,
      branchId: session.branch_id,
      state: session.state,
      version: session.version,
      totalDueMinor: safeMinor(session.total_due_minor, "balance"),
      totalPaidMinor: safeMinor(session.total_paid_minor, "paid balance"),
      currency: session.currency,
      grantExpiresAt: grantResult.data.expires_at,
      lastSyncedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, data, meta: { correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
