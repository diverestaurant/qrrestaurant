import { describe, expect, it, vi } from "vitest";
import { setMenuItemAvailability } from "./set-availability";

const command = { menuItemId: "00000000-0000-4000-8000-000000000401", available: false, expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000702" };

describe("setMenuItemAvailability", () => {
  it("rejects a stale menu item without writing", async () => {
    const updateItem = vi.fn();
    await expect(setMenuItemAvailability(command, { getItem: async () => ({ branchId: "b", version: 2, available: true }), updateItem })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("is idempotent when the requested availability is already true", async () => {
    const updateItem = vi.fn();
    await expect(setMenuItemAvailability({ ...command, available: true }, { getItem: async () => ({ branchId: "b", version: 1, available: true }), updateItem })).resolves.toEqual({ version: 1, available: true, unchanged: true });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("passes the trusted current branch context to the write port", async () => {
    const updateItem = vi.fn().mockResolvedValue({ version: 2, available: false });
    await setMenuItemAvailability(command, { getItem: async () => ({ branchId: "b", version: 1, available: true }), updateItem });
    expect(updateItem).toHaveBeenCalledWith(command, { branchId: "b", version: 1 });
  });
});
