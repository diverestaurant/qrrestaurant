import { describe, expect, it, vi } from "vitest";
import { openSession } from "./open-session";

const command = { tableId: "00000000-0000-4000-8000-000000000601", guestCount: 2, idempotencyKey: "00000000-0000-4000-8000-000000000701" };

describe("openSession", () => {
  it("rejects a table with an active session before persistence", async () => {
    const open = vi.fn();
    await expect(openSession(command, { getTable: async () => ({ branchId: "b", restaurantId: "r", active: true, capacity: 4 }), getActiveSession: async () => ({ id: "s", version: 1 }), open })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(open).not.toHaveBeenCalled();
  });

  it("enforces table capacity before the repository command", async () => {
    const open = vi.fn();
    await expect(openSession({ ...command, guestCount: 5 }, { getTable: async () => ({ branchId: "b", restaurantId: "r", active: true, capacity: 4 }), getActiveSession: async () => null, open })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(open).not.toHaveBeenCalled();
  });

  it("passes only validated command and trusted tenant context to persistence", async () => {
    const open = vi.fn().mockResolvedValue({ sessionId: "s", version: 1 });
    await expect(openSession(command, { getTable: async () => ({ branchId: "b", restaurantId: "r", active: true, capacity: 4 }), getActiveSession: async () => null, open })).resolves.toEqual({ sessionId: "s", version: 1 });
    expect(open).toHaveBeenCalledWith(command, { branchId: "b", restaurantId: "r" });
  });
});
