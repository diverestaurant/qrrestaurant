# ADR-004 — Server Pricing and Immutable Financial Records

Status: Accepted for planning  
Date: 2026-07-20

## Decision

Use integer minor-unit money, one versioned server Pricing Engine, immutable order/payment/receipt snapshots and append-only corrections.

## Context

Client prices are manipulable. Menu/tax settings change over time. Payment confirmation and Session closing can partially fail. Floating-point and mutable paid flags would cause incorrect bills and unreconciled records.

## Options considered

1. Client total accepted by server.
2. Decimal/float recalculation across UI/backend.
3. Integer minor units with deterministic server rules/snapshots.
4. External POS as immediate source of truth.

## Chosen approach

Option 3.

## Reason

It is deterministic, testable and preserves historical truth without an external V1 dependency.

## Tradeoffs

- Pricing/allocation rules require careful property tests.
- Business owners must confirm SST/service/rounding/receipt policy.
- Corrections require explicit reversal workflows rather than edits.

## Consequences and required tests

- Fixed calculation order and rule versions/effective dates.
- Payment/receipt records immutable.
- PAID intermediate supports close retry without repaying.
- Idempotency, locking/version and injected-failure tests.
- Legal/financial configuration blocks Production until confirmed.

## Revisit triggers

Multi-currency, online payment, E-Invoice, full POS/accounting or approved refund/void requirements enter scope.
