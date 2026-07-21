import { describe, expect, it } from "vitest";
import { can } from "@/modules/identity/contracts/capabilities";

describe("capability mapping", () => {
  it("keeps role affordances separate from UI route visibility", () => {
    expect(can("KITCHEN", "order.prepare")).toBe(true);
    expect(can("KITCHEN", "payment.confirm")).toBe(false);
    expect(can("WAITER", "session.open")).toBe(true);
    expect(can("CASHIER", "order.prepare")).toBe(false);
  });
});
