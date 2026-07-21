export type RealtimeEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  restaurantId: string;
  branchId: string;
  entityType: string;
  entityId: string;
  entityVersion: number;
  correlationId: string;
};

export type ReconcileDecision =
  | { kind: "apply"; reason: "next_version" }
  | { kind: "ignore"; reason: "duplicate_event" | "older_or_equal_version" }
  | { kind: "resync"; reason: "version_gap" }
  | { kind: "reject"; reason: "wrong_scope" | "unsupported_schema" | "invalid_event" };
