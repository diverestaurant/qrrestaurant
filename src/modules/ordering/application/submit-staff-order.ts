import { AppError } from "@/lib/errors";
import { submitOrderSchema, type SubmitOrderCommand } from "@/modules/ordering/contracts/commands";

export type SubmitStaffOrderDependencies = {
  getSession: (sessionId: string) => Promise<{ state: string; version: number; staffCanWrite: boolean } | null>;
  submit: (command: SubmitOrderCommand) => Promise<{ orderId: string; version: number }>;
};

export async function submitStaffOrder(input: unknown, dependencies: SubmitStaffOrderDependencies) {
  const command = submitOrderSchema.parse(input);
  const session = await dependencies.getSession(command.sessionId);
  if (!session || !session.staffCanWrite) throw new AppError("FORBIDDEN", "This staff identity cannot submit an assisted order.");
  if (session.state !== "OPEN") throw new AppError("CONFLICT", "This Session is no longer accepting assisted orders.");
  if (session.version !== command.expectedSessionVersion) throw new AppError("STALE_STATE", "The Session changed. Refresh before submitting.", true);
  return dependencies.submit(command);
}
