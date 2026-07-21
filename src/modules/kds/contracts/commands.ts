import { z } from "zod";

export const transitionOrderItemSchema = z.object({
  orderItemId: z.uuid(),
  nextState: z.enum(["ACCEPTED", "REJECTED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
  expectedVersion: z.int().positive(),
  idempotencyKey: z.uuid(),
  reason: z.string().trim().min(3).max(240).optional(),
}).superRefine((command, context) => {
  if ((command.nextState === "REJECTED" || command.nextState === "CANCELLED") && !command.reason) {
    context.addIssue({ code: "custom", message: "A reason is required when rejecting or cancelling an item.", path: ["reason"] });
  }
});

export type TransitionOrderItemCommand = z.infer<typeof transitionOrderItemSchema>;
