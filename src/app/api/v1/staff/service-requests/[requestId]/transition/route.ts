import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { transitionServiceRequest } from "@/modules/service-requests/application/transition-request";
import { transitionServiceRequestSchema } from "@/modules/service-requests/contracts/commands";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ requestId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { requestId: pathRequestId } = await context.params;
    const command = transitionServiceRequestSchema.parse({ ...(await readJson(request)), requestId: pathRequestId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const requestResult = await supabase.from("service_requests").select("restaurant_id,branch_id,state,version").eq("id", command.requestId).maybeSingle();
    if (requestResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the service request.", true);
    if (!requestResult.data) throw new AppError("NOT_FOUND", "Service request not found.");
    const scope = requestResult.data as { restaurant_id: string; branch_id: string };
    const execution = await executeIdempotentCommand({ restaurantId: scope.restaurant_id, branchId: scope.branch_id, actorId: userResult.data.user.id, commandType: "service_request.transition", idempotencyKey: command.idempotencyKey, command }, () => transitionServiceRequest(command, {
      getRequest: async (requestId) => {
        const result = await supabase.from("service_requests").select("branch_id,state,version").eq("id", requestId).maybeSingle();
        if (result.error || !result.data) return null;
        const row = result.data as { branch_id: string; state: "OPEN" | "CLAIMED" | "RESOLVED" | "CANCELLED"; version: number };
        return { branchId: row.branch_id, state: row.state, version: row.version };
      },
      updateRequest: async (updateCommand, current) => {
        const result = await supabase.rpc("transition_service_request", { p_request_id: updateCommand.requestId, p_next_state: updateCommand.nextState, p_expected_version: current.version }).single();
        if (result.error?.code === "42501") throw new AppError("FORBIDDEN", "Service request permission is required.");
        if (result.error?.code === "P0002") throw new AppError("NOT_FOUND", "Service request not found.");
        if (result.error?.code === "P0003") throw new AppError("STALE_STATE", "This service request changed. Refresh the floor view.", true);
        if (result.error?.code === "P0001") throw new AppError("CONFLICT", "The service request transition conflicts with its current state.");
        if (result.error || !result.data) throw new AppError("INTERNAL_ERROR", "Unable to update the service request.", true);
        const row = result.data as { version: number; state: "OPEN" | "CLAIMED" | "RESOLVED" | "CANCELLED" };
        return row;
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
