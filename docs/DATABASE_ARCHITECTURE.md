# Database Architecture

Status: Logical design only; no schema or migration exists  
Last updated: 2026-07-20

## 1. Principles

- PostgreSQL is the business source of truth.
- Tenant isolation uses keys, composite constraints, grants and RLS—not UI filters.
- Monetary values are signed 64-bit integer minor units plus ISO currency.
- Historical commercial records are immutable snapshots.
- Commands are idempotent and important state changes are versioned/audited.
- Realtime derives from committed facts and can be replayed/resynced.
- Exposed objects are explicitly inventoried; new Supabase tables are not assumed to be Data API accessible.

## 2. Schema layout

Proposed:

- `public`: deliberately exposed tables/views/RPC surface with RLS and explicit grants.
- `app_private`: internal helpers, pricing rule internals, idempotency response data and operational tables not directly exposed.
- `audit_private`: append-only audit internals if separation improves grants.

Final names are chosen in M2. Private schemas are not added to Data API exposed schemas without a security ADR.

## 3. Identifier and tenancy model

- UUID primary keys generated server/database-side.
- `restaurants.id` is the tenant root.
- `branches` contains `restaurant_id` and unique `(restaurant_id, id)`.
- Every branch-owned entity stores `restaurant_id` and `branch_id`.
- Composite foreign keys reference `(restaurant_id, branch_id, entity_id)` where cross-tenant mix-up is possible.
- Human slugs/codes are unique within explicit scope and never replace internal primary keys.
- Public QR tokens are high entropy, hashed at rest where lookup design permits, versioned and rotatable.
- Session Join Codes are stored as slow/appropriate hashes with expiry, attempt counters and rotation metadata, never plaintext after issuance.

## 4. Entity catalog

### Platform and tenancy

| Table | Core data and invariants |
|---|---|
| `restaurants` | slug, name, status, default currency/timezone; status controls tenant access |
| `branches` | restaurant, slug, name, timezone, currency, business-day cutoff, status |
| `restaurant_settings` | versioned validated tenant settings and branding refs |
| `branch_settings` | effective-dated charge/tax/rounding/receipt/operations settings |
| `subscriptions` | plan/status/effective dates; no automated billing in V1 |
| `feature_flags` | platform/restaurant/branch scope, effective value and audit metadata |

### Identity and authorization

| Table | Core data and invariants |
|---|---|
| `profiles` | Auth user reference and minimal display data; no authorization in user-editable metadata |
| `roles` | system/custom role within scope; immutable key and display name |
| `permissions` | stable permission keys |
| `role_permissions` | role/permission mapping with tenant constraints |
| `staff_memberships` | auth user, restaurant, optional branch, role, active/suspended, version, dates |

### Tables and sessions

| Table | Core data and invariants |
|---|---|
| `tables` | branch, label, area, capacity, active, version |
| `table_qr_tokens` | table, token hash/version, active, issued/revoked dates; one current active token policy |
| `dining_sessions` | table, guest count, state, business date, opened/closed actor/time, totals snapshot, payment aggregate, version |
| `session_join_codes` | session, code hash, expiry, rotation, attempts, revoked time |
| `customer_session_grants` | anonymous auth UID, session/table/tenant scope, expiry, capability version, revoked time |

Database uniqueness/locking must prevent more than one active Session per table. Active means `OPEN`, `PAYMENT_REQUESTED`, `PAYMENT_PENDING` or `PAID` awaiting closure.

### Menu

| Table | Core data and invariants |
|---|---|
| `menu_categories` | branch/restaurant scope, localized content, sort, visibility, version |
| `menu_items` | category, localized content, base price, currency, status, tax/service eligibility, station, version |
| `menu_item_variants` | item, name, price delta or absolute price policy, sort, active |
| `modifier_groups` | name, required, min/max, selection policy |
| `modifier_options` | group, name, price delta, active, sort |
| `menu_item_modifier_groups` | item/group relation and item-specific ordering/overrides |
| `kitchen_stations` | branch, key, name, active, sort |
| `kitchen_station_items` | explicit routing override if item primary station is insufficient |

No menu update mutates an order snapshot.

### Ordering and service

| Table | Core data and invariants |
|---|---|
| `orders` | session, sequence/display number, actor type/id, submitted time, state, money snapshot totals, version, idempotency ref |
| `order_items` | menu refs plus name/description/variant/price/tax/station snapshots, quantity, note, state, version |
| `order_item_modifiers` | immutable option name/price/quantity snapshots |
| `order_status_history` | entity level, from/to, actor, reason, correlation, version, time |
| `service_requests` | session/table, type, priority, state, claimed/resolved actor/time, dedupe key, version |

### Pricing, payments and receipts

| Table | Core data and invariants |
|---|---|
| `discounts` | rule/type/value/cap/scope/effective dates/authorization requirements/version |
| `session_adjustments` | applied discount/charge snapshot, reason, authorizer and allocation |
| `payments` | immutable attempt, method, currency, amount, status, cash/change, ref, actor, idempotency, time |
| `payment_allocations` | payment to session balance allocation; sum cannot exceed confirmed payment/receivable |
| `receipts` | immutable branch receipt number, session/payment snapshots, totals/rules, issued/reprint metadata |
| `reconciliation_entries` | business-date payment summary/exception reference; V1 may derive plus persist acknowledgement |

