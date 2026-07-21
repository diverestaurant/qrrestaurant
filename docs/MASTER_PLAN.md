# Dive Restaurant QR Ordering System — Master Plan

Document status: Designed; local `BUILD` execution in progress  
Implementation status: Partial local implementation; M0–M2 foundation and documented M3–M10 slices have local source/test evidence  
Target Finish Line: A — Production Ready Candidate, after separately authorized BUILD and STAGING_VERIFY  
Last updated: 2026-07-21

## 1. Product vision

Deliver a reliable QR ordering, kitchen, waiter, cashier, and administration system that Dive Restaurant can operate during a real service and that can later onboard other restaurants without rewriting tenant, authorization, pricing, order, or payment foundations.

The product succeeds only when a complete table lifecycle is safe and recoverable: setup → QR → session → orders/add-ons → kitchen → service → bill → payment → receipt → close → report.

## 2. Business model

V1 is a hosted Multi-Tenant SaaS foundation with manual commercial operations:

- Restaurant subscription status and feature entitlement are modeled.
- Platform Admin can create, suspend, and restore a tenant.
- Automated billing, metering, dunning, plan changes, and self-service checkout are Deferred.
- Product packaging can later price by Restaurant, Branch, table count, feature tier, or order volume without coupling core restaurant records to a specific billing vendor.

## 3. V1 outcome and non-goals

Authoritative scope: [`V1_SCOPE_MATRIX.md`](V1_SCOPE_MATRIX.md).

V1 includes QR Ordering, KDS, Waiter, Basic Cashier, Admin, Reports, tenant isolation, audit, reliability, and operational recovery. It excludes online payment, refunds, table merge/split, full POS/accounting, inventory, reservation, delivery, loyalty, supplier, E-Invoice, and hardware printer protocols unless a later approved scope change moves them in.

## 4. Users and roles

- Platform Admin: tenant lifecycle, feature flags, platform audit and health.
- Restaurant Owner: restaurant/branch/menu/staff/settings/reports.
- Branch Manager: branch operations, tables, menu availability, staff scope and exceptions.
- Kitchen Staff: station-scoped item fulfillment.
- Waiter: sessions, customer assistance, service requests and serving.
- Cashier: bills, authorized discounts, payments, receipts and session close.
- Customer: anonymous menu, current-session ordering, tracking and requests.

Detailed authorization: [`PERMISSION_MATRIX.md`](PERMISSION_MATRIX.md).

## 5. Golden Path

1. Platform Admin creates an active Restaurant.
2. Owner creates Branch with timezone, currency and test pricing rules.
3. Owner/Manager configures roles, stations, menu and tables.
4. Manager generates a high-entropy revocable Table Entry QR.
5. Waiter opens a Dining Session and receives a rotating Session Join Code.
6. Customer scans QR, sees public menu, signs in anonymously and exchanges the Join Code for a current Session grant.
7. Customer configures items and submits with an idempotency key.
8. Server validates grant/session/menu/availability/modifiers/price and commits order, item snapshots, audit and outbox event atomically.
9. KDS receives or resyncs the committed order and advances item states.
10. Waiter marks items served; customer may add an order under the same Session.
11. Customer requests bill; Cashier reviews server-calculated immutable bill snapshot.
12. Cashier applies an authorized discount if needed and confirms one or more manual tenders.
13. Confirmed payments allocate to Session balance; when zero, receipt and paid transition occur transactionally.
14. Cashier closes Session; all customer grants are revoked.
15. Reports include the transaction under Branch business date and configured timezone.

Detailed flows: [`ui/USER_FLOWS.md`](ui/USER_FLOWS.md).

## 6. Required exception paths

