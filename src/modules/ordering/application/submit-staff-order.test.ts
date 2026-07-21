import { describe, expect, it, vi } from "vitest";
import { submitStaffOrder } from "./submit-staff-order";

const command = { sessionId: "00000000-0000-4000-8000-000000000701", items: [{ menuItemId: "00000000-0000-4000-8000-000000000401", quantity: 1, modifierOptionIds: [] }], idempotencyKey: "00000000-0000-4000-8000-000000000798", expectedSessionVersion: 2 };

describe("submitStaffOrder", () => {
  it("requires permission, an open Session and the current version", async () => {
    const submit = vi.fn();
    await expect(submitStaffOrder(command, { getSession: async () => ({ state: "OPEN", version: 2, staffCanWrite: false }), submit })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(submitStaffOrder(command, { getSession: async () => ({ state: "PAID", version: 2, staffCanWrite: true }), submit })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(submitStaffOrder(command, { getSession: async () => ({ state: "OPEN", version: 3, staffCanWrite: true }), submit })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("delegates pricing and snapshots to the transactional adapter", async () => {
    const result = { orderId: "00000000-0000-4000-8000-000000000797", version: 1 };
    await expect(submitStaffOrder(command, { getSession: async () => ({ state: "OPEN", version: 2, staffCanWrite: true }), submit: async () => result })).resolves.toEqual(result);
  });
});
