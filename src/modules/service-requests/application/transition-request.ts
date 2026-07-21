import { AppError } from "@/lib/errors";
import { transitionServiceRequestSchema, type TransitionServiceRequestCommand } from "@/modules/service-requests/contracts/commands";

type RequestState = "OPEN" | "CLAIMED" | "RESOLVED" | "CANCELLED";
const transitions: Record<RequestState, RequestState[]> = { OPEN: ["CLAIMED", "CANCELLED"], CLAIMED: ["RESOLVED", "CANCELLED"], RESOLVED: [], CANCELLED: [] };

export type TransitionServiceRequestDependencies = {
  getRequest: (requestId: string) => Promise<{ branchId: string; state: RequestState; version: number } | null>;
  updateRequest: (command: TransitionServiceRequestCommand, current: { branchId: string; state: RequestState; version: number }) => Promise<{ version: number; state: RequestState }>;
};

export async function transitionServiceRequest(input: unknown, dependencies: TransitionServiceRequestDependencies) {
  const command = transitionServiceRequestSchema.parse(input);
  const current = await dependencies.getRequest(command.requestId);
  if (!current) throw new AppError("NOT_FOUND", "Service request not found.");
  if (current.version !== command.expectedVersion) throw new AppError("STALE_STATE", "This service request changed. Refresh the floor view.", true);
  if (!transitions[current.state].includes(command.nextState)) throw new AppError("CONFLICT", `Cannot move a ${current.state} request to ${command.nextState}.`);
  return dependencies.updateRequest(command, current);
}