- Duplicate order submission returns the original result for the same request hash.
- Same idempotency key with a different request hash is rejected.
- Invalid, revoked, expired or cross-tenant QR/Join Code reveals no sensitive existence details.
- Closed/paid/cancelled Session rejects customer writes and hides order history from new diners.
- Sold-out, changed price or invalid Modifier returns item-specific repair instructions while preserving cart state.
- Realtime disconnect shows stale state, uses polling/resync, deduplicates events and never creates business data.
- Unauthorized staff action fails in application authorization and RLS/database constraints.
- Concurrent accept/serve/pay/close detects version conflict and safely refreshes.
- Payment failure leaves balance unpaid and retryable without duplicate confirmation.
- Preparing-item cancellation requires Manager, reason and audit.
- New diners at a reused table receive a new Session/Join Code and cannot access the prior Session.

## 7. Functional requirements

### Tenant and setup

- Restaurant/Branch lifecycle, settings, staff memberships, roles, tables, QR, stations and features.
- Tenant branding, locale, currency and timezone from validated configuration.

### Menu

- Categories, items, Variant, Modifier groups/options, required min/max, pricing, images, sorting, visibility, availability, sold-out, tax/service eligibility and station routing.
- Immediate audited V1 publication; immutable order snapshots.

### Customer

- Mobile-first public menu and current Session capability.
- Cart, notes, price estimate, server validation, idempotent order, tracking, add order and service requests.

### Kitchen

- Branch/station queues, item-level workflow, elapsed/SLA, notes, sound/visual alerts, unassigned queue, recent completion, conflict and reconnect recovery.

### Waiter

- Mobile table status, Session detail, manual orders, service inbox, partial serving, payment handoff, open/clean/close permissions and conflict handling.

### Cashier

- Whole-session bill, discounts, pricing breakdown, multi-tender manual payments, cash received/change, receipt/reprint, reconciliation and close recovery.

### Admin and reporting

- Profiles, branches, tables/QR, menus, staff/roles, stations, orders, payments, service requests, audit, settings, flags and required sales/operations reports.

## 8. Non-functional requirements

- Security: database-level tenant isolation, least privilege, short-lived capabilities, no client secrets.
- Correctness: integer money, deterministic pricing, explicit state machines, immutable financial snapshots.
- Reliability: idempotency, optimistic concurrency, transactional commands, outbox, resync and recovery UI.
- Performance: mobile p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; stable-network order-to-KDS p95 ≤3s under agreed Pilot load.
- Accessibility: WCAG 2.2 AA plus keyboard, touch, screen reader and reduced motion.
- Maintainability: modular monolith, typed contracts, import boundaries, ADRs and strict tests.
- Internationalization: English complete; locale-safe architecture and pseudo-long layouts for Chinese/BM pending approved translations.
- Observability: correlation IDs, domain metrics, alerts, runbooks and privacy-safe logs.

## 9. System architecture

Recommended V1: one Next.js App Router deployable application organized as a layered modular monolith, backed by Supabase PostgreSQL/Auth/Realtime/Storage.

Role-specific route groups and App Shells share typed contracts and UI primitives but not incompatible workflows. Server Components call query services; interactive clients use typed commands/subscriptions. Staff mutations may use Server Actions as adapters. Public/customer commands use versioned Route Handlers or narrowly exposed RPC adapters. Every entry point invokes the same application authorization and domain rules.

Detailed design: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 10. Database architecture

The database uses UUID identifiers, explicit Restaurant/Branch scope, composite tenant-safe foreign keys, enum/check constrained states, version columns, immutable snapshots, unique idempotency keys, append-only audit/payment records, and an outbox.

Detailed entities, constraints and indexes: [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md).

## 11. Multi-tenant strategy

- Platform → Restaurant → Branch hierarchy.
- Every branch-owned row carries both Restaurant and Branch keys.
- Composite constraints prevent a Branch/entity being attached to another Restaurant.
- RLS resolves active memberships and exact Branch scope.
- Reports accept only authorized Restaurant/Branch filters and group within that scope.
- Platform access is a separate high-privilege path with stronger auth, audit and data minimization.

## 12. Authentication and authorization

Staff use permanent Supabase Auth identities plus active staff memberships. Roles map to permissions; membership, branch scope and account/tenant active state are checked on every sensitive command.

