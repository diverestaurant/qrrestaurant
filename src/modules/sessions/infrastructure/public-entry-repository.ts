import "server-only";

import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import type { ResolveTableEntryView } from "@/contracts/view-models";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JoinTableEntryCommand } from "@/modules/sessions/contracts/commands";

type SupabaseLike = Pick<SupabaseClient, "rpc">;

function normalizeSlug(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) throw new AppError("VALIDATION_ERROR", `${label} is invalid.`);
  return normalized;
}

export function hashTableToken(tableToken: string) {
  return createHash("sha256").update(tableToken).digest("hex");
}

export async function resolvePublicTableEntry(input: { restaurantSlug: string; branchSlug: string; tableToken: string }, supabase: SupabaseLike): Promise<ResolveTableEntryView> {
  const restaurantSlug = normalizeSlug(input.restaurantSlug, "Restaurant");
  const branchSlug = normalizeSlug(input.branchSlug, "Branch");
  const result = await supabase.rpc("resolve_public_table_entry", { p_restaurant_slug: restaurantSlug, p_branch_slug: branchSlug, p_token_hash: hashTableToken(input.tableToken) }).maybeSingle();
  if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to resolve the table entry.", true);
  if (!result.data) throw new AppError("NOT_FOUND", "Table entry not found.");
  const row = result.data as { restaurant_name: string; branch_name: string; table_label: string; ordering_requires_join: boolean };
  return { status: "ready", freshness: "fresh", restaurantName: row.restaurant_name, branchName: row.branch_name, tableLabel: row.table_label, orderingRequiresJoin: true, lastSyncedAt: new Date().toISOString() };
}

export async function joinPublicTableSession(command: JoinTableEntryCommand, anonymousUserId: string, supabase: SupabaseLike) {
  const result = await supabase.rpc("join_public_table_session", { p_restaurant_slug: normalizeSlug(command.restaurantSlug, "Restaurant"), p_branch_slug: normalizeSlug(command.branchSlug, "Branch"), p_token_hash: hashTableToken(command.tableToken), p_code_hash: createHash("sha256").update(command.joinCode).digest("hex"), p_anonymous_user_id: anonymousUserId }).maybeSingle();
  if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to create the customer Session grant.", true);
  if (!result.data) throw new AppError("FORBIDDEN", "The Join Code is invalid or expired.");
  const row = result.data as { joined_session_id: string; grant_id: string; grant_expires_at: string };
  return { sessionId: row.joined_session_id, grantId: row.grant_id, expiresAt: row.grant_expires_at };
}
