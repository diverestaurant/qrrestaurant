import { describe, expect, it } from "vitest";
import { BoundedEventDeduper, reconcileEvent } from "@/modules/realtime/domain/reconcile-event";
import type { RealtimeEvent } from "@/modules/realtime/contracts/events";

const event: RealtimeEvent = {
  eventId: "event-1",
  eventType: "order.item.changed",
  schemaVersion: 1,
  restaurantId: "restaurant-1",
  branchId: "branch-1",
  entityType: "order_item",
  entityId: "item-1",
  entityVersion: 2,
  correlationId: "command-1",
};

const input = (overrides: Partial<RealtimeEvent> = {}) => ({
  event: { ...event, ...overrides },
  scope: { restaurantId: "restaurant-1", branchId: "branch-1" },
  localEntityVersion: 1,
  seenEventIds: new Set<string>(),
});

describe("reconcileEvent", () => {
  it("accepts only the next entity version", () => {
    expect(reconcileEvent(input())).toEqual({ kind: "apply", reason: "next_version" });
  });

  it("ignores duplicates and older versions", () => {
    expect(reconcileEvent({ ...input(), seenEventIds: new Set(["event-1"]) })).toEqual({ kind: "ignore", reason: "duplicate_event" });
    expect(reconcileEvent(input({ entityVersion: 1 }))).toEqual({ kind: "ignore", reason: "older_or_equal_version" });
  });

  it("requires an authoritative resync when a version gap is detected", () => {
    expect(reconcileEvent(input({ entityVersion: 4 }))).toEqual({ kind: "resync", reason: "version_gap" });
  });

  it("rejects wrong tenant scope and unsupported schemas", () => {
    expect(reconcileEvent(input({ branchId: "other-branch" }))).toEqual({ kind: "reject", reason: "wrong_scope" });
    expect(reconcileEvent(input({ schemaVersion: 2 }))).toEqual({ kind: "reject", reason: "unsupported_schema" });
  });

  it("rejects malformed event versions", () => {
    expect(reconcileEvent(input({ entityVersion: 0 }))).toEqual({ kind: "reject", reason: "invalid_event" });
  });
});

describe("BoundedEventDeduper", () => {
  it("keeps the event cursor bounded and preserves duplicate detection", () => {
    const deduper = new BoundedEventDeduper(2);
    deduper.remember("event-1");
    deduper.remember("event-2");
    deduper.remember("event-1");
    deduper.remember("event-3");

    expect(deduper.values()).toEqual(["event-2", "event-3"]);
    expect(deduper.has("event-1")).toBe(false);
    expect(deduper.has("event-3")).toBe(true);
  });

  it("reports the evicted id so external version maps can stay bounded", () => {
    const deduper = new BoundedEventDeduper(2);
    expect(deduper.remember("a")).toBeNull();
    expect(deduper.remember("b")).toBeNull();
    expect(deduper.remember("c")).toBe("a");
    expect(deduper.values()).toEqual(["b", "c"]);
  });
});
