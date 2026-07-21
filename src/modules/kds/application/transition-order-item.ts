import { AppError } from "@/lib/errors";
import { canTransitionOrder, type OrderState } from "@/modules/ordering/domain/state";
import { transitionOrderItemSchema, type TransitionOrderItemCommand } from "@/modules/kds/contracts/commands";

export type TransitionOrderItemDependencies = {
  getItem: (orderItemId: string) => Promise<{ branchId: string; stationKey: string | null; state: OrderState; version: number } | null>;
  updateItem: (command: TransitionOrderItemCommand, current: { branchId: string; stationKey: string | null; state: OrderState; version: number }) => Promise<{ version: number; state: OrderState }>;
};

export async function transitionOrderItem(input: unknown, dependencies: TransitionOrderItemDependencies) {
  const command = transitionOrderItemSchema.parse(input);
  const current = await dependencies.getItem(command.orderItemId);
  if (!current) throw new AppError("NOT_FOUND", "Kitchen item not found.");
  if (current.version !== command.expectedVersion) throw new AppError("STALE_STATE", "This kitchen item changed. Refresh the queue.", true);
  if (!canTransitionOrder(current.state, command.nextState)) throw new AppError("CONFLICT", `Cannot move a ${current.state} item to ${command.nextState}.`);
  return dependencies.updateItem(command, current);
}
