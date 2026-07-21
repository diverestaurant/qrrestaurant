import { z } from "zod";

export const createServiceRequestSchema = z.object({
  sessionId: z.uuid(),
  requestType: z.enum(["CALL_WAITER", "CUTLERY", "WATER", "BILL", "OTHER"]),
  note: z.string().trim().max(240).optional(),
  idempotencyKey: z.uuid(),
});

export type CreateServiceRequestCommand = z.infer<typeof createServiceRequestSchema>;

export const transitionServiceRequestSchema = z.object({
  requestId: z.uuid(),
  nextState: z.enum(["CLAIMED", "RESOLVED", "CANCELLED"]),
  expectedVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
});

export type TransitionServiceRequestCommand = z.infer<typeof transitionServiceRequestSchema>;
