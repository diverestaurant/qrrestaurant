import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { joinSession } from "@/modules/sessions/application/join-session";
import { joinCustomerSessionSchema } from "@/modules/sessions/contracts/commands";
import { createJoinSessionRepository } from "@/modules/sessions/infrastructure/join-session-repository";
import { joinPublicTableSession } from "@/modules/sessions/infrastructure/public-entry-repository";
import { getServerSupabaseClient } from "@/server/supabase/server";

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
    const command = joinCustomerSessionSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can join a Session.");
    const result = "sessionId" in command
      ? { sessionId: command.sessionId, ...(await joinSession(command, { anonymousUserId: user.id }, createJoinSessionRepository(supabase))) }
      : await joinPublicTableSession(command, user.id, supabase);
    return NextResponse.json({ ok: true, data: result, meta: { correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
