import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { transitionOrderItem } from "@/modules/kds/application/transition-order-item";
import { transitionOrderItemSchema } from "@/modules/kds/contracts/commands";
import type { CapabilityKey } from "@/modules/identity/contracts/capabilities";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

type RouteContext = { params: Promise<{ orderItemId: string }> };

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = correlationId();
  try {
    const { orderItemId } = await context.params;
    const command = transitionOrderItemSchema.parse({ ...(await readJson(request)), orderItemId });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const itemResult = await supabase.from("order_items").select("restaurant_id,branch_id,station_key,state,version").eq("id", command.orderItemId).maybeSingle();
    if (itemResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the kitchen item.", true);
    if (!itemResult.data) throw new AppError("NOT_FOUND", "Kitchen item not found.");
    const scope = itemResult.data as { restaurant_id: string; branch_id: string; state: "SUBMITTED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "REJECTED" | "CANCELLED" };
    const requiredCapabilities: CapabilityKey[] = command.nextState === "ACCEPTED" || command.nextState === "REJECTED"
      ? ["order.accept"]
      : command.nextState === "PREPARING" || command.nextState === "READY"
        ? ["order.prepare"]
        : command.nextState === "SERVED"
          ? ["order.serve"]
          : scope.state === "PREPARING"
            ? ["order.accept", "order.serve"]
            : ["order.accept"];
    await requireStaffCapabilities({ branchId: scope.branch_id, restaurantId: scope.restaurant_id, requiredCapabilities, supabase, user: userResult.data.user });
    const execution = await executeIdempotentCommand({ restaurantId: scope.restaurant_id, branchId: scope.branch_id, actorId: userResult.data.user.id, commandType: "kds.item.transition", idempotencyKey: command.idempotencyKey, command }, () => transitionOrderItem(command, {
      getItem: async (itemId) => {
        const result = await supabase.from("order_items").select("branch_id,station_key,state,version").eq("id", itemId).maybeSingle();
        if (result.error || !result.data) return null;
        const row = result.data as { branch_id: string; station_key: string | null; state: "SUBMITTED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "REJECTED" | "CANCELLED"; version: number };
        return { branchId: row.branch_id, stationKey: row.station_key, state: row.state, version: row.version };
      },
      updateItem: async (updateCommand) => {
        const result = await supabase.rpc("transition_order_item", { p_order_item_id: updateCommand.orderItemId, p_next_state: updateCommand.nextState, p_expected_version: updateCommand.expectedVersion, p_reason: updateCommand.reason ?? null }).single();
        if (result.error) {
          if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission for this kitchen transition.");
          if (result.error.code === "P0003") throw new AppError("STALE_STATE", "This kitchen item changed. Refresh the queue.", true);
          if (result.error.code === "P0004") throw new AppError("CONFLICT", "This kitchen transition is not allowed.");
          throw new AppError("INTERNAL_ERROR", "Unable to update the kitchen item.", true);
        }
        if (!result.data) throw new AppError("STALE_STATE", "This kitchen item changed. Refresh the queue.", true);
        const row = result.data as { version: number; state: "SUBMITTED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "REJECTED" | "CANCELLED" };
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
