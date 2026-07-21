import { describe, expect, it, vi } from "vitest";
import { createServiceRequest } from "./create-request";

const command = { sessionId: "00000000-0000-4000-8000-000000000601", requestType: "CALL_WAITER" as const, idempotencyKey: "00000000-0000-4000-8000-000000000703" };

describe("createServiceRequest", () => {
  it("rejects customer writes after a session is closed", async () => {
    const create = vi.fn();
    await expect(createServiceRequest(command, { getSession: async () => ({ branchId: "b", state: "CLOSED", customerCanWrite: true }), create })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(create).not.toHaveBeenCalled();
  });

  it("requires the server-side live customer grant check", async () => {
    const create = vi.fn();
    await expect(createServiceRequest(command, { getSession: async () => ({ branchId: "b", state: "OPEN", customerCanWrite: false }), create })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(create).not.toHaveBeenCalled();
  });

  it("writes only after the session boundary passes", async () => {
    const create = vi.fn().mockResolvedValue({ requestId: "r", version: 1 });
    await expect(createServiceRequest(command, { getSession: async () => ({ branchId: "b", state: "OPEN", customerCanWrite: true }), create })).resolves.toEqual({ requestId: "r", version: 1 });
    expect(create).toHaveBeenCalledWith(command, { branchId: "b" });
  });
});
