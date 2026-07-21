# Current Task

Mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Milestone: M3–M11 — Complete V1 administration, reports, hardening and Staging rehearsal
Status: In progress

## Authoritative checkpoint — 4/7 complete; 5/7 in progress

- The inert 448-byte Vercel Production bootstrap is retained only as the provider initialization baseline; the real application is not deployed to Production. A real application Preview was previously verified `READY` with `inspect.target=preview`.
- Local migrations `20260721140000`–`20260721152000` add guarded KDS/waiter recovery, full Admin menu and staff operations, narrow QR maintenance, Restaurant/Branch settings, operations/reconciliation reporting and Platform-only tenant lifecycle/manual subscription tracking. They remain local until a reviewed Staging push.
- Customer menu now applies branch-timezone operating windows, scoped Realtime invalidation plus authoritative resync, and safe cart removal/repricing when live configuration changes.
- Admin now has guarded full menu/variant/modifier/image controls and a Supabase Auth invitation flow with Branch-role membership, compensation cleanup and user-chosen password onboarding.
- Current source evidence: lint PASS, strict typecheck PASS, 22 Vitest files / 62 tests PASS and `next build --webpack` PASS. The last full Playwright matrix remains 65 passed / 21 expected role skips / zero failures; the new Platform authorization/lifecycle slice additionally passes its targeted 2/2 checks and awaits the next full-matrix rerun.
- Local database runtime evidence: clean reset applies all 29 migrations through `20260721152000`; 29 pgTAP files / 451 assertions PASS, including settings, reports/reconciliation, Platform-only isolation/lifecycle and suspended-tenant authorization.

## Objective

Continue M0 engineering validation and M1–M10 locally, using the V3 prompt, Master Plan, V1 Scope Matrix and ADRs. The named Staging Supabase project is authorized only for reviewed migrations, RLS, indexes, constraints, synthetic seed and read-only verification. The named `dive restaurant` Vercel Staging scope is authorized for link, staging environment configuration, non-production deployment and verification; Production and unrelated external projects remain out of scope.

## Completed locally

- M0: pinned framework/runtime baseline, local developer scripts, environment template and local Supabase stack.
- M1: App Router foundation, typed envelopes, lazy server/browser clients, structured errors/logging, five role shells, Customer Golden Path demo and recovery states.
- M2: tenant-scoped schema, integer minor-unit money fields, immutable snapshots, idempotency/outbox/audit tables, explicit grants, RLS and private menu-image storage policy.
- Independent UI/UX Design Subagent review completed; GREEN work may proceed, while QR/session, money, RLS/permissions, state-machine and offline-submit changes remain RED.
- M3 local adapter slice: session command schemas, join-code domain rules, server-authorized staff Session open API with transactional Session/Join Code RPC, anonymous-claim Join API, and deterministic command fingerprints with unit tests.
- M4 first slice: versioned menu availability/sold-out command contract with stale-state protection.
- M4 repository slice: public Customer menu API and Demo page now read the synthetic local Supabase restaurant, branch, categories and available items.
- M4 mutation slice: server-only staff menu availability route adds expected-version checks, server-side idempotency bookkeeping and database audit/outbox trigger; unauthenticated access returns 401.
- M5 local API/UI slice: customer order submit with grant-bound server pricing/order snapshots, customer service-request create with session-grant/RLS boundary and server-only idempotency; customer Join Code, cart, order tracking, add-on entry point and service-request UI are wired to local repositories/APIs; waiter transition route with stale-state protection.
- M5 variant/modifier slice: public menu now reads active variants, modifier groups/options and linked rules; customer selection UI keeps configured lines separate; the order RPC re-resolves active configuration, validates min/max/duplicates/branch scope and stores immutable price/configuration snapshots.
- M5–M9 staff repository slice: KDS, Waiter, Cashier and Admin pages now read server-only, branch-scoped synthetic snapshots from local Supabase; staff mutations remain behind authenticated command APIs and local repository grants are covered by pgTAP.
- M6 local API slice: KDS order-item transition route through the order state machine with version checks and server-only idempotency.
- M7 local API slice: waiter service-request claim/resolve/cancel route with version checks and server-only idempotency.
- M8 local RPC/API slice: atomic cashier payment confirmation with cash/change, non-cash reference, allocation, session paid-total update and server-only idempotency.
- M9 local report slice: branch summary RPC/API with explicit `report.read` permission and wrong-tenant isolation.
- M3/M9 settings slice: Owner-only Restaurant profile plus Manager/Owner Branch operations settings use repository-backed, versioned commands; currency changes are rejected once Session money history exists.
- M9 reporting slice: bounded date-range operations/reconciliation RPC/API and Admin view expose authoritative sales, payments, service and exception totals with explicit tenant/capability scope.
- Platform lifecycle slice: Platform-only tenant catalog, deterministic idempotent Restaurant/first-Branch creation, data-preserving suspend/reactivate and manual subscription tracking are guarded, audited and locally tested. UI commands are locked during authoritative resync to prevent concurrent stale writes.
- M8–M9 financial closure slice: authoritative order-to-Session totals, authorized percent/fixed discounts with caps and reasons, payment-begin plus multiple manual tenders, PAID transition, immutable receipt/reprint snapshots, reconciliation and Session close with customer-grant revocation.
- M10 local recovery slice: visible role-shell reachability state, browser offline/online handling, foreground recheck, bounded health polling and authoritative refresh entry point; static KDS copy no longer claims a connected Realtime channel.
- M10 Realtime slice: scoped customer Session and staff Branch Supabase Realtime adapters validate tenant/session scope, treat row changes as invalidation hints, and trigger authoritative HTTP resync; reconnect/error/closed states, browser online/offline handling and bounded polling fallback are covered locally.

