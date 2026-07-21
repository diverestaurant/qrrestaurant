import { describe, expect, it, vi } from "vitest";
import { rotateJoinCode } from "./rotate-join-code";

const command = { sessionId: "00000000-0000-4000-8000-000000000701", expectedSessionVersion: 3, idempotencyKey: "00000000-0000-4000-8000-000000000799" };

describe("rotateJoinCode", () => {
  it("rejects stale and closed Session commands", async () => {
    const rotate = vi.fn();
    await expect(rotateJoinCode(command, { getSession: async () => ({ state: "OPEN", version: 4, staffCanRotate: true }), rotate })).rejects.toMatchObject({ code: "STALE_STATE" });
    await expect(rotateJoinCode(command, { getSession: async () => ({ state: "CLOSED", version: 3, staffCanRotate: true }), rotate })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(rotate).not.toHaveBeenCalled();
  });

  it("returns the one-time Join Code from the authorized adapter", async () => {
    const result = { sessionId: command.sessionId, version: 4, joinCode: "654321", expiresAt: "2026-07-21T20:00:00.000Z" };
    await expect(rotateJoinCode(command, { getSession: async () => ({ state: "OPEN", version: 3, staffCanRotate: true }), rotate: async () => result })).resolves.toEqual(result);
  });
});
