import { describe, expect, it } from "vitest";
import { isWithinOperatingWindow } from "./operating-window";

describe("menu item operating windows", () => {
  const at = (iso: string) => new Date(iso);

  it("allows items without a schedule and equal always-on bounds", () => {
    expect(isWithinOperatingWindow({}, "Asia/Kuching", at("2026-07-21T04:00:00Z"))).toBe(true);
    expect(isWithinOperatingWindow({ availableFrom: "10:00", availableUntil: "10:00" }, "Asia/Kuching", at("2026-07-21T04:00:00Z"))).toBe(true);
  });

  it("uses the branch timezone for a same-day window", () => {
    expect(isWithinOperatingWindow({ availableFrom: "10:00", availableUntil: "22:00" }, "Asia/Kuching", at("2026-07-21T04:00:00Z"))).toBe(true);
    expect(isWithinOperatingWindow({ availableFrom: "10:00", availableUntil: "22:00" }, "Asia/Kuching", at("2026-07-21T15:00:00Z"))).toBe(false);
  });

  it("supports windows that cross midnight", () => {
    const rules = { availableFrom: "22:00", availableUntil: "02:00" };
    expect(isWithinOperatingWindow(rules, "UTC", at("2026-07-21T23:30:00Z"))).toBe(true);
    expect(isWithinOperatingWindow(rules, "UTC", at("2026-07-21T03:00:00Z"))).toBe(false);
  });

  it("fails closed for incomplete, invalid, or unknown timezone rules", () => {
    expect(isWithinOperatingWindow({ availableFrom: "10:00" }, "Asia/Kuching")).toBe(false);
    expect(isWithinOperatingWindow({ availableFrom: "25:00", availableUntil: "10:00" }, "Asia/Kuching")).toBe(false);
    expect(isWithinOperatingWindow({ availableFrom: "10:00", availableUntil: "22:00" }, "Not/A_Timezone")).toBe(false);
  });
});
