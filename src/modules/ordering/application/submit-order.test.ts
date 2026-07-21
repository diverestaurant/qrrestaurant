import { describe, expect, it, vi } from "vitest";
import { submitOrder } from "@/modules/ordering/application/submit-order";

const base = { sessionId: "00000000-0000-4000-8000-000000000001", items: [{ menuItemId: "00000000-0000-4000-8000-000000000002", quantity: 1, modifierOptionIds: [] }], idempotencyKey: "00000000-0000-4000-8000-000000000003", expectedSessionVersion: 2 };

describe("submit order application boundary", () => {
  it("rejects a stale customer command before the repository", async () => {
    const submit = vi.fn();
    await expect(submitOrder(base, { getSession: async () => ({ state: "OPEN", version: 3, customerCanWrite: true }), submit })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves unknown/closed session boundaries", async () => {
    await expect(submitOrder(base, { getSession: async () => ({ state: "CLOSED", version: 2, customerCanWrite: false }), submit: vi.fn() })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
