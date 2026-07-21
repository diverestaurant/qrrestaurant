import { describe, expect, it } from "vitest";
import { requestFingerprint, sameRequest } from "./idempotency";

describe("command idempotency fingerprint", () => {
  it("ignores object key order but preserves array order", () => {
    expect(sameRequest({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(sameRequest({ items: ["a", "b"] }, { items: ["b", "a"] })).toBe(false);
  });

  it("produces a stable fixed-length digest", () => {
    expect(requestFingerprint({ command: "submit", amountMinor: 1200 })).toMatch(/^[a-f0-9]{64}$/);
  });
});
