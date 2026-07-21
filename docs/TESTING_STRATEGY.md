# Testing Strategy

Status: Local Vitest/pgTAP/Playwright harness implemented; full quality matrix remains open  
Last updated: 2026-07-21

## 1. Principles

- Test domain invariants below the UI.
- Test authorization at application and database boundaries.
- Use real PostgreSQL/Supabase locally for integration/RLS; mocks do not prove RLS.
- Test failure, duplicate, concurrency and recovery paths as first-class behavior.
- Every P0/P1 fix adds regression coverage.
- Evidence identifies command, commit, environment, versions and result.

## 2. Proposed tooling

- Vitest for domain/application/unit/property tests.
- A property-based library selected and pinned in BUILD for pricing/state invariants.
- pgTAP or SQL integration tests plus application-driven Supabase tests for RLS/constraints/functions.
- Playwright for role E2E, visual snapshots and accessibility integration.
- axe integration plus manual keyboard/screen-reader review.
- A controlled load tool selected in BUILD (for example k6) with non-production targets only.

Tool choice is not implementation authorization.

## 3. Test layers

### Static quality

- Format check.
- ESLint and custom import-boundary rules.
- TypeScript strict/noEmit.
- Environment schema/type generation drift.
- Dependency/secret/license/security scan.

### Domain unit/property

- Integer money and currency mismatch.
- Variant/modifier pricing.
- Order/session discount order and caps.
- Service charge/tax inclusive/exclusive and eligibility.
- Rounding boundaries and allocation sum preservation.
- Order Item, Session and Payment transition matrices.
- Permission decision pure policies.
- Business date/timezone/cross-midnight.

Properties:

- Grand total never differs from components.
- Allocations sum exactly to adjusted amounts.
- Balance never negative.
- Confirmed payments never exceed amount due.
- State machines never reach disallowed states.
- Same normalized input/rule version produces same result.

### Application/contract

- Zod request/response fixtures.
- Idempotency same key/same hash and different-hash conflict.
- Actor/tenant resolution ignores untrusted body values.
- Use-case authorization and expected version.
- Error codes and safe messages.
- Audit/outbox intent included in transaction.
- UI contract backward/forward behavior for optional fields/unknown states.

### Database/integration

- Schema constraints/composite tenant foreign keys.
- Only one active Session per table under concurrency.
- Transaction rollback for entity/history/audit/outbox.
- Idempotency unique constraint racing inserts.
- Payment allocation and close transaction/recovery.
- Receipt sequence uniqueness/snapshot immutability.
- Query plans/indexes on production-shaped fixtures.

### RLS/security matrix

For each entity/operation, test:

- Platform Admin allowed/denied scope.
- Owner own vs other Restaurant.
- Manager/Kitchen/Waiter/Cashier own vs other Branch.
- Permanent staff vs anonymous user.
- Customer with valid/expired/revoked/wrong Session grant.
- Suspended user/tenant.
- Unauthenticated publishable/anon role.
- Direct Data API call, not only app endpoint.
- INSERT/UPDATE `WITH CHECK`, DELETE, view and RPC privileges.
- Function `EXECUTE`, search path and exposed schema inventory.
- Storage read/write/upsert/delete policy.

### E2E Golden Path

1. Platform creates Restaurant.
2. Owner creates Branch/settings/stations/menu/table/staff.
3. QR generated; Waiter opens Session.
4. Customer resolves table, joins and orders.
5. KDS receives, prepares and marks ready.
6. Waiter serves; customer adds order/service request.
7. Customer requests bill.
8. Cashier applies authorized discount, records multi-tender payment, receipt and close.
9. New Session cannot see old orders.
10. Report/reconciliation includes correct business date and amounts.

### Required exception E2E/integration

- Duplicate submission and same-key/different-body.
- Invalid/revoked/cross-tenant QR and Join Code abuse.
- Closed Session write/read attempt.
- Sold-out/price/modifier change at submission.
- Realtime disconnect, duplicate/out-of-order/gap and resync.
- Unauthorized role/direct route/RLS attempt.
- Concurrent KDS/Waiter actions.
- Payment failed/unknown/duplicate/final-pay-close-failure.
- Preparing cancellation reason/permission.
- Table reuse and old capability.

### UI, visual and accessibility

- Critical screen/states at responsive matrix sizes.
- English and pseudo-long locale; Chinese/BM after approved copy.
- Dark/light only if product supports both; do not create an unneeded theme matrix.
- Keyboard, focus, screen reader, zoom/reflow, reduced motion.
- No color-only status and minimum touch target checks.
- Screenshot baselines use deterministic data/time and mask nondeterministic IDs.

### Performance/load/recovery

- Web Vitals on production build and target phone/network.
- Order commit latency and order-to-KDS p95.
- Proposed 30-table burst plus 2× safety scenario until Pilot model replaces it.
- Multiple KDS/waiter/cashier devices and reconnect storm.
- Soak across an equivalent service duration.
- Temporary DB/Realtime/provider failure.
- Backup restore and migration rehearsal.

## 4. Test data

- Synthetic Restaurant A/B, multiple Branches and role accounts.
- Overlapping human labels deliberately test IDOR/BOLA.
- Menu fixtures cover zero/large prices, all Modifier min/max and tax/charge combinations.
- Time fixtures cover DST-safe architecture even though Asia/Kuching has no DST, cross-midnight and cutoff boundaries.
- No real customer/payment secrets outside specifically authorized controlled Pilot.

## 5. CI gates

### Pull/change gate

- format, lint, typecheck, unit/property, contract, fast DB/RLS subset, build.

### Main/Staging candidate

- full integration/RLS/security, critical E2E, visual/accessibility automation, migration-from-empty.

### Finish Line A candidate

- full Golden/exception E2E, concurrency/realtime, performance/load, restore rehearsal, manual accessibility/device review and independent UI review.

### RELEASE

- artifact/migration/version verification and production-safe smoke only after authorization.

## 6. Flake policy

- A failing test is not rerun until green and ignored.
- Record root cause: product defect, test defect, environment instability or known external issue.
- Quarantine only non-critical tests with owner/expiry and equivalent coverage; no security/money/tenant/Golden Path quarantine.
- Deterministic clocks/IDs/data and explicit realtime waits reduce flake.

## 7. Evidence format

`TEST_REPORT.md` records:

- build/commit/migration.
- environment and data fixture.
- command/tool version.
- pass/fail/skip counts.
- failures and issue links.
- artifacts (trace, screenshot, report, query plan).
- limitations and next action.

Current local evidence is recorded in `TEST_REPORT.md`: 15 unit test files / 43 tests, 17 pgTAP files / 179 assertions, and 58 passed / 16 expected skipped Playwright checks. Local scoped Realtime notification/resync and fallback, synthetic Storage object backup/restore and a 30-request menu read burst are tested. Full visual, manual accessibility/device, representative device/load, provider backup and hosted restore gates remain open.
