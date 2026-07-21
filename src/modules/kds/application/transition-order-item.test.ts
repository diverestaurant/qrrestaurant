import { describe, expect, it, vi } from "vitest";
import { transitionOrderItem } from "./transition-order-item";
import { transitionOrderItemSchema } from "@/modules/kds/contracts/commands";

const command = { orderItemId: "00000000-0000-4000-8000-000000000901", nextState: "PREPARING" as const, expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000704" };

describe("transitionOrderItem", () => {
  it("rejects stale queue actions", async () => {
    const updateItem = vi.fn();
    await expect(transitionOrderItem(command, { getItem: async () => ({ branchId: "b", stationKey: "wok", state: "ACCEPTED", version: 2 }), updateItem })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("rejects transitions outside the state machine", async () => {
    const updateItem = vi.fn();
    await expect(transitionOrderItem({ ...command, nextState: "PREPARING" }, { getItem: async () => ({ branchId: "b", stationKey: "wok", state: "SUBMITTED", version: 1 }), updateItem })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("persists an allowed transition with the current version context", async () => {
    const updateItem = vi.fn().mockResolvedValue({ version: 2, state: "PREPARING" });
    await expect(transitionOrderItem(command, { getItem: async () => ({ branchId: "b", stationKey: "wok", state: "ACCEPTED", version: 1 }), updateItem })).resolves.toEqual({ version: 2, state: "PREPARING" });
    expect(updateItem).toHaveBeenCalledWith(command, { branchId: "b", stationKey: "wok", state: "ACCEPTED", version: 1 });
  });

  it("requires an operational reason for rejection and cancellation", () => {
    expect(transitionOrderItemSchema.safeParse({ ...command, nextState: "REJECTED" }).success).toBe(false);
    expect(transitionOrderItemSchema.safeParse({ ...command, nextState: "REJECTED", reason: "Item unavailable" }).success).toBe(true);
    expect(transitionOrderItemSchema.safeParse({ ...command, nextState: "CANCELLED", reason: "Guest request" }).success).toBe(true);
  });
});
