import { z } from "zod";

export const requestSessionPaymentSchema = z.object({
  sessionId: z.uuid(),
  expectedVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
});

export const markTableReadySchema = z.object({
  tableId: z.uuid(),
  expectedVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
});
