import { createHash, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { rotateJoinCode } from "@/modules/sessions/application/rotate-join-code";
import { rotateJoinCodeSchema } from "@/modules/sessions/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ sessionId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { sessionId } = await context.params;
    const command = rotateJoinCodeSchema.parse({ ...(await readJson(request)), sessionId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const sessionResult = await supabase.from("dining_sessions").select("restaurant_id,branch_id,state,version").eq("id", command.sessionId).maybeSingle();
    if (sessionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the Session.", true);
    if (!sessionResult.data) throw new AppError("NOT_FOUND", "Session not found.");
    const session = sessionResult.data as { restaurant_id: string; branch_id: string; state: string; version: number };
    await requireStaffCapabilities({ branchId: session.branch_id, restaurantId: session.restaurant_id, requiredCapabilities: ["session.rotate_join_code"], supabase, user: userResult.data.user });

    const execution = await executeIdempotentCommand({ restaurantId: session.restaurant_id, branchId: session.branch_id, actorId: userResult.data.user.id, commandType: "session.rotate_join_code", idempotencyKey: command.idempotencyKey, command }, () => rotateJoinCode(command, {
      getSession: async () => ({ state: session.state, version: session.version, staffCanRotate: true }),
      rotate: async () => {
        const joinCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const result = await supabase.rpc("rotate_session_join_code", { p_session_id: command.sessionId, p_expected_session_version: command.expectedSessionVersion, p_code_hash: createHash("sha256").update(joinCode).digest("hex"), p_expires_at: expiresAt }).single();
        if (result.error) {
          if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to rotate this Join Code.");
          if (result.error.code === "P0003") throw new AppError("STALE_STATE", "The Session changed. Refresh before rotating its Join Code.", true);
          if (result.error.code === "P0004") throw new AppError("CONFLICT", "Only an open Session can rotate its Join Code.");
          throw new AppError("INTERNAL_ERROR", "Unable to rotate the Join Code.", true);
        }
        const row = result.data as { session_id: string; version: number } | null;
        if (!row) throw new AppError("INTERNAL_ERROR", "The Join Code was not rotated.", true);
        return { sessionId: row.session_id, version: row.version, joinCode, expiresAt };
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
