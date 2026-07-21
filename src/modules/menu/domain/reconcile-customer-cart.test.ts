import { describe, expect, it } from "vitest";
import type { CustomerMenuItemView } from "@/contracts/view-models";
import { reconcileCustomerCart, type CustomerCartLine } from "./reconcile-customer-cart";

const item: CustomerMenuItemView = {
  id: "item-1",
  name: "Noodles",
  description: "",
  priceMinor: 1_000,
  available: true,
  availabilityReason: "AVAILABLE",
  category: "Mains",
  imageUrl: null,
  imageAlt: "Noodles",
  featured: false,
  spiceLevel: 0,
  variants: [{ id: "large", name: "Large", priceDeltaMinor: 200 }],
  modifierGroups: [{ id: "sauce", name: "Sauce", required: false, minSelections: 0, maxSelections: 1, options: [{ id: "chili", name: "Chili", priceDeltaMinor: 50 }] }],
};

function line(overrides: Partial<CustomerCartLine> = {}): CustomerCartLine {
  return { key: "item-1:large:chili", item, quantity: 2, variantId: "large", modifierOptionIds: ["chili"], unitPriceMinor: 1_250, ...overrides };
}

describe("customer cart reconciliation", () => {
  it("rebinds valid lines to the authoritative item and price", () => {
    const changed = { ...item, name: "Wok Noodles", priceMinor: 1_100 };
    const result = reconcileCustomerCart({ line: line({ key: "line" }) }, [changed]);
    expect(result).toMatchObject({ removedCount: 0, repricedCount: 2, changed: true });
    expect(result.cart.line.item.name).toBe("Wok Noodles");
    expect(result.cart.line.unitPriceMinor).toBe(1_350);
  });

  it("removes sold-out and deleted configurations", () => {
    const soldOut = { ...item, available: false, availabilityReason: "SOLD_OUT" as const };
    expect(reconcileCustomerCart({ line: line({ key: "line" }) }, [soldOut]).removedCount).toBe(2);
    expect(reconcileCustomerCart({ line: line({ key: "line", variantId: "missing" }) }, [item]).removedCount).toBe(2);
    expect(reconcileCustomerCart({ line: line({ key: "line", modifierOptionIds: ["missing"] }) }, [item]).removedCount).toBe(2);
  });

  it("preserves quantity and notes when the configuration is still valid", () => {
    const result = reconcileCustomerCart({ line: line({ key: "line", note: "No onion" }) }, [item]);
    expect(result.changed).toBe(false);
    expect(result.cart.line).toMatchObject({ quantity: 2, note: "No onion", unitPriceMinor: 1_250 });
  });
});
