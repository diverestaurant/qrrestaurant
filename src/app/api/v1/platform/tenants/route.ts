import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { platformTenantCommandSchema, type PlatformTenantCommand } from "@/modules/platform/contracts/commands";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { getServerSupabaseClient } from "@/server/supabase/server";

function deterministicUuid(key: string, label: string) {
  const hex = createHash("sha256").update(`${key}:${label}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function commandScope(command: PlatformTenantCommand) {
  if (command.type !== "platform.restaurant.create") return { command, restaurantId: command.restaurantId, branchId: command.branchId };
  const restaurantId = deterministicUuid(command.idempotencyKey, "restaurant");
  const branchId = deterministicUuid(command.idempotencyKey, "branch");
  return { restaurantId, branchId, command: { ...command, restaurantId, branchId, subscriptionId: deterministicUuid(command.idempotencyKey, "subscription") } };
}

function platformError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new AppError("FORBIDDEN", error.message ?? "Platform Admin permission is required.");
  if (error?.code === "P0003") throw new AppError("STALE_STATE", error.message ?? "The tenant changed. Refresh before saving.", true);
  if (["22023", "22P02", "23503", "23514"].includes(error?.code ?? "")) throw new AppError("VALIDATION_ERROR", error?.message ?? "The Platform command fields are invalid.");
  if (error?.code === "23505") throw new AppError("CONFLICT", "A Restaurant or Branch with this slug already exists.");
  throw new AppError("INTERNAL_ERROR", "Unable to complete the Platform tenant command.", true);
}

export async function GET() {
  const requestId = correlationId();
  try {
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const result = await supabase.rpc("read_platform_tenants");
    if (result.error) platformError(result.error);
    if (!Array.isArray(result.data)) throw new AppError("INTERNAL_ERROR", "Platform tenant data is invalid.", true);
    return NextResponse.json({ ok: true, data: result.data, meta: { correlationId: requestId, freshness: "fresh" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = platformTenantCommandSchema.parse(await request.json());
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const scope = commandScope(command);
    const execution = await executeIdempotentCommand({ restaurantId: scope.restaurantId, branchId: scope.branchId, actorId: userResult.data.user.id, commandType: command.type, idempotencyKey: command.idempotencyKey, command }, async () => {
      const result = await supabase.rpc("execute_platform_tenant_command", { p_command: scope.command });
      if (result.error) platformError(result.error);
      if (!result.data || typeof result.data !== "object") throw new AppError("INTERNAL_ERROR", "Platform command returned no result.", true);
      return result.data as Record<string, unknown>;
    });
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { status: command.type === "platform.restaurant.create" && !execution.replay ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error instanceof z.ZodError || error instanceof SyntaxError ? new AppError("VALIDATION_ERROR", "Platform command fields are invalid.") : error, requestId);
  }
}

function errorResponse(error: unknown, requestId: string) {
  const body = toErrorEnvelope(error, requestId);
  const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
