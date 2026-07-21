import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { issueReceiptSchema } from "@/modules/payments/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ sessionId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { sessionId } = await context.params;
    const command = issueReceiptSchema.parse({ ...(await readJson(request)), sessionId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const sessionResult = await supabase.from("dining_sessions").select("restaurant_id,branch_id").eq("id", command.sessionId).maybeSingle();
    if (sessionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the Session scope.", true);
    if (!sessionResult.data) throw new AppError("NOT_FOUND", "Session not found.");
    const session = sessionResult.data as { restaurant_id: string; branch_id: string };
    const execution = await executeIdempotentCommand({ restaurantId: session.restaurant_id, branchId: session.branch_id, actorId: userResult.data.user.id, commandType: "receipt.issue", idempotencyKey: command.idempotencyKey, command }, async () => {
      const result = await supabase.rpc("issue_receipt", { p_session_id: command.sessionId, p_actor_id: userResult.data.user.id }).single();
      if (result.error) {
        if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to issue a receipt.");
        if (result.error.code === "P0001") throw new AppError("CONFLICT", "The Session must be fully paid before issuing a receipt.", true);
        throw new AppError("INTERNAL_ERROR", "Unable to issue the receipt.", true);
      }
      const row = result.data as { receipt_id: string; receipt_number: string; snapshot: Record<string, unknown> } | null;
      if (!row) throw new AppError("CONFLICT", "The receipt could not be issued. Refresh before retrying.", true);
      return { receiptId: row.receipt_id, receiptNumber: row.receipt_number, snapshot: row.snapshot };
    });
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
