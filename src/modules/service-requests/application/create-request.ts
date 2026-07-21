import { AppError } from "@/lib/errors";
import { createServiceRequestSchema, type CreateServiceRequestCommand } from "@/modules/service-requests/contracts/commands";

export type CreateServiceRequestDependencies = {
  getSession: (sessionId: string) => Promise<{ branchId: string; state: "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED"; customerCanWrite: boolean } | null>;
  create: (command: CreateServiceRequestCommand, session: { branchId: string }) => Promise<{ requestId: string; version: number }>;
};

export async function createServiceRequest(input: unknown, dependencies: CreateServiceRequestDependencies) {
  const command = createServiceRequestSchema.parse(input);
  const session = await dependencies.getSession(command.sessionId);
  if (!session || !session.customerCanWrite) throw new AppError("FORBIDDEN", "This Session cannot accept service requests.");
  if (session.state === "CLOSED" || session.state === "CANCELLED") throw new AppError("FORBIDDEN", "This Session is closed.");
  return dependencies.create(command, { branchId: session.branchId });
}
