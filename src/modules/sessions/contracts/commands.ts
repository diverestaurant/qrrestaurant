import { z } from "zod";

export const openSessionSchema = z.object({
  tableId: z.uuid(),
  guestCount: z.int().min(1).max(50),
  idempotencyKey: z.uuid(),
});

export type OpenSessionCommand = z.infer<typeof openSessionSchema>;

export const rotateJoinCodeSchema = z.object({
  sessionId: z.uuid(),
  expectedSessionVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
});

export type RotateJoinCodeCommand = z.infer<typeof rotateJoinCodeSchema>;

export const joinSessionSchema = z.object({
  sessionId: z.uuid(),
  joinCode: z.string().trim().regex(/^\d{6}$/, "Join Code must contain six digits."),
});

export type JoinSessionCommand = z.infer<typeof joinSessionSchema>;

export const joinTableEntrySchema = z.object({
  restaurantSlug: z.string().trim().regex(/^[a-z0-9-]+$/, "Restaurant is invalid."),
  branchSlug: z.string().trim().regex(/^[a-z0-9-]+$/, "Branch is invalid."),
  tableToken: z.string().trim().min(1).max(256),
  joinCode: z.string().trim().regex(/^\d{6}$/, "Join Code must contain six digits."),
});

export const joinCustomerSessionSchema = z.union([joinSessionSchema, joinTableEntrySchema]);
export type JoinTableEntryCommand = z.infer<typeof joinTableEntrySchema>;

export const sessionGrantSchema = z.object({
  sessionId: z.uuid(),
  customerId: z.uuid(),
  expiresAt: z.coerce.date(),
});

export type SessionGrant = z.infer<typeof sessionGrantSchema>;
