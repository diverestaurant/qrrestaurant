import "server-only";

import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JoinSessionCommand } from "@/modules/sessions/contracts/commands";
import type { AnonymousActor } from "@/modules/sessions/application/join-session";

type SupabaseLike = Pick<SupabaseClient, "rpc">;
type SessionRow = { branch_id: string; restaurant_id: string; table_id: string; state: "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED" };

function hashJoinCode(joinCode: string) {
  return createHash("sha256").update(joinCode).digest("hex");
}

export function createJoinSessionRepository(supabase: SupabaseLike) {
  return {
    verifyCode: async (sessionId: string, joinCode: string) => {
      const result = await supabase.rpc("verify_dining_session_join_code", { p_session_id: sessionId, p_code_hash: hashJoinCode(joinCode) }).maybeSingle();
      if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to verify the Join Code.", true);
      if (!result.data) return null;
      const row = result.data as SessionRow;
      return { branchId: row.branch_id, restaurantId: row.restaurant_id, tableId: row.table_id, state: row.state };
    },
    grant: async (command: JoinSessionCommand, actor: AnonymousActor) => {
      const result = await supabase.rpc("grant_dining_session", { p_session_id: command.sessionId, p_code_hash: hashJoinCode(command.joinCode), p_anonymous_user_id: actor.anonymousUserId }).maybeSingle();
      if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to create the customer Session grant.", true);
      if (!result.data) throw new AppError("FORBIDDEN", "The Join Code is invalid or expired.");
      const row = result.data as { grant_id: string; expires_at: string };
      return { grantId: row.grant_id, expiresAt: row.expires_at };
    },
  };
}
