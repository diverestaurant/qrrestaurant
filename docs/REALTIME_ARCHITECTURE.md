# Realtime, Consistency and Recovery Architecture

Status: Local adapters implemented and tested locally; hosted/pilot delivery remains open  
Last updated: 2026-07-21

## 1. Invariant

Realtime does not create or confirm business state. A successful database transaction is the only confirmation for order, kitchen, service, payment or session changes.

## 2. Event envelope

Every realtime/outbox event has:

- `eventId`: globally unique.
- `eventType`: stable domain event key.
- `schemaVersion`.
- `occurredAt`: server timestamp.
- `restaurantId` and `branchId` scope, omitted from public payload only if channel binding supplies it safely.
- `entityType`, `entityId`, `entityVersion`.
- `correlationId` and optional causation ID.
- minimal payload or invalidation hint.

Sensitive row snapshots are not broadcast when an invalidation event plus authorized query is sufficient.

## 3. Event production

Business transaction atomically writes:

1. Entity state.
2. State history/audit.
3. `outbox_events` record.

A publisher or database-supported broadcast path sends only committed events. If direct Postgres Changes is used for V1, clients still treat it as an invalidation hint and authoritative resync remains mandatory. M2/M6 choose the simplest verified delivery mechanism and document its guarantees.

## 4. Channel authorization

- Channels are scoped by Restaurant/Branch and role task.
- Customer subscribes only to its live Session grant, never a table token or Restaurant-wide channel.
- Kitchen subscribes to authorized Branch/stations.
- Waiter/Cashier subscribe to authorized Branch operational events.
- Platform channels do not leak tenant payloads to ordinary staff.
- Subscription authorization is rechecked on reconnect and permission/grant revocation.

## 5. Client algorithm

1. Load authoritative snapshot with `snapshotVersion`/cursor and server time.
2. Subscribe to authorized channel.
3. For each event:
   - discard already seen `eventId`;
   - reject wrong scope/schema;
   - if entity version = local + 1, apply safe projection or refetch entity;
   - if version ≤ local, ignore duplicate/out-of-order event;
   - if version > local + 1 or unknown schema, mark stale and resync.
4. Persist only a bounded non-sensitive cursor if needed.
5. On disconnect, show visible stale/reconnecting state and begin bounded polling.
6. On reconnect, resync before showing fresh.

## 6. Polling fallback

- Immediate retry with jitter, then exponential backoff to a capped interval.
- KDS active queue target fallback: 3–10 seconds depending on load and provider limits.
- Waiter/Cashier: 5–15 seconds while disconnected.
- Customer tracking: 5–15 seconds while visible; slow/stop in background.
- Reset backoff after confirmed healthy subscription/resync.
- Respect browser visibility, battery and provider rate limits.

Final intervals require load testing and Supabase plan limits.

## 7. Command UI states

- `PENDING`: command sent, no confirmed response.
- `CONFIRMED`: server returned committed result.
- `FAILED`: server rejected or network failure without confirmation.
- `UNKNOWN_OUTCOME`: connection lost after send; retry with same idempotency key/status query.
- `CONFLICT`: expected version failed; refresh and show current state.
- `STALE`: realtime/polling snapshot age exceeded threshold.

Never transform `PENDING` to success from a realtime event alone without matching authoritative result/correlation and query verification.

## 8. Recovery scenarios

| Failure | Required behavior |
|---|---|
| Duplicate event | Deduplicate by event ID/entity version |
| Out-of-order event | Ignore older; gap triggers resync |
| Missed events | Snapshot/cursor resync |
| Realtime unavailable | Visible stale state plus polling |
| Database temporary failure | Command fails/retries safely with same key; no fake success |
| Two KDS accept same item | Version check; loser refreshes with actor/time feedback |
| Payment response lost | Query idempotency/payment status before retry |
| Payment confirmed, close failed | Session remains PAID; close retry does not take payment |
| Join grant revoked | Customer subscription/query denied; clear current-session UI |
| Audio blocked | Persistent visible warning and manual enable control |

## 9. Observability

Measure:

- commit-to-publish and publish-to-client latency.
- resync duration and failures.
- disconnect/reconnect rate by device/app shell.
- duplicate/out-of-order/gap events.
- polling fallback duration/load.
- stale KDS count and last-seen timestamps.

Order-to-KDS p95 ≤3 seconds is measured from committed order timestamp to authoritative visible KDS projection under recorded network/load.

## 10. Tests

- Duplicate, delayed, reordered and dropped event simulator.
- Reconnect with permission/grant revoked.
- Multi-device concurrent state commands.
- Polling provider failure and recovery.
- Unknown event schema forward compatibility.
- Browser background/foreground resync.
- Load test at 1× and 2× proposed Pilot burst.

Local Supabase Realtime adapters now exist for the customer Session and staff Branch surfaces. They subscribe only to the relevant tenant/session or branch filters, validate payload scope and schema, treat row changes as invalidation hints, and call authoritative server-backed refresh functions. The local adapter tests and Playwright flows cover connection, notification-driven resync, reconnect/offline state and bounded polling fallback. Hosted provider behavior, production plan limits and pilot latency remain unevidenced by design.

## 11. Current local implementation boundary

The role shell now exposes a client recovery indicator that:

- probes the local `/api/health` endpoint without caching;
- shows `reconnecting`, `stale`, or `offline` when the browser cannot confirm the app;
- reacts to browser `online`/`offline` and foreground visibility changes;
- performs a bounded 15-second health poll while the page is visible; and
- offers a full authoritative page refresh when the current view is not confirmed.

This is an application-reachability and recovery boundary, not a business-data snapshot. It does not claim that a Realtime event confirmed an order, payment, KDS transition, service request, or Session change. Authorized Supabase Realtime channels, event envelopes, cursors, version-gap resync and role-specific data queries remain open work.

The local domain layer provides the event decision contract used by both adapters: wrong-scope/unsupported-schema/malformed events are rejected, duplicates and older versions are ignored, the next version is eligible for projection, and a version gap requires an authoritative resync. A bounded event-ID deduper prevents unbounded client memory. The adapters deliberately do not mutate business state directly from a Realtime payload.
