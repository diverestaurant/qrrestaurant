# Current Task

Mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Milestone: M3–M10 — Core command slices and local hardening  
Status: In progress

## Authoritative checkpoint — 4/7

- The inert 448-byte Vercel Production bootstrap is retained only as the provider initialization baseline; the real application is not deployed to Production. A real application Preview was previously verified `READY` with `inspect.target=preview`.
- Local migrations `20260721140000`–`20260721148000` add guarded KDS transitions/recovery, waiter Session ordering/handoff/cleaning, public sold-out rules, Admin operations/full menu management, service-request commands and staff invitation membership. They remain local until a fresh reset/pgTAP pass and reviewed Staging push.
- Customer menu now applies branch-timezone operating windows, scoped Realtime invalidation plus authoritative resync, and safe cart removal/repricing when live configuration changes.
- Admin now has guarded full menu/variant/modifier/image controls and a Supabase Auth invitation flow with Branch-role membership, compensation cleanup and user-chosen password onboarding.
- Current source evidence: lint PASS, strict typecheck PASS, 22 Vitest files / 62 tests PASS, and `next build --webpack` PASS.
- Database runtime evidence remains valid through migration `20260721143000`: 21 pgTAP files / 263 assertions PASS. Newer migrations have static tests but require Docker access for runtime verification; the sandbox rejects the Docker socket with `operation not permitted` before migration execution.

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
- M8–M9 financial closure slice: authoritative order-to-Session totals, authorized percent/fixed discounts with caps and reasons, payment-begin plus multiple manual tenders, PAID transition, immutable receipt/reprint snapshots, reconciliation and Session close with customer-grant revocation.
- M10 local recovery slice: visible role-shell reachability state, browser offline/online handling, foreground recheck, bounded health polling and authoritative refresh entry point; static KDS copy no longer claims a connected Realtime channel.
- M10 Realtime slice: scoped customer Session and staff Branch Supabase Realtime adapters validate tenant/session scope, treat row changes as invalidation hints, and trigger authoritative HTTP resync; reconnect/error/closed states, browser online/offline handling and bounded polling fallback are covered locally.

## Acceptance evidence

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm test` — pass; 15 test files / 43 tests, including pricing, state, capabilities, submit-order, session, menu, service-request, KDS, payment, idempotency, freshness presentation and Realtime event reconciliation cases.
- `npm run build` — pass with local-only build execution.
- `npm run test:e2e` — pass against the local dev server: 58 passed and 16 expected role-specific skips across customer/staff API boundaries, repository-backed menu and KDS/Waiter/Cashier/Admin pages, customer QR entry/Join Code/cart/order/tracking/service-request UI, variant/modifier configuration UI, customer/staff success/replay for menu/Session/order/service/KDS/payment commands, discount/multi-tender/receipt/close recovery, authorized report read, branch-scoped Storage upload/download/delete, local customer/staff Realtime notification and resync flows, a synthetic 30-request menu read burst, all role surfaces at 320px, keyboard/action-name checks and browser offline → online recovery. Browser workers are serialized because deterministic synthetic IDs are intentionally shared; DB concurrency is covered separately.
- Local Supabase reset, app-owned schema lint, security advisors and pgTAP tests — pass; 179/179 database assertions across seventeen SQL files covering public access, Storage bucket/policies, public table entry, variant/modifier publication and snapshots, financial discounts/payment-begin/multi-tender/receipt/reconciliation/close, server-only staff repository grants, customer/staff Realtime publication, audit/outbox, synthetic staff/anonymous/cashier/order RLS, report tenant isolation, explicit service-role idempotency/membership access and concurrency hardening. Unscoped advisor/lint output from Supabase-managed extensions is not treated as app evidence.
- Authorized Staging Supabase migration/RLS verification — pass; all 16 local migrations applied in timestamp order, remote history matches 16/16, synthetic seed applied only after confirming the project was empty, 29 public tables all have RLS, 52 public policies, 8 Realtime publication tables, zero tenant-scope policy gaps, zero anon privileges on sensitive tables, zero duplicate order idempotency groups and zero orphan orders/items/payments/discounts. Security/performance advisors return WARN-level findings only; these are recorded for follow-up and no advisor ERROR was reported.
- Authorized Vercel Staging link/configure/deploy/verify — team/project link succeeded and six encrypted Preview variables remain configured. Custom `staging` target creation was rejected because the Hobby plan allows zero custom environments. Three first-deployment candidates were classified Production despite Preview requests and were deleted (`dpl_5UEPiviXtKjYGAT4LjRGwcH2iFAk`, `dpl_FcvnDbwLXb6D6xerNeWgK7nmhbBE`, `dpl_7FVPyweiFt5ZrAWaYSs6nCjJKeCV`); Vercel now reports no deployments. Provider documentation confirms the first deployment of a new project is automatically marked Production. A local empty `codex/staging` baseline commit and `.vercelignore` now provide branch metadata and reduce the upload manifest from 245 files/~7.1 MB to 100 files/~0.54 MB with no Supabase temp metadata, tests, reports or internal docs.

## Next executable work

1. M10: continue manual screen-reader/device/usability, visual regression, representative load and hosted/operational backup-restore evidence; local synthetic Storage object backup/restore is now tested.
2. After the new local migrations pass reset/pgTAP, present their order/risk summary, push only reviewed migration/RLS changes to the named Staging Supabase project, then deploy the latest real app as Preview and re-verify `inspect.target=preview` plus the hosted Golden Path.
3. Re-run the local verification matrix after each further slice and update this document and `SESSION_HANDOFF.md`.

## Finish Line

Finish Line A is not met. The bootstrap/Preview provider loop is resolved, but the latest local migrations and UI have not yet completed the full database/browser matrix or been re-verified in Staging Preview.