Customers use non-PII anonymous identities. Since Supabase Anonymous Auth uses the `authenticated` Postgres role, policies also require trusted `is_anonymous = true` and a live `customer_session_grant`; staff policies require `is_anonymous = false` plus membership. QR alone never grants current order access.

Proxy/layout checks improve navigation only. Server Actions, Route Handlers, query services and database policies each enforce authorization as appropriate.

## 13. RLS strategy

- Explicit Data API grants; no assumption of automatic table exposure.
- RLS enabled on all exposed tables.
- Default deny, narrowly scoped policies per operation.
- Separate helper functions in a private/security schema; default `SECURITY INVOKER`.
- Any necessary `SECURITY DEFINER` function gets fixed/empty search path, fully qualified names, revoked PUBLIC execute, explicit grants, internal actor/scope checks and dedicated tests.
- Views use `security_invoker = true` or stay unexposed.
- RLS matrix tests impersonate Platform, Owner, Manager, Kitchen, Waiter, Cashier, anonymous customer, wrong tenant, suspended user and unauthenticated role.

## 14. Realtime architecture

Business transactions write entity changes, audit and `outbox_events`. Realtime broadcasts database facts with event ID/version/scope; clients deduplicate and compare entity versions. Disconnect triggers stale UI and bounded polling/resync. Reconnect performs cursor/version reconciliation before clearing stale status.

Detailed contract: [`REALTIME_ARCHITECTURE.md`](REALTIME_ARCHITECTURE.md).

## 15. State machines

Dining Session, Order/Item and Payment transitions are explicit, role-controlled, versioned and audited. Table operational state is derived from active Session/orders/requests, not a conflicting manually editable truth.

Detailed transitions: [`STATE_MACHINES.md`](STATE_MACHINES.md).

## 16. Error handling

- Stable typed error envelope with code, safe message, correlation ID, retryability and field/item details.
- Do not leak table existence, tenant IDs, SQL, stack traces, secrets or authorization predicates.
- UI preserves user input on recoverable validation/availability errors.
- Partial success is explicit; no generic success if the transaction is unconfirmed.
- Error boundaries are role/route-specific and include recovery action.

## 17. Offline and network failure

- Public menu may use safe cached shell/data with bounded staleness.
- Session, price, availability, order, payment and permission data are dynamic and not shared across users.
- Customer order submission is not silently queued offline.
- KDS/Waiter/Cashier show offline, last sync, stale and conflict.
- Reconnect uses resync; Realtime is never proof of commit.

## 18. Idempotency and concurrency

- Client generates command UUID; server stores actor/scope/key/request hash/result reference/expiry.
- Same key + same hash returns the prior outcome; same key + different hash rejects.
- Unique constraints are the final duplicate barrier.
- Entity versions protect accept, prepare, serve, discount, pay and close.
- Payment and Session closure use row locking/transaction boundaries where optimistic retry alone is unsafe.

## 19. Audit strategy

Append-only audit captures actor, role, tenant, action, entity, masked before/after, reason, request/correlation, minimal IP/User Agent and timestamp. Sensitive fields are excluded or pseudonymized. Audit access is restricted and itself audited. Retention and legal hold require Restaurant/Platform policy confirmation.

## 20. Testing strategy

Layered unit/property, state matrix, application contract, integration, RLS/security, E2E, accessibility, visual, concurrency, realtime recovery, load, migration and restore tests. CI gates are proportional: fast checks per change; full Golden Path/security/load/restore at release milestones.

Detailed matrix: [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).

## 21. Deployment strategy

Development, Preview/Test, Staging and Production use isolated Supabase projects, keys, Storage and third-party settings. BUILD is local only. STAGING_VERIFY and RELEASE require separate named authorization. Promote a traced commit and migration set; do not rebuild untracked source between environments.

Detailed plan: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 22. Backup and recovery

