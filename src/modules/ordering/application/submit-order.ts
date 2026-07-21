import { AppError } from "@/lib/errors";
import { submitOrderSchema, type SubmitOrderCommand } from "@/modules/ordering/contracts/commands";

export type SubmitOrderDependencies = { getSession: (sessionId: string) => Promise<{ state: string; version: number; customerCanWrite: boolean } | null>; submit: (command: SubmitOrderCommand) => Promise<{ orderId: string; version: number }> };

export async function submitOrder(input: unknown, dependencies: SubmitOrderDependencies) {
  const command = submitOrderSchema.parse(input);
  const session = await dependencies.getSession(command.sessionId);
  if (!session || !session.customerCanWrite) throw new AppError("FORBIDDEN", "This Session is no longer accepting customer orders.");
  if (session.version !== command.expectedSessionVersion) throw new AppError("STALE_STATE", "The Session changed. Refresh before submitting.", true);
  return dependencies.submit(command);
}
