import { describe, expect, it } from "vitest";
import { canTransitionOrder, canTransitionPayment, canTransitionSession, derivePaymentAggregate } from "@/modules/ordering/domain/state";

describe("order/session/payment state machines", () => {
  it("accepts only designed transitions", () => {
    expect(canTransitionSession("OPEN", "PAYMENT_REQUESTED")).toBe(true);
    expect(canTransitionSession("CLOSED", "OPEN")).toBe(false);
    expect(canTransitionOrder("PREPARING", "READY")).toBe(true);
    expect(canTransitionOrder("READY", "PREPARING")).toBe(false);
    expect(canTransitionPayment("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionPayment("CONFIRMED", "FAILED")).toBe(false);
  });

  it("prevents an over-allocated balance", () => {
    expect(derivePaymentAggregate(0, 1000)).toBe("UNPAID");
    expect(derivePaymentAggregate(500, 1000)).toBe("PARTIALLY_PAID");
    expect(derivePaymentAggregate(1000, 1000)).toBe("PAID");
    expect(() => derivePaymentAggregate(1001, 1000)).toThrow("exceeds amount due");
  });
});
