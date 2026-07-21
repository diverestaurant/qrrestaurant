import { describe, expect, it } from "vitest";
import { formatMinorForAmountInput, parseMajorAmountToMinor } from "./major-amount";

describe("cashier major amount conversion", () => {
  it("converts localized operator input to exact integer minor units", () => {
    expect(parseMajorAmountToMinor("51.66")).toBe(5166);
    expect(parseMajorAmountToMinor("50")).toBe(5000);
    expect(parseMajorAmountToMinor("0.05")).toBe(5);
    expect(formatMinorForAmountInput(5166)).toBe("51.66");
  });

  it("rejects ambiguous precision and non-decimal input", () => {
    expect(() => parseMajorAmountToMinor("51.666")).toThrow();
    expect(() => parseMajorAmountToMinor("1,000.00")).toThrow();
    expect(() => parseMajorAmountToMinor("-5.00")).toThrow();
  });
});
