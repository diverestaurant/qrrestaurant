import { describe, expect, it } from "vitest";
import { calculatePricing, money, multiplyMoney, subtractMoney } from "@/modules/pricing/domain/money";

describe("server pricing primitives", () => {
  it("keeps all business arithmetic in integer minor units", () => {
    const totals = calculatePricing([{ unit: money(1680, "MYR"), quantity: 2 }, { unit: money(680, "MYR"), quantity: 1 }], { taxBasisPoints: 600, serviceBasisPoints: 0, taxInclusive: false, serviceInclusive: true });
    expect(totals.subtotal.minor).toBe(4040);
    expect(totals.tax.minor).toBe(242);
    expect(totals.grandTotal.minor).toBe(4282);
  });

  it("rejects mixed currencies", () => {
    expect(() => calculatePricing([{ unit: money(100, "MYR"), quantity: 1 }, { unit: money(100, "SGD"), quantity: 1 }], { taxBasisPoints: 0, serviceBasisPoints: 0, taxInclusive: true, serviceInclusive: true })).toThrow("Currency mismatch");
  });

  it("rejects negative and unsafe arithmetic results", () => {
    expect(() => subtractMoney(money(10, "MYR"), money(11, "MYR"))).toThrow("non-negative");
    expect(() => multiplyMoney(money(Number.MAX_SAFE_INTEGER, "MYR"), 2)).toThrow("non-negative");
  });
});
