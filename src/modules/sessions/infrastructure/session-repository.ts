import "server-only";

import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import type { OpenSessionCommand } from "@/modules/sessions/contracts/commands";

type SupabaseLike = Pick<SupabaseClient, "from" | "rpc">;

type TableRow = { id: string; restaurant_id: string; branch_id: string; active: boolean; capacity: number };
type BranchRow = { currency: string; timezone: string };
const ACTIVE_SESSION_STATES = ["OPEN", "PAYMENT_REQUESTED", "PAYMENT_PENDING", "PAID"];

function hashJoinCode(joinCode: string) {
  return createHash("sha256").update(joinCode).digest("hex");
}

function businessDateInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createSessionRepository(supabase: SupabaseLike, actorId: string) {
  async function getTable(tableId: string) {
    const result = await supabase.from("restaurant_tables").select("id,restaurant_id,branch_id,active,capacity").eq("id", tableId).maybeSingle();
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to read the table.", true);
    return result.data as TableRow | null;
  }

  async function getBranch(branchId: string) {
    const result = await supabase.from("branches").select("currency,timezone").eq("id", branchId).maybeSingle();
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to read the branch settings.", true);
    if (!result.data) throw new AppError("NOT_FOUND", "Branch not found.");
    return result.data as BranchRow;
  }

  async function getActiveSession(tableId: string) {
    const result = await supabase.from("dining_sessions").select("id,version").eq("table_id", tableId).in("state", ACTIVE_SESSION_STATES).maybeSingle();
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to check the active Session.", true);
    return result.data as { id: string; version: number } | null;
  }

  async function open(command: OpenSessionCommand, scope: { branchId: string; restaurantId: string }) {
    const branch = await getBranch(scope.branchId);
    const joinCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const sessionId = crypto.randomUUID();
    const result = await supabase.rpc("open_dining_session", {
      p_session_id: sessionId,
      p_table_id: command.tableId,
      p_guest_count: command.guestCount,
      p_business_date: businessDateInTimezone(branch.timezone),
      p_currency: branch.currency,
      p_join_code_hash: hashJoinCode(joinCode),
      p_join_code_expires_at: expiresAt,
      p_opened_by: actorId,
    }).single();
    if (result.error) {
      if (result.error.code === "23505") throw new AppError("CONFLICT", "This table already has an active Session.", true);
      if (result.error.code === "42501") throw new AppError("FORBIDDEN", "You do not have permission to open a Session.");
      throw new AppError("INTERNAL_ERROR", "Unable to open the Session.", true);
    }
    const row = result.data as { session_id: string; version: number } | null;
    if (!row) throw new AppError("INTERNAL_ERROR", "The Session was not created.", true);
    return { sessionId: row.session_id, version: row.version, joinCode, expiresAt };
  }

  return { getTable, getActiveSession, open };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
