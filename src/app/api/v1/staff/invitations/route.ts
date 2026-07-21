import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { logger } from "@/server/observability/logger";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import { getServerSupabaseClient } from "@/server/supabase/server";

const invitationSchema = z.object({
  restaurantId: z.uuid(),
  branchId: z.uuid(),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  roleId: z.uuid(),
  idempotencyKey: z.uuid(),
});

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function membershipError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new AppError("FORBIDDEN", error.message ?? "Staff management permission is required.");
  if (error?.code === "P0001" || error?.code === "23505") throw new AppError("CONFLICT", error.message ?? "This staff invitation conflicts with an existing membership.");
  if (["22023", "22P02", "23503"].includes(error?.code ?? "")) throw new AppError("VALIDATION_ERROR", error?.message ?? "The invitation fields are invalid.");
  throw new AppError("INTERNAL_ERROR", "The invited staff membership could not be committed.", true);
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = invitationSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    await requireStaffCapabilities({ branchId: command.branchId, restaurantId: command.restaurantId, requiredCapabilities: ["staff.manage"], supabase, user: userResult.data.user });

    const execution = await executeIdempotentCommand({
      restaurantId: command.restaurantId,
      branchId: command.branchId,
      actorId: userResult.data.user.id,
      commandType: "staff.invite",
      idempotencyKey: command.idempotencyKey,
      command,
    }, async () => {
      const serviceRole = getServiceRoleSupabaseClient();
      const redirectTo = new URL("/auth/accept-invite", getServerEnv().NEXT_PUBLIC_APP_URL).toString();
      const invited = await serviceRole.auth.admin.inviteUserByEmail(command.email, { redirectTo, data: { onboarding: "staff" } });
      if (invited.error || !invited.data.user) {
        if (invited.error?.status === 422 || invited.error?.code === "email_exists") throw new AppError("CONFLICT", "This email already has an Auth account. Update its existing membership instead.");
        throw new AppError("INTERNAL_ERROR", "The staff invitation could not be sent.", true);
      }

      const membership = await supabase.rpc("create_staff_membership_from_invite", {
        p_restaurant_id: command.restaurantId,
        p_branch_id: command.branchId,
        p_user_id: invited.data.user.id,
        p_role_id: command.roleId,
      }).single();
      if (membership.error || !membership.data) {
        const cleanup = await serviceRole.auth.admin.deleteUser(invited.data.user.id);
        if (cleanup.error) logger.error("Invitation membership failed and Auth cleanup failed", { action: "staff.invite.cleanup", correlationId: requestId, userId: invited.data.user.id });
        membershipError(membership.error);
      }
      const row = membership.data as { membership_id: string; version: number };
      return { userId: invited.data.user.id, membershipId: row.membership_id, version: row.version, delivery: "EMAIL" as const };
    });

    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Invitation fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
