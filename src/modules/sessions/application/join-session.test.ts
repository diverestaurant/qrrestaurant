import { describe, expect, it, vi } from "vitest";
import { joinSession } from "./join-session";

const command = { sessionId: "00000000-0000-4000-8000-000000000601", joinCode: "123456" };
const actor = { anonymousUserId: "00000000-0000-4000-8000-000000000801" };
const session = { branchId: "b", restaurantId: "r", tableId: "t", state: "OPEN" as const };

describe("joinSession", () => {
  it("does not disclose whether a session exists when the code is invalid", async () => {
    const grant = vi.fn();
    await expect(joinSession(command, actor, { verifyCode: async () => null, grant })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(grant).not.toHaveBeenCalled();
  });

  it("blocks a closed Session even with a previously valid code", async () => {
    const grant = vi.fn();
    await expect(joinSession(command, actor, { verifyCode: async () => ({ ...session, state: "CLOSED" }), grant })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(grant).not.toHaveBeenCalled();
  });

  it("keeps the anonymous actor server-derived", async () => {
    const grant = vi.fn().mockResolvedValue({ grantId: "g", expiresAt: "2026-07-20T13:00:00.000Z" });
    await joinSession(command, actor, { verifyCode: async () => session, grant });
    expect(grant).toHaveBeenCalledWith(command, actor, session);
  });
});
