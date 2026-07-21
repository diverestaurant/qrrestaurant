import { z } from "zod";

export const setMenuItemAvailabilitySchema = z.object({
  menuItemId: z.uuid(),
  available: z.boolean(),
  expectedVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
});

export type SetMenuItemAvailabilityCommand = z.infer<typeof setMenuItemAvailabilitySchema>;
