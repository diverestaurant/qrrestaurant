import { z } from "zod";

const optionalText = z.string().nullable().optional();
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const receiptSnapshotSchema = z.object({
  snapshotVersion: z.number().int().positive().optional(),
  receiptNumber: z.string().min(1),
  sessionId: z.uuid(),
  businessDate: z.string().min(1),
  currency: z.string().length(3),
  restaurant: z.object({ name: z.string(), legalName: optionalText, registrationNumber: optionalText, taxRegistrationNumber: optionalText, contactPhone: optionalText, contactEmail: optionalText, receiptFooter: optionalText }).optional(),
  branch: z.object({ name: z.string(), addressLine1: optionalText, addressLine2: optionalText, city: optionalText, postalCode: optionalText, countryCode: optionalText, contactPhone: optionalText, contactEmail: optionalText }).optional(),
  tableLabel: z.string().optional(),
  totalDueMinor: minor,
  totalPaidMinor: minor,
  discounts: z.array(z.object({ id: z.uuid(), kind: z.string(), discountMinor: minor, reason: z.string() })),
  orders: z.array(z.object({ id: z.uuid(), displayNumber: z.number().int(), totalMinor: minor, items: z.array(z.object({ name: z.string(), quantity: z.number().int().positive(), unitPriceMinor: minor, variant: z.unknown().optional(), modifiers: z.unknown().optional() })) })),
  payments: z.array(z.object({ id: z.uuid(), method: z.string(), amountMinor: minor, cashReceivedMinor: minor.nullable().optional(), changeMinor: minor.nullable().optional(), reference: optionalText })),
  issuedAt: z.string(),
  reprintOf: z.uuid().optional(),
});

export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>;
