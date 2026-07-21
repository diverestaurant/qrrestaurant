import "server-only";

import { AppError, toErrorEnvelope } from "@/lib/errors";
import { requestFingerprint } from "@/modules/ordering/application/idempotency";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

type IdempotencyInput = {
  restaurantId: string;
  branchId: string;
  actorId: string;
  commandType: string;
  idempotencyKey: string;
  command: unknown;
};

export async function executeIdempotentCommand<T>(input: IdempotencyInput, operation: () => Promise<T>) {
  const serviceRole = getServiceRoleSupabaseClient();
  const requestHash = requestFingerprint(input.command);
  const selectScope = () => serviceRole.from("idempotency_keys")
    .select("request_hash,status,result")
    .eq("restaurant_id", input.restaurantId)
    .eq("branch_id", input.branchId)
    .eq("command_type", input.commandType)
    .eq("actor_fingerprint", input.actorId)
    .eq("idempotency_key", input.idempotencyKey);
  const updateScope = (values: Record<string, unknown>) => serviceRole.from("idempotency_keys")
    .update(values)
    .eq("restaurant_id", input.restaurantId)
    .eq("branch_id", input.branchId)
    .eq("command_type", input.commandType)
    .eq("actor_fingerprint", input.actorId)
    .eq("idempotency_key", input.idempotencyKey);
  const existingResult = await selectScope().maybeSingle();
  if (existingResult.error) throw new AppError("INTERNAL_ERROR", "Unable to check command idempotency.", true);
  if (existingResult.data) {
    if (existingResult.data.request_hash !== requestHash) throw new AppError("CONFLICT", "This idempotency key was already used for a different request.");
    if (existingResult.data.status === "COMPLETED") return { replay: true, result: existingResult.data.result as T };
    if (existingResult.data.status === "IN_PROGRESS") throw new AppError("UNKNOWN_OUTCOME", "This command is already being processed. Check its status before retrying.", true);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const reserveResult = existingResult.data?.status === "FAILED"
    ? await updateScope({ status: "IN_PROGRESS", result: null, expires_at: expiresAt })
    : await serviceRole.from("idempotency_keys").insert({ restaurant_id: input.restaurantId, branch_id: input.branchId, command_type: input.commandType, actor_fingerprint: input.actorId, idempotency_key: input.idempotencyKey, request_hash: requestHash, status: "IN_PROGRESS", expires_at: expiresAt });
  if (reserveResult.error && reserveResult.error.code !== "23505") throw new AppError("INTERNAL_ERROR", "Unable to reserve command idempotency.", true);
  if (reserveResult.error?.code === "23505") throw new AppError("UNKNOWN_OUTCOME", "This command may already be processing. Check its status before retrying.", true);

  try {
    const result = await operation();
    const completedResult = await updateScope({ status: "COMPLETED", result });
    if (completedResult.error) throw new AppError("INTERNAL_ERROR", "Command completed but its idempotency result could not be recorded.", true);
    return { replay: false, result };
  } catch (error) {
    await updateScope({ status: "FAILED", result: { error: toErrorEnvelope(error).error } });
    throw error;
  }
}
