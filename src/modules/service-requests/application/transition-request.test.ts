import { describe, expect, it, vi } from "vitest";
import { transitionServiceRequest } from "./transition-request";

const command = { requestId: "00000000-0000-4000-8000-000000000902", nextState: "CLAIMED" as const, expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000705" };

describe("transitionServiceRequest", () => {
  it("rejects an already-resolved request", async () => {
    const updateRequest = vi.fn();
    await expect(transitionServiceRequest(command, { getRequest: async () => ({ branchId: "b", state: "RESOLVED", version: 1 }), updateRequest })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it("rejects a stale waiter action", async () => {
    const updateRequest = vi.fn();
    await expect(transitionServiceRequest(command, { getRequest: async () => ({ branchId: "b", state: "OPEN", version: 2 }), updateRequest })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it("allows claim then passes the branch context to persistence", async () => {
    const updateRequest = vi.fn().mockResolvedValue({ version: 2, state: "CLAIMED" });
    await expect(transitionServiceRequest(command, { getRequest: async () => ({ branchId: "b", state: "OPEN", version: 1 }), updateRequest })).resolves.toEqual({ version: 2, state: "CLAIMED" });
    expect(updateRequest).toHaveBeenCalledWith(command, { branchId: "b", state: "OPEN", version: 1 });
  });
});