- Define RPO/RTO with Restaurant Owner before release; planning target is RPO ≤24h and RTO ≤4h until upgraded.
- Database and Storage backups are separate; Supabase database backup does not by itself cover Storage objects.
- Version migrations and seed/init procedures.
- Rehearse restore to an isolated environment and verify row counts, grants, RLS, object integrity and Golden Path.
- Record recovery point, owner, credentials and escalation without putting secrets in docs.

## 23. Security review

Threat model covers tenant/branch/table BOLA, QR replay, old-session access, anonymous-auth abuse, staff privilege escalation, price manipulation, payment duplication, unsafe functions/views, storage upload, XSS/CSRF/CORS/CSP/SSRF, secrets, dependency supply chain and audit tampering.

Current status is design-only: [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md).

## 24. Performance strategy

- Server-render public shell and stream dynamic content; avoid identity-specific static caching.
- Keep Client Components at interactive leaves and control bundle budgets per role shell.
- Optimize menu images with explicit dimensions and responsive sizes.
- Index RLS predicates, tenant/status/time queue queries and report filters.
- Use keyset pagination for operational history and bounded report ranges.
- Measure cold/warm paths, low-end phones and restaurant Wi-Fi under Pilot-derived concurrency.

## 25. Observability strategy

Correlate Request → Command → DB transaction → Outbox event → Realtime delivery. Track order success/latency, duplicate blocks, KDS delay/disconnect, invalid transitions, payment failures/duplicates, close failures, authorization denial trends, Web Vitals, migration, backup and jobs. Every alert has severity, owner, threshold and runbook.

Detailed plan: [`OBSERVABILITY.md`](OBSERVABILITY.md).

## 26. Data migration strategy

Greenfield V1 starts with versioned schema migrations and placeholder seed only. Future changes use expand → backfill/migrate → dual-read/write if required → verify → contract. Avoid long locks, test empty and production-shaped datasets, and prefer roll-forward after release. Production migrations require backup/recovery point and RELEASE authorization.

## 27. Future expansion interfaces

Define narrow domain ports for Payment Provider, Printer, Notification, Inventory, Reservation, Supplier/FAMFOOD, E-Invoice, Analytics, Loyalty and Delivery. Ports are implemented only when an approved use case exists. Core domain events must be vendor-neutral.

## 28. Milestones and exit criteria

### M0 — Audit and Plan

Plan-only exit: audit, scope, architecture, state, permissions, UI, testing, security, deployment, operations and risks documented; no implementation claims.

BUILD exit: versions verified, project scaffolded, local developer workflow works, initial CI baseline defined.

### M1 — Foundation

Strict TypeScript, package boundaries, environment validation, role shells, Auth foundation, logging/errors and independent UI Foundation Gate.

### M2 — Database and RLS

Schema, constraints, indexes, explicit grants, RLS, Storage policies, seed/init, audit/outbox/idempotency and policy tests.

### M3 — Tenant Setup

Restaurant, Branch, staff, role, table, QR, Session Join Code and capability grants.

### M4 — Menu

Menu/Variant/Modifier/image/availability/station with tenant-safe admin and snapshots.

### M5 — Customer

Public entry, Session join, menu/cart/order/tracking/add-order/service requests and full recovery states.

### M6 — KDS

Station queues, item states, event/resync, audio and high-peak recovery.

### M7 — Waiter

Tables, sessions, requests, manual ordering, serving, handoff and concurrency.

### M8 — Cashier

Pricing, discounts, manual multi-tender payments, receipts, close/recovery and reconciliation.

### M9 — Admin/Reports

Full V1 administration, reports, audit viewer, flags and operational controls.

### M10 — QA/Hardening

Full automated matrix, devices, accessibility, performance, load, recovery, independent final UI review and no open P0/P1.

### M11 — Release Preparation

Staging rehearsal, backup/restore, observability, Go/No-Go, training, handover and client inputs. Requires STAGING_VERIFY for external actions.

### M12 — Production/Pilot

RELEASE and PILOT_VALIDATE only.

## 29. Definition of Done

Apply the complete Definition of Done from the governing Prompt. No feature is complete without connected UI/backend/database, permissions/RLS, validation, error/loading/empty/offline/conflict/recovery, target-device layout, tests, documentation, and passing quality gates.

