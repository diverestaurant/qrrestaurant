import type { RealtimeEvent, ReconcileDecision } from "@/modules/realtime/contracts/events";

const MAX_TRACKED_EVENT_IDS = 256;

type ReconcileInput = {
  event: RealtimeEvent;
  scope: { restaurantId: string; branchId: string };
  localEntityVersion: number;
  seenEventIds: ReadonlySet<string>;
  supportedSchemaVersion?: number;
};

function isValidEvent(event: RealtimeEvent) {
  return Boolean(
    event.eventId &&
      event.eventType &&
      Number.isInteger(event.schemaVersion) &&
      event.restaurantId &&
      event.branchId &&
      event.entityType &&
      event.entityId &&
      Number.isInteger(event.entityVersion) &&
      event.entityVersion > 0 &&
      event.correlationId,
  );
}

export function reconcileEvent({ event, scope, localEntityVersion, seenEventIds, supportedSchemaVersion = 1 }: ReconcileInput): ReconcileDecision {
  if (!isValidEvent(event)) return { kind: "reject", reason: "invalid_event" };
  if (event.schemaVersion !== supportedSchemaVersion) return { kind: "reject", reason: "unsupported_schema" };
  if (event.restaurantId !== scope.restaurantId || event.branchId !== scope.branchId) return { kind: "reject", reason: "wrong_scope" };
  if (seenEventIds.has(event.eventId)) return { kind: "ignore", reason: "duplicate_event" };
  if (event.entityVersion <= localEntityVersion) return { kind: "ignore", reason: "older_or_equal_version" };
  if (event.entityVersion > localEntityVersion + 1) return { kind: "resync", reason: "version_gap" };
  return { kind: "apply", reason: "next_version" };
}

export class BoundedEventDeduper {
  private readonly eventIds: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize = MAX_TRACKED_EVENT_IDS) {
    if (!Number.isInteger(maxSize) || maxSize < 1) throw new RangeError("The event deduper size must be a positive integer.");
    this.maxSize = maxSize;
  }

  has(eventId: string) {
    return this.eventIds.includes(eventId);
  }

  remember(eventId: string) {
    if (this.has(eventId)) return null;
    this.eventIds.push(eventId);
    return this.eventIds.length > this.maxSize ? this.eventIds.shift() ?? null : null;
  }

  values() {
    return [...this.eventIds];
  }
}