## Acceptance evidence

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm test` — pass; 22 files / 62 tests.
- `npx next build --webpack` — pass with Next.js 16.2.10 production compilation and all current routes, including Platform tenants and operations reports.
- `npm run test:e2e` — pass against the local dev server: 65 passed, 21 expected role-specific skips and zero failures across customer/staff boundaries, repository-backed role apps, full financial closure, Realtime/resync, WCAG automation, 320px layouts, offline recovery, load smoke and Storage backup/restore.
- Local Supabase clean reset and pgTAP — pass; all 29 migrations apply and 451/451 assertions across 29 SQL files pass. Unscoped advisor/lint output from Supabase-managed extensions is not treated as app evidence.
- Authorized Staging Supabase migration/RLS verification — pass; all 16 local migrations applied in timestamp order, remote history matches 16/16, synthetic seed applied only after confirming the project was empty, 29 public tables all have RLS, 52 public policies, 8 Realtime publication tables, zero tenant-scope policy gaps, zero anon privileges on sensitive tables, zero duplicate order idempotency groups and zero orphan orders/items/payments/discounts. Security/performance advisors return WARN-level findings only; these are recorded for follow-up and no advisor ERROR was reported.
- Authorized Vercel Staging link/configure/deploy/verify — team/project link succeeded and six encrypted Preview variables remain configured. Custom `staging` target creation was rejected because the Hobby plan allows zero custom environments. Three first-deployment candidates were classified Production despite Preview requests and were deleted (`dpl_5UEPiviXtKjYGAT4LjRGwcH2iFAk`, `dpl_FcvnDbwLXb6D6xerNeWgK7nmhbBE`, `dpl_7FVPyweiFt5ZrAWaYSs6nCjJKeCV`); Vercel now reports no deployments. Provider documentation confirms the first deployment of a new project is automatically marked Production. A local empty `codex/staging` baseline commit and `.vercelignore` now provide branch metadata and reduce the upload manifest from 245 files/~7.1 MB to 100 files/~0.54 MB with no Supabase temp metadata, tests, reports or internal docs.

## Next executable work

1. Step 5/7: close remaining M3/M9 V1 gaps: branch lifecycle, staff self-profile, printable QR/receipt and i18n architecture. Restaurant/Branch settings, Platform lifecycle and operations/reconciliation reports are implemented and locally tested.
2. Continue M10 manual screen-reader/device/usability, visual regression, representative load and hosted/operational backup-restore evidence; local synthetic Storage object backup/restore is tested.
3. Present the new migration order/risk summary, push only reviewed migration/RLS changes to the named Staging Supabase project, then deploy the latest real app as Preview and re-verify `inspect.target=preview` plus the hosted Golden Path.
3. Re-run the local verification matrix after each further slice and update this document and `SESSION_HANDOFF.md`.

## Finish Line

Finish Line A is not met. The latest local database/browser matrix passes, but remaining V1 administration/reporting/i18n work and fresh Staging migration/Preview evidence are still required.
