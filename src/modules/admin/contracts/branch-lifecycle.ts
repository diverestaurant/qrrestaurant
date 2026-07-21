import { z } from "zod";

const base = { restaurantId: z.uuid(), anchorBranchId: z.uuid(), idempotencyKey: z.uuid() };

export const branchLifecycleCommandSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("branch.create"),
    name: z.string().trim().min(1).max(160),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    currency: z.string().regex(/^[A-Z]{3}$/),
    timezone: z.string().trim().min(1).max(80),
    businessDayCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    defaultLocale: z.enum(["en", "zh", "ms"]),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
  }),
  z.object({
    ...base,
    type: z.literal("branch.lifecycle.set"),
    branchId: z.uuid(),
    expectedVersion: z.int().positive(),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().min(3).max(240),
  }),
]);

export const branchCatalogQuerySchema = z.object({ restaurantId: z.uuid(), anchorBranchId: z.uuid() });
export type BranchLifecycleCommand = z.infer<typeof branchLifecycleCommandSchema>;
