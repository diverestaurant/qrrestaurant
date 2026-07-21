import { AppError } from "@/lib/errors";
import { rotateJoinCodeSchema, type RotateJoinCodeCommand } from "@/modules/sessions/contracts/commands";

export type RotateJoinCodeDependencies = {
  getSession: (sessionId: string) => Promise<{ state: string; version: number; staffCanRotate: boolean } | null>;
  rotate: (command: RotateJoinCodeCommand) => Promise<{ sessionId: string; version: number; joinCode: string; expiresAt: string }>;
};

export async function rotateJoinCode(input: unknown, dependencies: RotateJoinCodeDependencies) {
  const command = rotateJoinCodeSchema.parse(input);
  const session = await dependencies.getSession(command.sessionId);
  if (!session || !session.staffCanRotate) throw new AppError("FORBIDDEN", "This staff identity cannot rotate the Join Code.");
  if (session.state !== "OPEN") throw new AppError("CONFLICT", "Only an open Session can rotate its Join Code.");
  if (session.version !== command.expectedSessionVersion) throw new AppError("STALE_STATE", "The Session changed. Refresh before rotating its Join Code.", true);
  return dependencies.rotate(command);
}
