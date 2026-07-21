# Session Handoff

Last updated: 2026-07-21  
Execution mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Authorized path: `/Users/oscar/Documents/QR restaurant odering system`  
External scope: named Staging Supabase migration/RLS/index/constraint/synthetic-seed/verification plus named `dive restaurant` Vercel Staging link/configure/deploy/verify; no Production or unrelated external project

## Checkpoint 4/7 — continue, do not restart

The retained Vercel initialization state is resolved: inert 448-byte Production bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN` remains, and real application Preview `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn` was `READY` with `inspect.target=preview`. Never deploy or promote the real app to Production.

Local work after that Preview adds migrations `20260721140000`–`20260721148000`, complete menu Admin, KDS recovery, guarded service requests, waiter handoff/cleaning, customer menu Realtime/operating-window/cart reconciliation and staff invitation/password onboarding. Lint/typecheck, 22 Vitest files / 62 tests and Webpack production build pass. Database runtime evidence passes through migration `20260721143000` at 21 pgTAP files / 263 assertions; newer migrations await Docker-capable reset/pgTAP. The current sandbox denial is `operation not permitted` on the Docker socket, before any new migration runs.

Resume at plan step 4/7: continue safe local M3–M10/M11 gaps and static/source verification. When Docker or external execution becomes available, run reset/pgTAP before presenting the migration order/risk summary and pushing to Staging; then deploy the newest app to Preview and rerun the hosted Golden Path.

## Current state

M0–M2 are implemented and tested locally. M3 Session adapters, M4 menu read/mutation, M5–M8 command routes, M9 branch summary, local financial closure and M10 hardening slices have local implementations and evidence. M3 includes repository-backed staff Session open and anonymous-claim customer join adapters with transactional RPCs. M5 includes grant-bound server pricing/order snapshots, variant/modifier selection with authoritative configuration snapshots, plus customer QR/Join Code/cart/order/tracking/service-request UI; M8–M9 now include authoritative order totals, authorized discounts, payment-begin/multiple manual tenders, PAID transition, receipt/reprint, reconciliation and Session close with grant revocation. KDS, Waiter, Cashier and Admin render server-only, branch-scoped synthetic repository snapshots from local Supabase. Customer Session and staff Branch Realtime adapters now use scoped channels as invalidation hints and trigger authoritative resync with reconnect/offline/polling fallback. The named Staging Supabase project now has all 16 reviewed migrations and synthetic seed, with RLS/tenant-scope/integrity verification passing. Vercel team/project link succeeded and six encrypted Preview variables remain configured. Custom `staging` target creation was rejected because the plan allows zero custom environments. Three first-deployment candidates were classified Production despite Preview requests and were deleted; no deployment remains. Official provider documentation confirms a new project's first deployment is automatically Production. The real app upload manifest is hardened with `.vercelignore`, and an inert bootstrap dry-run passes. App-level Staging, manual M10 and Production evidence remain open. Finish Line A is not met.

## Implemented local artifacts

- Pinned Next.js/React/TypeScript/Supabase package baseline and npm scripts.
- App Router foundation with local-safe system fonts, API health/menu routes, lazy Supabase clients and typed error/view-model contracts.
- Five role shells plus Customer Golden Path demo, Join Code boundary, stale/unknown-outcome messaging and KDS audio fallback.
- Domain/application contracts for money/pricing, session/order/payment states, capabilities, submit order and begin payment.
- M3 session commands, join-code normalization/expiry/generation/open/join rules and deterministic idempotency fingerprints.
- M3 local Session repository/API adapters: staff open with server-only idempotency, hashed Join Code creation, customer join with server-derived anonymous actor and bounded Session grant.
- M4 versioned menu availability command with stale-state protection.
- M4 local public menu repository/API/page using explicit public entry grants and RLS policies.
- M4 staff menu availability route with server-only idempotency bookkeeping and database audit/outbox trigger.
- M5 customer service-request command with live-session write boundary.
- M6 KDS order-item transition command with state-machine/version protection.
- M7 waiter service-request transition command with state/version protection.
- M8 cashier payment confirmation command with cash/change and observed-reference checks.
- M5–M8 local APIs with server-only idempotency for customer service requests, waiter transitions, KDS transitions and cashier payment confirmation.
- M5 customer order submit RPC/API with grant-bound availability/price validation, integer minor-unit totals, immutable snapshots and Session versioning.
- M9 branch summary report RPC/API with explicit report permission and tenant-isolation test.
- Supabase migrations for tenant/menu/session/order/payment/service/audit/outbox structures, constraints, explicit grants, RLS and private menu-image storage policies.
- Synthetic local seed data, explicit `app_private` helper grants and pgTAP foundation, public-entry, audit/outbox, staff-RLS and anonymous Session grant assertions.
- M10 concurrency hardening pgTAP assertions for stale order versions, bounded quantity/modifier input, availability revalidation, duplicate order replay, payment tender/reference/balance bounds and exact Session version increments.
- M10 Playwright hardening checks for all role surfaces at 320px, keyboard focus/action names, local menu latency smoke budget and a synthetic 30-request menu read burst.
- M10 client recovery boundary with visible `App reachable`, `Reconnecting`, `Check required` and `Offline` states, foreground/online rechecks, bounded health polling and authoritative refresh action.
- M10 Realtime event decision contract plus local customer Session and staff Branch adapters with tenant/session scope validation, version-gap resync, reconnect/offline status and bounded polling fallback; row changes remain invalidation hints and authoritative HTTP refresh is the source of truth.
- Portable local schema-only restore rehearsal for `public`, `app_private` and `auth`; isolated verification found 28 public tables, 50 policies and 28 RLS-enabled public tables before temporary cleanup. A synthetic branch-scoped Storage object backup/restore drill also passes: upload, download, copy to backup key, restore/download byte comparison and cleanup.

## Verified locally

- Lint, strict typecheck, 15 unit test files / 43 tests and Next.js build pass.
- `npm run test:e2e` passes 58 with 16 expected role-specific skips across customer-mobile and staff-desktop against the local dev server, including synthetic customer QR entry/Join Code/cart/order/tracking/service-request and variant/modifier configuration UI, repository-backed KDS/Waiter/Cashier/Admin snapshots, staff menu/Session/order/service/KDS/payment success+replay, discount/multi-tender/receipt/close recovery, report read, branch-scoped Storage upload/download/delete, customer/staff Realtime notification and authoritative resync, a synthetic 30-request menu read burst, menu/Session/payment/report boundaries, all role surfaces at 320px, keyboard/action-name checks and browser offline → online recovery. `agent-browser` was unavailable, so this is the documented fallback.
- Local Supabase reset, app-owned schema lint, security advisors and 179 pgTAP assertions pass across seventeen SQL files, including public table entry, variant/modifier publication and snapshots, private Storage bucket/policy metadata, authoritative order totals, discount/payment-begin/multi-tender/receipt/reconciliation/close, server-only staff repository privileges, customer/staff Realtime publication, manager/outsider/anonymous/cashier/order RLS, Session open/join RPCs, payment allocation, report tenant isolation, order snapshots, explicit server-only idempotency/membership access and concurrency hardening.
- Authorized Staging Supabase verification passes: 16/16 migration history, 29 public tables with RLS, 52 policies, 8 Realtime publication tables, zero anon sensitive privileges, zero tenant-scope gaps and zero orphan/duplicate integrity findings after synthetic seed.
- Only the named Staging Supabase project was modified within the explicit migration/RLS/index/constraint/synthetic-seed scope. The authorized Vercel project was linked and Preview variables were configured. All three accidental first-deployment Production candidates were deleted, and Vercel now reports no deployments. No unrelated project was accessed.

## Independent UI/UX gate

Subagent **Peirce** completed the required read-only UI Foundation review. Result: conditional pass for GREEN work. Keep the warning active: UI-originated QR/session authorization, money, offline auto-submit, schema, RLS, permission and state-machine changes are RED; shared state/dependency changes are YELLOW.

## Next work

1. M10: continue manual screen-reader/device/usability, visual regression, representative load, provider/operational backup and final review evidence; local object and schema restore drills are evidenced.
2. Obtain exact authorization to create and retain one inert 448-byte first-deployment Production bootstrap with domain assignment disabled. Then deploy the real app as Preview, require `inspect.target=preview`, and run app-level browser Golden Path verification; do not promote the app or operate any other Production resource.

## Do not claim yet

Do not label the full system Verified in Staging, Production Ready Candidate, Deployed to Production, Pilot Validated or Production Ready. The database/RLS scope is Verified in Staging; application slices remain Implemented/Tested Locally.
