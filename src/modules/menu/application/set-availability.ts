import { AppError } from "@/lib/errors";
import { setMenuItemAvailabilitySchema, type SetMenuItemAvailabilityCommand } from "@/modules/menu/contracts/commands";

export type SetMenuItemAvailabilityDependencies = {
  getItem: (menuItemId: string) => Promise<{ branchId: string; version: number; available: boolean } | null>;
  updateItem: (command: SetMenuItemAvailabilityCommand, current: { branchId: string; version: number }) => Promise<{ version: number; available: boolean }>;
};

export async function setMenuItemAvailability(input: unknown, dependencies: SetMenuItemAvailabilityDependencies) {
  const command = setMenuItemAvailabilitySchema.parse(input);
  const current = await dependencies.getItem(command.menuItemId);
  if (!current) throw new AppError("NOT_FOUND", "Menu item not found.");
  if (current.version !== command.expectedVersion) throw new AppError("STALE_STATE", "The menu item changed. Refresh before updating.", true);
  if (current.available === command.available) return { version: current.version, available: current.available, unchanged: true };
  return dependencies.updateItem(command, { branchId: current.branchId, version: current.version });
}
