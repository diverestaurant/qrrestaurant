import { AppError } from "@/lib/errors";
import { confirmPaymentSchema, type ConfirmPaymentCommand } from "@/modules/payments/contracts/commands";

export type ConfirmPaymentDependencies = {
  getPayment: (paymentId: string) => Promise<{ branchId: string; state: "PENDING" | "CONFIRMED" | "FAILED"; method: "CASH" | "CARD" | "DUITNOW" | "E_WALLET" | "OTHER"; amountMinor: number; outstandingMinor: number } | null>;
  confirm: (command: ConfirmPaymentCommand, current: { branchId: string; amountMinor: number }) => Promise<{ paymentId: string; state: "CONFIRMED"; changeMinor: number }>;
};

export async function confirmPayment(input: unknown, dependencies: ConfirmPaymentDependencies) {
  const command = confirmPaymentSchema.parse(input);
  const current = await dependencies.getPayment(command.paymentId);
  if (!current) throw new AppError("NOT_FOUND", "Payment not found.");
  if (current.state !== "PENDING") throw new AppError("CONFLICT", "This payment is no longer pending. Check its current status before retrying.", true);
  if (current.amountMinor > current.outstandingMinor) throw new AppError("CONFLICT", "The payment exceeds the current outstanding balance.", true);
  if (current.method === "CASH" && (command.cashReceivedMinor ?? 0) < current.amountMinor) throw new AppError("VALIDATION_ERROR", "Cash received must cover the payment amount.");
  if (current.method !== "CASH" && !command.observedReference) throw new AppError("VALIDATION_ERROR", "Record the observed payment reference before confirming.");
  return dependencies.confirm(command, { branchId: current.branchId, amountMinor: current.amountMinor });
}
