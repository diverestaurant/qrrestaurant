import { AppError } from "@/lib/errors";
import { beginPaymentSchema, type BeginPaymentCommand } from "@/modules/ordering/contracts/commands";

export type BeginPaymentDependencies = { getBalance: (sessionId: string) => Promise<{ outstandingMinor: number; currency: string; version: number } | null>; begin: (command: BeginPaymentCommand) => Promise<{ paymentId: string; status: "PENDING" }> };

export async function beginPayment(input: unknown, dependencies: BeginPaymentDependencies) {
  const command = beginPaymentSchema.parse(input);
  const balance = await dependencies.getBalance(command.sessionId);
  if (!balance) throw new AppError("NOT_FOUND", "Session not found.");
  if (balance.version !== command.expectedSessionVersion) throw new AppError("STALE_STATE", "The bill changed. Refresh before taking payment.", true);
  if (balance.currency !== command.currency || command.amountMinor > balance.outstandingMinor) throw new AppError("VALIDATION_ERROR", "Payment amount must match the current outstanding balance.");
  return dependencies.begin(command);
}
