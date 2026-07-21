# State Machines

Status: V1 design baseline, not implemented  
Last updated: 2026-07-20

## Shared transition rules

- Transitions occur only through named application commands.
- Every command authenticates actor, authorizes permission/scope, validates expected entity version and records correlation ID.
- Invalid transitions fail without changing state.
- Sensitive transitions require reason and audit.
- Entity update, history, audit and outbox event commit in one transaction.
- UI labels are localized projections of stable machine states.

## 1. Dining Session

States:

```text
OPEN
PAYMENT_REQUESTED
PAYMENT_PENDING
PAID
CLOSED
CANCELLED
```

| From | To | Command | Allowed actor | Conditions |
|---|---|---|---|---|
| none | OPEN | `OpenDiningSession` | Waiter, Manager, Owner | Table active; no active Session; guest count valid; create Join Code |
| OPEN | PAYMENT_REQUESTED | `RequestBill` | Customer grant, Waiter, Cashier, Manager | At least one submitted/non-cancelled order; no open mutation conflict |
| PAYMENT_REQUESTED | OPEN | `ResumeOrdering` | Waiter, Manager | No confirmed payment; reason; customer grants may be restored/rotated |
| PAYMENT_REQUESTED | PAYMENT_PENDING | `BeginCheckout` | Cashier, Manager | Pricing snapshot current; expected version |
| PAYMENT_PENDING | PAYMENT_REQUESTED | `ReleaseCheckout` | Cashier, Manager | No payment attempt in progress; reason |
| PAYMENT_PENDING | PAID | `ConfirmFinalPayment` | Cashier, Manager | Confirmed allocations equal balance; receipt boundary succeeds |
| PAID | CLOSED | `CloseDiningSession` | Cashier, Manager | Receipt exists; revoke grants; close metadata |
| OPEN | CANCELLED | `CancelDiningSession` | Manager, Owner | No fulfilled items/payment; mandatory reason |
| PAYMENT_REQUESTED | CANCELLED | `CancelDiningSession` | Manager, Owner | No confirmed payment; mandatory reason |

V1 has no transition out of `CLOSED` or `CANCELLED`; Reopen is Deferred. `PAID` is a recovery-visible intermediate so a close failure can be retried without taking payment again.

## 2. Order aggregate

Persistent order begins at `SUBMITTED`; cart/draft remains client/application draft.

```text
SUBMITTED → ACCEPTED → PREPARING → READY → SERVED → COMPLETED
SUBMITTED → REJECTED
SUBMITTED / ACCEPTED / PREPARING → CANCELLED (permission varies)
```

Order state is primarily derived from item states:

- `SUBMITTED`: all active items submitted.
- `ACCEPTED`: accepted but none preparing/ready/served.
- `PREPARING`: any active item preparing or mixed accepted/preparing.
- `READY`: all active items ready or later, none still accepted/preparing.
- `SERVED`: all active items served; completion command/audit may finalize.
- `COMPLETED`: terminal operational completion.
- `REJECTED`: every item rejected before acceptance.
- `CANCELLED`: every item cancelled or order cancelled under policy.

Mixed terminal/non-terminal states use the least-complete operational state and item counts; UI must not hide partial state.

## 3. Order Item

| From | To | Actor | Conditions |
|---|---|---|---|
| none | SUBMITTED | Customer/Waiter command | Server-valid session/menu/price/modifiers; snapshot written |
| SUBMITTED | ACCEPTED | Kitchen, Manager | Correct branch/station; version match |
| SUBMITTED | REJECTED | Kitchen, Manager | Mandatory reason; not started |
| SUBMITTED | CANCELLED | Waiter, Manager | Mandatory reason; authorization policy |
| ACCEPTED | PREPARING | Kitchen, Manager | Correct station; version match |
| ACCEPTED | CANCELLED | Manager or authorized Kitchen reject policy | Reason; no preparation started |
| PREPARING | READY | Kitchen, Manager | Correct station; completion confirmation |
| PREPARING | CANCELLED | Manager only | High-risk reason/audit; financial treatment before payment |
| READY | SERVED | Waiter, Manager | Correct branch; supports partial serving |
| SERVED | COMPLETED | System/Waiter completion command | Operational confirmation |

`REJECTED`, `CANCELLED`, `COMPLETED` are terminal in V1. Recall Recently Completed is a UI history action, not a state reversal.

## 4. Payment attempt and balance

Payment attempt:

```text
PENDING → CONFIRMED
PENDING → FAILED
```

| Transition | Actor | Conditions |
|---|---|---|
| none → PENDING | Cashier/Manager | Active checkout; amount >0 and ≤ outstanding; method valid; idempotency/version |
| PENDING → CONFIRMED | Cashier/Manager | Cash counted or external terminal/QR observed; reference/notes as policy requires |
| PENDING → FAILED | Cashier/Manager | Explicit failure/cancel before confirmation; safe reason |

Confirmed payments are immutable. V1 does not implement CONFIRMED → VOIDED/REFUNDED; future reversal creates separate records.

Session payment aggregate is derived:

- `UNPAID`: confirmed allocations = 0.
- `PARTIALLY_PAID`: confirmed allocations >0 and < amount due.
- `PAID`: confirmed allocations = amount due.

Over-allocation is prohibited. Cash received may exceed payment amount only by recorded change.

## 5. Service Request

```text
OPEN → CLAIMED → RESOLVED
OPEN / CLAIMED → CANCELLED
```

- Customer creates `OPEN` with dedupe window per type/session.
- Waiter/Manager claims; concurrent claim uses version check.
- Assigned/authorized staff resolves with optional note.
- Session close cancels unresolved requests with system reason.

## 6. Table operational status

Table status is a read model, not an independently editable state:

- `DISABLED`: table inactive.
- `AVAILABLE`: active, no active Session.
- `OCCUPIED`: open Session, no orders yet.
- `ORDERING`: submitted/accepted activity.
- `FOOD_PREPARING`: any item preparing.
- `FOOD_READY`: ready item awaiting service.
- `PAYMENT_REQUESTED`: Session requests bill.
- `PAYMENT_PENDING`: checkout/payment incomplete.
- `CLEANING`: closed Session with explicit cleanup task if V1 implements that projection.

If `CLEANING` is needed as a durable operational step, M3 must decide whether it belongs to a separate table-turn task rather than Dining Session state.

## 7. Menu availability

V1 item availability combines:

- Active/visible administrative state.
- Branch ownership.
- Sold-out override.
- Scheduled business-hours rule if implemented as In Scope availability.
- Variant/modifier active state.

Checkout always re-evaluates current availability. UI cache never creates an entitlement to an old price or unavailable item.

## 8. Transition test generation

For each machine, generate:

- Every allowed transition for each allowed role.
- Every disallowed transition from every state.
- Wrong tenant/branch and suspended actor.
- Version conflict.
- Missing reason/authorizer.
- Duplicate command.
- Transaction rollback between entity/history/audit/outbox.
- Concurrency on accept, serve, pay and close.

Property: no sequence can produce negative balance, more confirmed allocation than amount due, two active Sessions for one table, or customer writes after close.
