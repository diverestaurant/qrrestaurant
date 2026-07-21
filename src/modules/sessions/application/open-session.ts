import { AppError } from "@/lib/errors";
import { openSessionSchema, type OpenSessionCommand } from "@/modules/sessions/contracts/commands";

export type OpenSessionDependencies = {
  getTable: (tableId: string) => Promise<{ branchId: string; restaurantId: string; active: boolean; capacity: number } | null>;
  getActiveSession: (tableId: string) => Promise<{ id: string; version: number } | null>;
  open: (command: OpenSessionCommand, table: { branchId: string; restaurantId: string }) => Promise<{ sessionId: string; version: number }>;
};

export async function openSession(input: unknown, dependencies: OpenSessionDependencies) {
  const command = openSessionSchema.parse(input);
  const table = await dependencies.getTable(command.tableId);
  if (!table || !table.active) throw new AppError("NOT_FOUND", "This table is not available.");
  if (command.guestCount > table.capacity) throw new AppError("VALIDATION_ERROR", "Guest count exceeds this table's capacity.");
  if (await dependencies.getActiveSession(command.tableId)) throw new AppError("CONFLICT", "This table already has an active Session.", true);
  return dependencies.open(command, { branchId: table.branchId, restaurantId: table.restaurantId });
}
