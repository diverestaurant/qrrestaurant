import { z } from "zod";

const idempotent = { idempotencyKey: z.uuid() };
export const platformTenantCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...idempotent, type: z.literal("platform.restaurant.create"), name: z.string().trim().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), defaultCurrency: z.string().regex(/^[A-Z]{3}$/), defaultTimezone: z.string().trim().min(1).max(80), branchName: z.string().trim().min(1).max(160), branchSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), planKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/) }),
  z.object({ ...idempotent, type: z.literal("platform.restaurant.lifecycle.set"), restaurantId: z.uuid(), branchId: z.uuid(), expectedVersion: z.int().positive(), status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3).max(240) }),
  z.object({ ...idempotent, type: z.literal("platform.subscription.update"), restaurantId: z.uuid(), branchId: z.uuid(), expectedVersion: z.int().positive(), planKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/), status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]) }),
]);

export type PlatformTenantCommand = z.infer<typeof platformTenantCommandSchema>;
