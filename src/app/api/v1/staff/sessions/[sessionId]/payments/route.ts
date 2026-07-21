import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { beginPayment } from "@/modules/payments/application/begin-payment";
import { beginPaymentSchema } from "@/modules/ordering/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ sessionId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

function safeMinor(value: number | string, label: string) {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new AppError("INTERNAL_ERROR", `The Session ${label} is invalid.`);
  return minor;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { sessionId } = await context.params;
    const command = beginPaymentSchema.parse({ ...(await readJson(request)), sessionId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const sessionResult = await supabase.from("dining_sessions").select("restaurant_id,branch_id,total_due_minor,total_paid_minor,currency,version").eq("id", command.sessionId).maybeSingle();
    if (sessionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the Session balance.", true);
    if (!sessionResult.data) throw new AppError("NOT_FOUND", "Session not found.");
    const session = sessionResult.data as { restaurant_id: string; branch_id: string; total_due_minor: number | string; total_paid_minor: number | string; currency: string; version: number };
    const totalDueMinor = safeMinor(session.total_due_minor, "due");
    const totalPaidMinor = safeMinor(session.total_paid_minor, "paid total");
    const execution = await executeIdempotentCommand({ restaurantId: session.restaurant_id, branchId: session.branch_id, actorId: userResult.data.user.id, commandType: "payment.begin", idempotencyKey: command.idempotencyKey, command }, () => beginPayment(command, {
      getBalance: async () => ({ outstandingMinor: totalDueMinor - totalPaidMinor, currency: session.currency, version: session.version }),
      begin: async (beginCommand) => {
        const result = await supabase.rpc("begin_payment", { p_session_id: beginCommand.sessionId, p_amount_minor: beginCommand.amountMinor, p_currency: beginCommand.currency, p_method: beginCommand.method, p_expected_session_version: beginCommand.expectedSessionVersion, p_idempotency_key: beginCommand.idempotencyKey, p_actor_id: userResult.data.user.id }).single();
        if (result.error) {
          if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to begin this payment.");
          if (result.error.code === "22023") throw new AppError("VALIDATION_ERROR", "Payment amount or currency is invalid.");
          if (result.error.code === "P0001" || result.error.code === "P0003") throw new AppError("CONFLICT", "The bill changed. Refresh before starting another payment.", true);
          if (result.error.code === "23505") throw new AppError("UNKNOWN_OUTCOME", "This payment may already be processing. Check the bill before retrying.", true);
          throw new AppError("INTERNAL_ERROR", "Unable to begin the payment.", true);
        }
        const row = result.data as { payment_id: string; state: "PENDING"; version: number } | null;
        if (!row) throw new AppError("CONFLICT", "The payment could not be started. Refresh before retrying.", true);
        return { paymentId: row.payment_id, status: row.state };
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