## 30. Launch checklist summary

- Correct production project/domain/commit/migrations authorized.
- Environment and secret review.
- Restaurant settings and formal business rules approved.
- RLS/grants/storage smoke tests.
- Backup/recovery point and restore drill.
- Golden Path on controlled table.
- Staff accounts/MFA and training.
- Monitoring, alerts, runbooks, support and rollback window.
- No P0/P1 and all deviations accepted by authorized owner.

Full checklist: [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

## 31. Post-launch support plan

- Hypercare window covering first Pilot and first production service.
- Severity definitions: P0 safety/data/money/tenant incident; P1 Golden Path outage/high-risk operational failure; P2 degraded non-critical; P3 cosmetic/improvement.
- Named restaurant and technical contacts, escalation channel and response targets required before release.
- Daily reconciliation and KDS/order health review during Pilot.
- Incident notes preserve correlation IDs and avoid sensitive data.
- Post-incident review and regression test for P0/P1.

## 32. Known risks

- Static table QR cannot prove physical presence; rotating Session Join Code is the selected compensating control.
- Anonymous Auth can be abused to create users; CAPTCHA/rate limits/cleanup policy are required.
- Restaurant Wi-Fi and device quality may miss performance/realtime targets.
- Formal SST/service/rounding/receipt rules are unknown.
- Browser printing varies by device; hardware integration is Deferred.
- Scope is large for one V1 and must remain frozen.
- Supabase/Next.js behavior changes; version/docs revalidation is a build gate.
- Human usability and Pilot evidence cannot be produced by engineering alone.

## 33. Assumptions

- Dive Restaurant is in Malaysia and initially uses MYR and Asia/Kuching unless the owner corrects this.
- One pilot Branch is expected, but architecture supports multiple Branches.
- Staff have supported modern browsers and reliable enough connectivity for web apps.
- Manual payment confirmation means the cashier observes an external terminal/QR/cash result and records it.
- English is the approved operational fallback until translations are supplied.
- No existing production data requires migration.

## 34. Open questions requiring owner input

- Legal restaurant name, branch address, registration/tax details and receipt fields.
- Exact tables, areas, guest limits and table labels.
- Menu, images, modifiers, allergens and kitchen routing.
- SST/service charge/inclusive tax/rounding/calculation/effective-date rules.
- Business-day cutoff and cross-midnight attribution.
- Discount permissions/caps and cancellation policy after preparation.
- Join Code operating method: waiter verbal/display card/device screen.
- Pilot traffic model, devices, Wi-Fi, staff count and support hours.
- Retention, privacy notice, incident contacts, backup RPO/RTO and MFA policy.
- Chinese/Bahasa Melayu translations and approval owner.

These are tracked in [`CLIENT_INPUT_REQUIRED.md`](CLIENT_INPUT_REQUIRED.md). Engineering may proceed with explicit test fixtures where safe, but Production remains blocked until required inputs are confirmed.

## 35. Deferred features

Authoritative list and manual fallback: [`V1_SCOPE_MATRIX.md`](V1_SCOPE_MATRIX.md). Deferred features must not appear as functional UI or broaden V1 state machines without approved scope change.

## 36. Current gate

Local BUILD status: M0–M9 are implemented and pass the current local automated matrix; M10 automated hardening passes while manual device/screen-reader/usability/final-review evidence remains. Local reset applies 32 migrations, 508 pgTAP assertions pass, and the complete Playwright matrix passes 81 checks with 27 expected cross-project skips and zero failures. The named Staging Supabase project has the previously reviewed first 16 migrations; the 16 newer additive migrations require reviewed push and verification. Vercel retains the explicitly authorized inert bootstrap and an earlier inspect-confirmed real Preview, but that Preview predates the newest slices. Finish Line A requires a fresh non-production Staging Golden Path plus manual/device/load/provider-operational evidence and required owner inputs. Production and unrelated external projects remain out of scope and separately gated.
