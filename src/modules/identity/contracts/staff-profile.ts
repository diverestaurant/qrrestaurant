import { z } from "zod";

export const staffProfileLocaleSchema = z.enum(["en", "zh", "ms"]);

export const updateStaffProfileSchema = z.object({
  restaurantId: z.uuid(),
  branchId: z.uuid(),
  displayName: z.string().trim().min(1).max(80),
  preferredLocale: staffProfileLocaleSchema,
  expectedVersion: z.int().nonnegative(),
  idempotencyKey: z.uuid(),
});

export type StaffProfileLocale = z.infer<typeof staffProfileLocaleSchema>;
export type StaffProfileView = { displayName: string; preferredLocale: StaffProfileLocale; version: number };
