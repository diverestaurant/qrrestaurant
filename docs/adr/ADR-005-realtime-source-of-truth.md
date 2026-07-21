# ADR-005 — Database Truth with Versioned Realtime and Resync

Status: Accepted for planning  
Date: 2026-07-20

## Decision

Database transactions are authoritative. Realtime carries versioned scoped invalidation/domain events; clients deduplicate and resync through authorized queries. Polling is the fallback.

## Context

Restaurant devices experience network loss and Realtime can duplicate, delay, reorder or omit events. Treating a websocket event as business truth could show false order/payment success.

## Options considered

1. Realtime payload directly mutates client truth with no resync.
2. Polling only.
3. Realtime plus authoritative snapshots/version/cursor/polling fallback.
4. Dedicated external event-stream platform in V1.

## Chosen approach

Option 3, with outbox or verified committed-change delivery selected in M2/M6.

## Reason

It provides responsive operations and robust recovery without premature streaming infrastructure.

## Tradeoffs

- Additional cursor/version/stale UI complexity.
- Polling load must be tested.
- Event publication mechanism needs Staging verification.

## Consequences and required tests

- Event ID/schema/scope/entity version/correlation.
- Visible offline/reconnecting/stale/last sync.
- Duplicate/out-of-order/gap/reconnect/revoke tests.
- Measure commit-to-KDS p95.

## Revisit triggers

Verified Supabase delivery cannot meet latency/reliability/cost or multi-region scale requires dedicated streaming.
