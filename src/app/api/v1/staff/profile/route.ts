import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { updateStaffProfileSchema, type StaffProfileView } from "@/modules/identity/contracts/staff-profile";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = updateStaffProfileSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous === true) throw new AppError("FORBIDDEN", "A permanent staff identity is required.");

    const membershipResult = await supabase
      .from("staff_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("restaurant_id", command.restaurantId)
      .eq("status", "ACTIVE")
      .or(`branch_id.eq.${command.branchId},branch_id.is.null`)
      .limit(1);
    if (membershipResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff membership.", true);
    if (!membershipResult.data?.length) throw new AppError("FORBIDDEN", "This staff identity cannot update a profile in the requested Branch.");

    const execution = await executeIdempotentCommand({
      restaurantId: command.restaurantId,
      branchId: command.branchId,
      actorId: user.id,
      commandType: "staff.profile.update",
      idempotencyKey: command.idempotencyKey,
      command,
    }, async () => {
      const result = await supabase.rpc("update_my_staff_profile", {
        p_restaurant_id: command.restaurantId,
        p_branch_id: command.branchId,
        p_display_name: command.displayName,
        p_preferred_locale: command.preferredLocale,
        p_expected_version: command.expectedVersion,
      });
      if (result.error?.code === "42501") throw new AppError("FORBIDDEN", result.error.message);
      if (result.error?.code === "P0003") throw new AppError("STALE_STATE", result.error.message, true);
      if (result.error?.code === "22023" || result.error?.code === "23514") throw new AppError("VALIDATION_ERROR", result.error.message);
      if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to update the staff profile.", true);
      if (!result.data || typeof result.data !== "object") throw new AppError("INTERNAL_ERROR", "The staff profile command returned no committed result.", true);
      return result.data as StaffProfileView;
    });

    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Staff profile fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401
      : body.error.code === "FORBIDDEN" ? 403
        : body.error.code === "VALIDATION_ERROR" ? 400
          : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409
            : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
