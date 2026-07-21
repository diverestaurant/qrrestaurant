import { describe, expect, it } from "vitest";
import { presentFreshness } from "@/ui/recovery/freshness";

describe("freshness presentation", () => {
  it("makes a confirmed local check visible", () => {
    expect(presentFreshness("fresh")).toEqual({ label: "App reachable", detail: "Authoritative refresh available", tone: "success" });
  });

  it("distinguishes a stale view from an offline browser", () => {
    expect(presentFreshness("stale").label).toBe("Check required");
    expect(presentFreshness("offline").label).toBe("Offline");
  });
});
