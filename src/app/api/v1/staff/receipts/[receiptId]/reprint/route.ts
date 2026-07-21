import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { reprintReceiptSchema } from "@/modules/payments/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ receiptId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { receiptId } = await context.params;
    const command = reprintReceiptSchema.parse({ ...(await readJson(request)), receiptId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const receiptResult = await supabase.from("receipts").select("restaurant_id,branch_id").eq("id", command.receiptId).maybeSingle();
    if (receiptResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the receipt scope.", true);
    if (!receiptResult.data) throw new AppError("NOT_FOUND", "Receipt not found.");
    const receipt = receiptResult.data as { restaurant_id: string; branch_id: string };
    const execution = await executeIdempotentCommand({ restaurantId: receipt.restaurant_id, branchId: receipt.branch_id, actorId: userResult.data.user.id, commandType: "receipt.reprint", idempotencyKey: command.idempotencyKey, command }, async () => {
      const result = await supabase.rpc("reprint_receipt", { p_receipt_id: command.receiptId, p_actor_id: userResult.data.user.id }).single();
      if (result.error) {
        if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to reprint this receipt.");
        throw new AppError("INTERNAL_ERROR", "Unable to reprint the receipt.", true);
      }
      const row = result.data as { receipt_id: string; receipt_number: string; snapshot: Record<string, unknown> } | null;
      if (!row) throw new AppError("CONFLICT", "The receipt could not be reprinted. Refresh before retrying.", true);
      return { receiptId: row.receipt_id, receiptNumber: row.receipt_number, snapshot: row.snapshot };
    });
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