Future refund/void uses separate reversal records, not updates to confirmed payment amounts.

### Reliability and audit

| Table | Core data and invariants |
|---|---|
| `idempotency_keys` | tenant, command scope, actor fingerprint, key, request hash, status/result ref, expiry |
| `outbox_events` | event id/type/version, tenant, entity/version, payload or projection ref, occurred/published times |
| `audit_logs` | append-only actor/scope/action/entity, masked before/after, reason, correlation, minimal network metadata, time |
| `notifications` | delivery intent/status for provider-neutral notification adapter; only if an In Scope use case needs persistence |

## 5. Money and pricing storage

- `currency_code char(3)` or validated equivalent on rule and commercial snapshots.
- `*_minor bigint` for all amounts.
- Percentages use integer basis points or explicit rational/decimal configuration; never binary float.
- Quantity uses bounded integer for V1 menu items.
- Store rule version/effective time and calculated component allocations.
- Session totals are a committed projection with version; canonical audit can be reconstructed from snapshots and adjustments.
- Receipt stores final immutable display/financial snapshot.

## 6. State and transitions

- Bounded states use Postgres enum or strict CHECK selected in M2; application contracts expose versioned string unions.
- Status cannot be updated through generic CRUD endpoints.
- State transitions use application command plus database constraint/function boundary.
- All sensitive transitions require expected `version`.
- History insert and entity update occur in the same transaction.

## 7. Idempotency design

Unique scope recommendation:

```text
(restaurant_id, branch_id, command_type, actor_fingerprint, idempotency_key)
```

Store normalized request hash. On collision:

- Same hash + completed: return stored result reference.
- Same hash + in progress: return retryable in-progress status.
- Different hash: reject misuse/conflict.

Payment idempotency retention exceeds ordinary command retention and follows finance policy.

## 8. RLS helper model

Conceptual helpers:

- current identity type: anonymous vs permanent staff.
- active platform administrator.
- active membership for Restaurant/Branch.
- permission within Branch.
- live customer grant for Session.
- active tenant/branch/session state.

Helpers must not trust `user_metadata`. Prefer private, stable SQL functions and indexed membership/grant predicates. Any helper bypassing RLS is narrowly reviewed and never directly callable by PUBLIC.

## 9. Exposure inventory

M2 must create a table-by-table matrix:

| Object | anon role | authenticated anonymous | authenticated staff | service/admin | RLS | API exposed |
|---|---|---|---|---|---|---|

Default is no grant/no exposure. Grant only required verbs. Customer direct reads use safe views/query RPCs where table shape would overexpose internal fields.

## 10. Index strategy

At minimum evaluate:

- All foreign keys and composite tenant keys.
- Active membership by auth UID and tenant/branch.
- Live customer grant by auth UID/session/expiry/revoked.
- QR token hash and active flag.
- Active Session by table.
- KDS queue by branch/station/item state/submitted time.
- Waiter requests by branch/state/priority/time.
- Cashier sessions by branch/payment state/requested time.
- Reports by branch/business_date/time/status/payment method.
- Idempotency unique lookup and expiry cleanup.
- Outbox unpublished sequence/time.
- Audit by tenant/time/entity/action.

Use `EXPLAIN (ANALYZE, BUFFERS)` on production-shaped Staging data before performance acceptance.

## 11. Views and reports

- Exposed views use `security_invoker = true` and preserve caller RLS.
- Complex report functions accept authorized tenant filters and enforce scope internally.
- Business date is stored on Session/financial facts based on Branch timezone/cutoff at event time.
- Historical reports do not reinterpret old facts after timezone/rule changes.

## 12. Storage

- Menu image path includes Restaurant/Branch scope and opaque object ID.
- Storage policies validate authenticated staff membership/permission for write and public-safe asset read strategy.
- Upload validates content type by content, extension, size, dimensions and processing result.
- Do not allow SVG or active content unless sanitized and explicitly approved.
- Database backup does not cover Storage; recovery plan exports/verifies both.

## 13. Retention and cleanup

Requires owner/legal confirmation. Initial technical proposal:

- Anonymous Auth users/grants: revoke immediately at close; delete expired grants after audit-safe window; scheduled cleanup for orphan anonymous users.
- Idempotency: ordinary commands 7–30 days; payment keys per finance retention policy.
- Operational events/outbox: retain until safely processed plus troubleshooting window.
- Audit/financial records: policy/legal duration with pseudonymization where appropriate.
- Uploads: delete orphan/unpublished assets after bounded grace period.

## 14. Migration approach

- Use Supabase CLI discovered via `--help` at BUILD time.
- Generate migration names through the CLI, not invented timestamps.
- Iterate locally, run advisors, then generate/review clean migration history.
- Test from empty database and production-shaped snapshot.
- Expand/migrate/contract; avoid destructive same-release changes.
- Record data checks, lock risk, roll-forward and recovery.

## 15. Verification required before M2 completion

- Schema/constraint tests.
- Explicit grant/exposure audit.
- RLS role × tenant × operation matrix.
- Function privilege/search-path review.
- View security-invoker review.
- Storage policy/upload tests.
- Cross-tenant composite FK negative tests.
- Pricing/idempotency/concurrency DB integration tests.
- Database advisors with no unresolved security findings.

No item in this document is implemented yet.
