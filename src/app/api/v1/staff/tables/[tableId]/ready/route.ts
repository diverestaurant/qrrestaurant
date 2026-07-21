import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { markTableReadySchema } from "@/modules/sessions/contracts/waiter-commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ tableId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { tableId } = await context.params;
    const body = await request.json().catch(() => { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); });
    const command = markTableReadySchema.parse({ ...body, tableId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const scopeResult = await supabase.from("restaurant_tables").select("restaurant_id,branch_id").eq("id", tableId).maybeSingle();
    if (scopeResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the table scope.", true);
    if (!scopeResult.data) throw new AppError("NOT_FOUND", "Table not found.");
    await requireStaffCapabilities({ restaurantId: scopeResult.data.restaurant_id, branchId: scopeResult.data.branch_id, requiredCapabilities: ["order.serve"], supabase, user: userResult.data.user });
    const execution = await executeIdempotentCommand({ restaurantId: scopeResult.data.restaurant_id, branchId: scopeResult.data.branch_id, actorId: userResult.data.user.id, commandType: "table.mark_ready", idempotencyKey: command.idempotencyKey, command }, async () => {
      const result = await supabase.rpc("mark_restaurant_table_ready", { p_table_id: tableId, p_expected_version: command.expectedVersion }).single();
      if (result.error?.code === "42501") throw new AppError("FORBIDDEN", "Table-ready permission is required.");
      if (result.error?.code === "P0002") throw new AppError("NOT_FOUND", "Table not found.");
      if (result.error?.code === "P0003") throw new AppError("STALE_STATE", "The table changed. Refresh before marking it ready.", true);
      if (result.error?.code === "P0001") throw new AppError("CONFLICT", result.error.message);
      if (result.error || !result.data) throw new AppError("INTERNAL_ERROR", "Unable to mark the table ready.", true);
      return result.data as { version: number; operational_state: string };
    });
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : ["CONFLICT", "STALE_STATE", "UNKNOWN_OUTCOME"].includes(body.error.code) ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
