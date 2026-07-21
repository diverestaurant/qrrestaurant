# ADR-006 — V1 Whole-Session Manual Multi-Tender Boundary

Status: Accepted for planning  
Date: 2026-07-20

## Decision

V1 bills the entire Dining Session and allows multiple manual tender payments against its outstanding balance. Split by person/item, online payment, refund, void and reopen are Deferred.

## Context

Basic cashier operations need cash/card/DuitNow/e-wallet recording and sometimes multiple tenders. Full split/refund/reopen greatly expands allocation, correction, permissions, audit and UX complexity.

## Options considered

1. One tender only.
2. Whole-session multi-tender.
3. Full split bill/tender/refund/reopen.
4. External POS handles all payment.

## Chosen approach

Option 2.

## Reason

It supports common payment combinations while preserving a clear receivable and safe V1 boundary.

## Tradeoffs

- Cannot divide items/persons in system.
- Paid corrections require documented external SOP until future workflow.
- Cashier UI must clearly explain outstanding and boundary.

## Consequences and required tests

- Allocation cannot exceed outstanding.
- Confirmed payment immutable; cash change separate.
- Duplicate/unknown/failure and final-pay-close recovery.
- Deferred controls must not appear as functional UI.

## Revisit triggers

Pilot proves split/refund/reopen is operationally mandatory and owner approves expanded scope/state/audit/migration.
