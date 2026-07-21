import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import type { CustomerServiceRequestView } from "@/contracts/view-models";
import { createServiceRequest } from "@/modules/service-requests/application/create-request";
import { createServiceRequestSchema } from "@/modules/service-requests/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = createServiceRequestSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can create a service request.");
    const sessionResult = await supabase.from("dining_sessions").select("restaurant_id,branch_id,state").eq("id", command.sessionId).maybeSingle();
    if (sessionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the Session.", true);
    if (!sessionResult.data) throw new AppError("FORBIDDEN", "This Session cannot accept service requests.");
    const session = sessionResult.data as { restaurant_id: string; branch_id: string };
    const execution = await executeIdempotentCommand({ restaurantId: session.restaurant_id, branchId: session.branch_id, actorId: user.id, commandType: "service_request.create", idempotencyKey: command.idempotencyKey, command }, () => createServiceRequest(command, {
      getSession: async (sessionId) => {
        const result = await supabase.from("dining_sessions").select("branch_id,state").eq("id", sessionId).maybeSingle();
        if (result.error || !result.data) return null;
        const row = result.data as { branch_id: string; state: "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED" };
        return { branchId: row.branch_id, state: row.state, customerCanWrite: true };
      },
      create: async (createCommand, scope) => {
        if (scope.branchId !== session.branch_id) throw new AppError("FORBIDDEN", "This Session cannot accept service requests.");
        const result = await supabase.rpc("create_customer_service_request", {
          p_session_id: createCommand.sessionId,
          p_request_type: createCommand.requestType,
          p_note: createCommand.note ?? null,
          p_request_id: crypto.randomUUID(),
        }).single();
        if (result.error?.code === "42501") throw new AppError("FORBIDDEN", result.error.message);
        if (result.error?.code === "22023") throw new AppError("VALIDATION_ERROR", result.error.message);
        if (result.error || !result.data) throw new AppError("INTERNAL_ERROR", "Unable to create the service request.", true);
        const row = result.data as { request_id: string; version: number };
        return { requestId: row.request_id, version: row.version };
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  const requestId = correlationId();
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId || !z.uuid().safeParse(sessionId).success) throw new AppError("VALIDATION_ERROR", "Session id is invalid.");
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can read service requests.");
    const result = await supabase.from("service_requests").select("id,request_type,note,state,version,created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(20);
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to read service requests.", true);
    const data = ((result.data ?? []) as Array<{ id: string; request_type: CustomerServiceRequestView["requestType"]; note: string | null; state: CustomerServiceRequestView["state"]; version: number; created_at: string }>).map((requestRow) => ({ id: requestRow.id, requestType: requestRow.request_type, note: requestRow.note, state: requestRow.state, version: requestRow.version, createdAt: requestRow.created_at } satisfies CustomerServiceRequestView));
    return NextResponse.json({ ok: true, data, meta: { correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
