import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { requestFingerprint } from "@/modules/ordering/application/idempotency";
import { setMenuItemAvailability, type SetMenuItemAvailabilityDependencies } from "@/modules/menu/application/set-availability";
import { setMenuItemAvailabilitySchema } from "@/modules/menu/contracts/commands";
import { getServerSupabaseClient } from "@/server/supabase/server";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

type RouteContext = { params: Promise<{ menuItemId: string }> };
type MenuItemScope = { restaurantId: string; branchId: string; version: number; available: boolean };
type MenuItemScopeRow = { restaurant_id: string; branch_id: string; version: number; available: boolean };

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { menuItemId } = await context.params;
    const input = await readJson(request);
    const command = setMenuItemAvailabilitySchema.parse({ ...input, menuItemId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");

    const itemResult = await supabase.from("menu_items").select("restaurant_id,branch_id,version,available").eq("id", command.menuItemId).maybeSingle();
    if (itemResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the menu item.", true);
    if (!itemResult.data) throw new AppError("NOT_FOUND", "Menu item not found.");
    const scopeRow = itemResult.data as MenuItemScopeRow;
    const scope: MenuItemScope = { restaurantId: scopeRow.restaurant_id, branchId: scopeRow.branch_id, version: scopeRow.version, available: scopeRow.available };
    const dependencies: SetMenuItemAvailabilityDependencies = {
      getItem: async () => ({ branchId: scope.branchId, version: scope.version, available: scope.available }),
      updateItem: async (updateCommand, current) => {
        const result = await supabase.rpc("set_menu_item_availability", {
          p_menu_item_id: updateCommand.menuItemId,
          p_expected_version: current.version,
          p_available: updateCommand.available,
        }).single();
        if (result.error?.code === "42501") throw new AppError("FORBIDDEN", "This staff account cannot manage the menu item.");
        if (result.error?.code === "P0003") throw new AppError("STALE_STATE", "The menu item changed. Refresh before updating.", true);
        if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to update the menu item.", true);
        if (!result.data) throw new AppError("STALE_STATE", "The menu item changed. Refresh before updating.", true);
        return result.data as { version: number; available: boolean };
      },
    };

    const serviceRole = getServiceRoleSupabaseClient();
    const requestHash = requestFingerprint(command);
    const actorFingerprint = userResult.data.user.id;
    const existingResult = await serviceRole.from("idempotency_keys").select("request_hash,status,result").eq("restaurant_id", scope.restaurantId).eq("branch_id", scope.branchId).eq("command_type", "menu.set_availability").eq("actor_fingerprint", actorFingerprint).eq("idempotency_key", command.idempotencyKey).maybeSingle();
    if (existingResult.error) throw new AppError("INTERNAL_ERROR", "Unable to check command idempotency.", true);
    if (existingResult.data) {
      if (existingResult.data.request_hash !== requestHash) throw new AppError("CONFLICT", "This idempotency key was already used for a different request.");
      if (existingResult.data.status === "COMPLETED") return NextResponse.json({ ok: true, data: existingResult.data.result, meta: { replay: true, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
      if (existingResult.data.status === "IN_PROGRESS") throw new AppError("UNKNOWN_OUTCOME", "This command is already being processed. Check the menu item status before retrying.", true);
    }

    const idempotencyScope = serviceRole.from("idempotency_keys").update({ status: "IN_PROGRESS", result: null, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq("restaurant_id", scope.restaurantId).eq("branch_id", scope.branchId).eq("command_type", "menu.set_availability").eq("actor_fingerprint", actorFingerprint).eq("idempotency_key", command.idempotencyKey);
    const insertResult = existingResult.data?.status === "FAILED" ? await idempotencyScope : await serviceRole.from("idempotency_keys").insert({ restaurant_id: scope.restaurantId, branch_id: scope.branchId, command_type: "menu.set_availability", actor_fingerprint: actorFingerprint, idempotency_key: command.idempotencyKey, request_hash: requestHash, status: "IN_PROGRESS", expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    if (insertResult.error && insertResult.error.code !== "23505") throw new AppError("INTERNAL_ERROR", "Unable to reserve command idempotency.", true);
    if (insertResult.error?.code === "23505") throw new AppError("UNKNOWN_OUTCOME", "This command may already be processing. Check the menu item status before retrying.", true);

    try {
      const result = await setMenuItemAvailability(command, dependencies);
      await serviceRole.from("idempotency_keys").update({ status: "COMPLETED", result }).eq("restaurant_id", scope.restaurantId).eq("branch_id", scope.branchId).eq("command_type", "menu.set_availability").eq("actor_fingerprint", actorFingerprint).eq("idempotency_key", command.idempotencyKey);
      return NextResponse.json({ ok: true, data: result, meta: { replay: false, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await serviceRole.from("idempotency_keys").update({ status: "FAILED", result: { error: toErrorEnvelope(error, requestId).error } }).eq("restaurant_id", scope.restaurantId).eq("branch_id", scope.branchId).eq("command_type", "menu.set_availability").eq("actor_fingerprint", actorFingerprint).eq("idempotency_key", command.idempotencyKey);
      throw error;
    }
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "STALE_STATE" || body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
