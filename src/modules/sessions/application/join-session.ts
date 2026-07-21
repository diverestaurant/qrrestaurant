import { AppError } from "@/lib/errors";
import { joinSessionSchema, type JoinSessionCommand } from "@/modules/sessions/contracts/commands";

export type AnonymousActor = { anonymousUserId: string };

export type JoinSessionDependencies = {
  verifyCode: (sessionId: string, joinCode: string) => Promise<{ branchId: string; restaurantId: string; tableId: string; state: "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED" } | null>;
  grant: (command: JoinSessionCommand, actor: AnonymousActor, session: { branchId: string; restaurantId: string; tableId: string }) => Promise<{ grantId: string; expiresAt: string }>;
};

export async function joinSession(input: unknown, actor: AnonymousActor, dependencies: JoinSessionDependencies) {
  const command = joinSessionSchema.parse(input);
  const session = await dependencies.verifyCode(command.sessionId, command.joinCode);
  if (!session) throw new AppError("FORBIDDEN", "The Join Code is invalid or expired.");
  if (!["OPEN", "PAYMENT_REQUESTED", "PAYMENT_PENDING"].includes(session.state)) throw new AppError("FORBIDDEN", "This Session is no longer accepting guests.");
  return dependencies.grant(command, actor, session);
}
