# Session Handoff

Last updated: 2026-07-21  
Execution mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Authorized path: `/Users/oscar/Documents/QR restaurant odering system`  
External scope: named Staging Supabase migration/RLS/index/constraint/synthetic-seed/verification plus named `dive restaurant` Vercel Staging link/configure/deploy/verify; no Production or unrelated external project

## Checkpoint 4/7 committed — step 5/7 in progress, do not restart

The retained Vercel initialization state is resolved: inert 448-byte Production bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN` remains, and real application Preview `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn` was `READY` with `inspect.target=preview`. Never deploy or promote the real app to Production.

Local work after that Preview now extends through migration `20260721152000`: complete menu Admin, KDS/waiter recovery, Restaurant/Branch settings, bounded operations/reconciliation reports and Platform-only tenant lifecycle/manual subscription tracking. Lint/typecheck, 22 Vitest files / 62 tests and Webpack production build pass. The prior complete Playwright matrix is 65 pass / 21 expected skips / zero failures; the latest Platform slice adds targeted 2/2. A clean reset applies all 29 migrations and 451/451 pgTAP assertions pass.

Resume inside plan step 5/7: Restaurant/Branch settings, operations/reconciliation reports and Platform lifecycle are complete locally. Continue branch lifecycle, staff self-profile, printable QR/receipt and i18n architecture, then the fresh full matrix, M10 manual/visual/operational evidence and reviewed Staging/Preview rehearsal.

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

- Lint, strict typecheck, 22 unit test files / 62 tests and Next.js production Webpack build pass after the latest Platform UI concurrency hardening.
- `npm run test:e2e` passes 65 with 21 expected role-specific skips and zero failures across customer-mobile and staff-desktop, including all repository-backed role workflows, financial closure, WCAG automation, 320px layouts, Realtime resync, offline recovery, load smoke and Storage backup/restore.
- Local Supabase clean reset applies 29 migrations and 451 pgTAP assertions pass across 29 SQL files, including RLS/tenant isolation, QR/session/menu/order/KDS/waiter/payment/settings/report/Platform/invitation/Realtime and concurrency boundaries.
- Authorized Staging Supabase verification passes: 16/16 migration history, 29 public tables with RLS, 52 policies, 8 Realtime publication tables, zero anon sensitive privileges, zero tenant-scope gaps and zero orphan/duplicate integrity findings after synthetic seed.
- Only the named Staging Supabase project was modified within the explicit migration/RLS/index/constraint/synthetic-seed scope. The authorized Vercel project was linked and Preview variables were configured. All three accidental first-deployment Production candidates were deleted, and Vercel now reports no deployments. No unrelated project was accessed.

## Independent UI/UX gate

Subagent **Peirce** completed the required read-only UI Foundation review. Result: conditional pass for GREEN work. Keep the warning active: UI-originated QR/session authorization, money, offline auto-submit, schema, RLS, permission and state-machine changes are RED; shared state/dependency changes are YELLOW.

## Next work

1. Step 5/7: implement remaining branch lifecycle, staff self-profile, printable QR/receipt and i18n architecture; settings, Platform lifecycle and operations/reconciliation are complete locally.
2. Continue M10 manual screen-reader/device/usability, visual regression, representative load, provider/operational backup and final review evidence; local object and schema restore drills are evidenced.
3. Push only reviewed migrations to the named Staging project, deploy only a real Preview, require `inspect.target=preview`, and run the hosted Golden Path; never promote the app to Production.

## Do not claim yet

Do not label the full system Verified in Staging, Production Ready Candidate, Deployed to Production, Pilot Validated or Production Ready. The database/RLS scope is Verified in Staging; application slices remain Implemented/Tested Locally.
