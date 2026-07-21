import { z } from "zod";

export const submitOrderSchema = z.object({ sessionId: z.uuid(), items: z.array(z.object({ menuItemId: z.uuid(), variantId: z.uuid().optional(), quantity: z.int().min(1).max(20), modifierOptionIds: z.array(z.uuid()).max(20), note: z.string().trim().max(240).optional() })).min(1).max(50), idempotencyKey: z.uuid(), expectedSessionVersion: z.int().nonnegative() });
export type SubmitOrderCommand = z.infer<typeof submitOrderSchema>;

export const beginPaymentSchema = z.object({ sessionId: z.uuid(), amountMinor: z.int().positive(), currency: z.string().length(3), method: z.enum(["CASH", "CARD", "DUITNOW", "E_WALLET", "OTHER"]), expectedSessionVersion: z.int().nonnegative(), idempotencyKey: z.uuid() });
export type BeginPaymentCommand = z.infer<typeof beginPaymentSchema>;
