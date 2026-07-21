import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { confirmPayment } from "@/modules/payments/application/confirm-payment";
import { confirmPaymentSchema } from "@/modules/payments/contracts/commands";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ paymentId: string }> };
type PaymentRow = { restaurant_id: string; branch_id: string; session_id: string; state: "PENDING" | "CONFIRMED" | "FAILED"; method: "CASH" | "CARD" | "DUITNOW" | "E_WALLET" | "OTHER"; amount_minor: number | string };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

function safeMinor(value: number | string, label: string) {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new AppError("INTERNAL_ERROR", `The payment ${label} is invalid.`);
  return minor;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { paymentId } = await context.params;
    const command = confirmPaymentSchema.parse({ ...(await readJson(request)), paymentId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const paymentResult = await supabase.from("payments").select("restaurant_id,branch_id,session_id,state,method,amount_minor").eq("id", command.paymentId).maybeSingle();
    if (paymentResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the payment.", true);
    if (!paymentResult.data) throw new AppError("NOT_FOUND", "Payment not found.");
    const payment = paymentResult.data as PaymentRow;
    const sessionResult = await supabase.from("dining_sessions").select("total_due_minor,total_paid_minor").eq("id", payment.session_id).maybeSingle();
    if (sessionResult.error || !sessionResult.data) throw new AppError("INTERNAL_ERROR", "Unable to read the Session balance.", true);
    const totalDueMinor = safeMinor((sessionResult.data as { total_due_minor: number | string }).total_due_minor, "total");
    const totalPaidMinor = safeMinor((sessionResult.data as { total_paid_minor: number | string }).total_paid_minor, "paid total");
    const amountMinor = safeMinor(payment.amount_minor, "amount");
    const execution = await executeIdempotentCommand({ restaurantId: payment.restaurant_id, branchId: payment.branch_id, actorId: userResult.data.user.id, commandType: "payment.confirm", idempotencyKey: command.idempotencyKey, command }, () => confirmPayment(command, {
      getPayment: async () => ({ branchId: payment.branch_id, state: payment.state, method: payment.method, amountMinor, outstandingMinor: totalDueMinor - totalPaidMinor }),
      confirm: async (confirmCommand) => {
        const result = await supabase.rpc("confirm_payment", { p_payment_id: confirmCommand.paymentId, p_cash_received_minor: confirmCommand.cashReceivedMinor ?? null, p_observed_reference: confirmCommand.observedReference ?? null, p_actor_id: userResult.data.user.id }).single();
        if (result.error) {
          if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to confirm this payment.");
          if (result.error.code === "22023") throw new AppError("VALIDATION_ERROR", "Payment confirmation details are invalid.");
          if (result.error.code === "P0001") throw new AppError("CONFLICT", "The payment or Session balance changed. Refresh before retrying.", true);
          throw new AppError("INTERNAL_ERROR", "Unable to confirm the payment.", true);
        }
        const row = result.data as { payment_id: string; state: "CONFIRMED"; change_minor: number | string } | null;
        if (!row) throw new AppError("CONFLICT", "The payment could not be confirmed. Refresh before retrying.", true);
        return { paymentId: row.payment_id, state: row.state, changeMinor: safeMinor(row.change_minor, "change") };
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
