import { describe, expect, it } from "vitest";
import { generateJoinCode, isGrantLive, isJoinCode, normalizeJoinCode } from "./join-code";

describe("session join code", () => {
  it("normalizes pasted input without expanding the trust boundary", () => {
    expect(normalizeJoinCode(" 12a34567 ")).toBe("123456");
    expect(isJoinCode(normalizeJoinCode("12a34567"))).toBe(true);
  });

  it("preserves leading zeroes when generated", () => {
    expect(generateJoinCode(() => 0)).toBe("000000");
    expect(generateJoinCode(() => 0.999999)).toBe("999999");
  });

  it("treats the expiry boundary as no longer live", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    expect(isGrantLive(new Date("2026-07-20T12:00:00.001Z"), now)).toBe(true);
    expect(isGrantLive(now, now)).toBe(false);
  });
});
