import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { branchCatalogQuerySchema, branchLifecycleCommandSchema, type BranchLifecycleCommand } from "@/modules/admin/contracts/branch-lifecycle";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

function deterministicUuid(key: string, label: string) {
  const hex = createHash("sha256").update(`${key}:${label}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function databaseError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new AppError("FORBIDDEN", error.message ?? "Restaurant Owner permission is required.");
  if (error?.code === "P0003") throw new AppError("STALE_STATE", error.message ?? "The Branch changed. Refresh before saving.", true);
  if (error?.code === "P0001") throw new AppError("CONFLICT", error.message ?? "The Branch lifecycle conflicts with the current state.");
  if (["22007", "22023", "22P02", "23503", "23514"].includes(error?.code ?? "")) throw new AppError("VALIDATION_ERROR", error?.message ?? "The Branch fields are invalid.");
  if (error?.code === "23505") throw new AppError("CONFLICT", "A Branch with this slug already exists.");
  throw new AppError("INTERNAL_ERROR", "Unable to complete the Branch lifecycle request.", true);
}

function errorResponse(error: unknown, requestId: string) {
  const body = toErrorEnvelope(error instanceof z.ZodError || error instanceof SyntaxError ? new AppError("VALIDATION_ERROR", "Branch lifecycle fields are invalid.") : error, requestId);
  const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticatedScope(restaurantId: string, anchorBranchId: string) {
  const supabase = await getServerSupabaseClient();
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
  await requireStaffCapabilities({ restaurantId, branchId: anchorBranchId, requiredCapabilities: ["branch.manage"], supabase, user: userResult.data.user });
  return { supabase, user: userResult.data.user };
}

export async function GET(request: Request) {
  const requestId = correlationId();
  try {
    const url = new URL(request.url);
    const query = branchCatalogQuerySchema.parse({ restaurantId: url.searchParams.get("restaurantId"), anchorBranchId: url.searchParams.get("anchorBranchId") });
    const { supabase } = await authenticatedScope(query.restaurantId, query.anchorBranchId);
    const result = await supabase.rpc("read_restaurant_branches", { p_restaurant_id: query.restaurantId, p_anchor_branch_id: query.anchorBranchId });
    if (result.error) databaseError(result.error);
    if (!Array.isArray(result.data)) throw new AppError("INTERNAL_ERROR", "The Branch catalog response is invalid.", true);
    return NextResponse.json({ ok: true, data: result.data, meta: { correlationId: requestId, freshness: "fresh" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = branchLifecycleCommandSchema.parse(await request.json()) as BranchLifecycleCommand;
    const { supabase, user } = await authenticatedScope(command.restaurantId, command.anchorBranchId);
    const databaseCommand = command.type === "branch.create"
      ? { ...command, branchId: deterministicUuid(command.idempotencyKey, "branch") }
      : command;
    const execution = await executeIdempotentCommand({ restaurantId: command.restaurantId, branchId: command.anchorBranchId, actorId: user.id, commandType: command.type, idempotencyKey: command.idempotencyKey, command }, async () => {
      const result = await supabase.rpc("execute_branch_lifecycle_command", { p_restaurant_id: command.restaurantId, p_anchor_branch_id: command.anchorBranchId, p_command: databaseCommand });
      if (result.error) databaseError(result.error);
      if (!result.data || typeof result.data !== "object") throw new AppError("INTERNAL_ERROR", "The Branch command returned no result.", true);
      return result.data as Record<string, unknown>;
    });
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { status: command.type === "branch.create" && !execution.replay ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
