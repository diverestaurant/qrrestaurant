import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { requestFingerprint } from "@/modules/ordering/application/idempotency";
import { openSession } from "@/modules/sessions/application/open-session";
import { openSessionSchema } from "@/modules/sessions/contracts/commands";
import { createSessionRepository } from "@/modules/sessions/infrastructure/session-repository";
import { getServerSupabaseClient } from "@/server/supabase/server";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = openSessionSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");

    const repository = createSessionRepository(supabase, userResult.data.user.id);
    const table = await repository.getTable(command.tableId);
    if (!table) throw new AppError("NOT_FOUND", "This table is not available.");
    const serviceRole = getServiceRoleSupabaseClient();
    const requestHash = requestFingerprint(command);
    const existingResult = await serviceRole.from("idempotency_keys").select("request_hash,status,result").eq("restaurant_id", table.restaurant_id).eq("branch_id", table.branch_id).eq("command_type", "session.open").eq("actor_fingerprint", userResult.data.user.id).eq("idempotency_key", command.idempotencyKey).maybeSingle();
    if (existingResult.error) throw new AppError("INTERNAL_ERROR", "Unable to check command idempotency.", true);
    if (existingResult.data) {
      if (existingResult.data.request_hash !== requestHash) throw new AppError("CONFLICT", "This idempotency key was already used for a different request.");
      if (existingResult.data.status === "COMPLETED") return NextResponse.json({ ok: true, data: existingResult.data.result, meta: { replay: true, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
      if (existingResult.data.status === "IN_PROGRESS") throw new AppError("UNKNOWN_OUTCOME", "This command is already being processed. Check the Session status before retrying.", true);
    }

    const scopeQuery = serviceRole.from("idempotency_keys").update({ status: "IN_PROGRESS", result: null, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq("restaurant_id", table.restaurant_id).eq("branch_id", table.branch_id).eq("command_type", "session.open").eq("actor_fingerprint", userResult.data.user.id).eq("idempotency_key", command.idempotencyKey);
    const reserveResult = existingResult.data?.status === "FAILED" ? await scopeQuery : await serviceRole.from("idempotency_keys").insert({ restaurant_id: table.restaurant_id, branch_id: table.branch_id, command_type: "session.open", actor_fingerprint: userResult.data.user.id, idempotency_key: command.idempotencyKey, request_hash: requestHash, status: "IN_PROGRESS", expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    if (reserveResult.error && reserveResult.error.code !== "23505") throw new AppError("INTERNAL_ERROR", "Unable to reserve command idempotency.", true);
    if (reserveResult.error?.code === "23505") throw new AppError("UNKNOWN_OUTCOME", "This command may already be processing. Check the Session status before retrying.", true);

    try {
      const result = await openSession(command, {
        getTable: async () => ({ branchId: table.branch_id, restaurantId: table.restaurant_id, active: table.active, capacity: table.capacity }),
        getActiveSession: repository.getActiveSession,
        open: repository.open,
      });
      await serviceRole.from("idempotency_keys").update({ status: "COMPLETED", result: result }).eq("restaurant_id", table.restaurant_id).eq("branch_id", table.branch_id).eq("command_type", "session.open").eq("actor_fingerprint", userResult.data.user.id).eq("idempotency_key", command.idempotencyKey);
      return NextResponse.json({ ok: true, data: result, meta: { replay: false, correlationId: requestId } }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await serviceRole.from("idempotency_keys").update({ status: "FAILED", result: { error: error instanceof AppError ? error.code : "INTERNAL_ERROR" } }).eq("restaurant_id", table.restaurant_id).eq("branch_id", table.branch_id).eq("command_type", "session.open").eq("actor_fingerprint", userResult.data.user.id).eq("idempotency_key", command.idempotencyKey);
      throw error;
    }
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
