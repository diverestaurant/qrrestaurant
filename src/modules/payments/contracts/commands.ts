import { z } from "zod";

export const confirmPaymentSchema = z.object({
  paymentId: z.uuid(),
  observedReference: z.string().trim().max(120).optional(),
  cashReceivedMinor: z.int().nonnegative().optional(),
  idempotencyKey: z.uuid(),
});

export type ConfirmPaymentCommand = z.infer<typeof confirmPaymentSchema>;

export const applyDiscountSchema = z.object({
  sessionId: z.uuid(),
  kind: z.enum(["PERCENT", "FIXED"]),
  percentageBasisPoints: z.int().min(1).max(10000).optional(),
  fixedAmountMinor: z.int().positive().optional(),
  reason: z.string().trim().min(1).max(240),
  expectedSessionVersion: z.int().nonnegative(),
  idempotencyKey: z.uuid(),
}).superRefine((value, context) => {
  const hasPercent = value.percentageBasisPoints !== undefined;
  const hasFixed = value.fixedAmountMinor !== undefined;
  if (value.kind === "PERCENT" && (!hasPercent || hasFixed)) context.addIssue({ code: "custom", path: ["percentageBasisPoints"], message: "Percentage discounts require percentageBasisPoints only." });
  if (value.kind === "FIXED" && (hasPercent || !hasFixed)) context.addIssue({ code: "custom", path: ["fixedAmountMinor"], message: "Fixed discounts require fixedAmountMinor only." });
});

export type ApplyDiscountCommand = z.infer<typeof applyDiscountSchema>;

export const issueReceiptSchema = z.object({ sessionId: z.uuid(), idempotencyKey: z.uuid() });
export type IssueReceiptCommand = z.infer<typeof issueReceiptSchema>;

export const reprintReceiptSchema = z.object({ receiptId: z.uuid(), idempotencyKey: z.uuid() });
export type ReprintReceiptCommand = z.infer<typeof reprintReceiptSchema>;

export const closeSessionSchema = z.object({ sessionId: z.uuid(), expectedSessionVersion: z.int().nonnegative(), idempotencyKey: z.uuid() });
export type CloseSessionCommand = z.infer<typeof closeSessionSchema>;
