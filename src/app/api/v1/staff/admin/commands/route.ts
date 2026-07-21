import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { adminCommandSchema, type AdminCommand } from "@/modules/admin/contracts/commands";
import type { CapabilityKey } from "@/modules/identity/contracts/capabilities";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function capabilityFor(command: AdminCommand): CapabilityKey {
  if (command.type.startsWith("menu_") || command.type === "station.upsert") return "menu.manage";
  if (command.type.startsWith("table.")) return "table.manage";
  return "staff.manage";
}

function databaseError(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === "42501") throw new AppError("FORBIDDEN", error.message ?? "This staff account cannot perform the Admin command.");
  if (error?.code === "P0002") throw new AppError("NOT_FOUND", error.message ?? "The Admin record was not found.");
  if (error?.code === "P0003") throw new AppError("STALE_STATE", error.message ?? "The record changed. Refresh before saving.", true);
  if (error?.code === "P0001") throw new AppError("CONFLICT", error.message ?? "The Admin command conflicts with the current state.");
  if (["22023", "22P02", "23503", "23514"].includes(error?.code ?? "")) throw new AppError("VALIDATION_ERROR", error?.message ?? "The Admin command fields are invalid.");
  if (error?.code === "23505") throw new AppError("CONFLICT", "A record with the same unique value already exists.");
  throw new AppError("INTERNAL_ERROR", fallback, true);
}

function commandForDatabase(command: AdminCommand) {
  if (command.type === "menu_category.create" || command.type === "menu_item.create" || command.type === "table.create") {
    return { ...command, id: randomUUID() };
  }
  if (command.type === "station.upsert" && !command.stationId) return { ...command, id: randomUUID() };
  if (command.type === "feature_flag.set" && !command.expectedVersion) return { ...command, id: randomUUID() };
  if (command.type === "menu_variant.upsert" && !command.variantId) return { ...command, id: randomUUID() };
  if (command.type === "menu_modifier_group.upsert" && !command.groupId) return { ...command, id: randomUUID() };
  if (command.type === "menu_modifier_option.upsert" && !command.optionId) return { ...command, id: randomUUID() };
  return command;
}

const menuStructureTypes = new Set<AdminCommand["type"]>([
  "menu_category.update",
  "menu_item.configuration.update",
  "menu_item.image.set",
  "menu_variant.upsert",
  "menu_modifier_group.upsert",
  "menu_modifier_option.upsert",
  "menu_modifier_link.set",
]);

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = adminCommandSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    await requireStaffCapabilities({
      branchId: command.branchId,
      restaurantId: command.restaurantId,
      requiredCapabilities: [capabilityFor(command)],
      supabase,
      user: userResult.data.user,
    });

    const execution = await executeIdempotentCommand({
      restaurantId: command.restaurantId,
      branchId: command.branchId,
      actorId: userResult.data.user.id,
      commandType: command.type,
      idempotencyKey: command.idempotencyKey,
      command,
    }, async () => {
      if (command.type === "table.qr.rotate") {
        const token = randomBytes(24).toString("base64url");
        const result = await supabase.rpc("rotate_table_entry_qr", {
          p_table_id: command.tableId,
          p_token_hash: createHash("sha256").update(token).digest("hex"),
        }).single();
        if (result.error) databaseError(result.error, "Unable to rotate the table QR.");
        const row = result.data as { table_id: string; token_version: number } | null;
        if (!row) throw new AppError("INTERNAL_ERROR", "The table QR was not rotated.", true);
        return { tableId: row.table_id, tokenVersion: row.token_version, tableToken: token };
      }

      const result = await supabase.rpc(menuStructureTypes.has(command.type) ? "execute_menu_structure_command" : "execute_admin_command", {
        p_restaurant_id: command.restaurantId,
        p_branch_id: command.branchId,
        p_command: commandForDatabase(command),
      });
      if (result.error) databaseError(result.error, "Unable to complete the Admin command.");
      if (!result.data || typeof result.data !== "object") throw new AppError("INTERNAL_ERROR", "The Admin command returned no committed result.", true);
      return result.data as { id: string; version: number };
    });

    return NextResponse.json(
      { ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Admin command fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401
      : body.error.code === "FORBIDDEN" ? 403
        : body.error.code === "NOT_FOUND" ? 404
          : body.error.code === "VALIDATION_ERROR" ? 400
            : body.error.code === "CONFLICT" || body.error.code === "STALE_STATE" || body.error.code === "UNKNOWN_OUTCOME" ? 409
              : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
