# Test Report

## Latest checkpoint (supersedes older counts below)

- `npm run lint` and `npm run typecheck`: PASS.
- `npm test`: PASS, 22 files / 62 tests.
- `npx next build --webpack`: PASS on Next.js 16.2.10. Default Turbopack cannot bind its internal sandbox port in this environment; the official Webpack build path provides the production compilation evidence.
- Local database clean reset through migration `20260721152000`: PASS, 29 pgTAP files / 451 assertions.
- Last complete `npm run test:e2e`: PASS, 65 passed / 21 expected role skips / zero failures. Targeted Platform tenant authorization/idempotency/lifecycle/subscription UI: PASS, 2/2 after the latest changes; a fresh full matrix remains queued.
- Prior hosted Vercel evidence: inert bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`; real app Preview `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn`, `READY`, `inspect.target=preview`. This Preview predates the newest local slices and must be refreshed after database verification.

Report date: 2026-07-21  
Mode: `BUILD` + authorized `STAGING_VERIFY` database work  
Environment: local Node/Supabase/Docker plus the explicitly authorized Staging Supabase database; authorized Vercel project link/Preview configuration and documented first-deployment Production classification incidents; no deployment currently remains

## Current result

M0–M2 foundation: **TESTED LOCALLY**. M3 local Session adapters, M4 menu read/mutation, M5–M8 command routes, M9 branch summary boundary and M10 hardening slices: **TESTED LOCALLY**. Full M1–M10 product matrix: **NOT COMPLETE**.

## Application evidence

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm test` — pass; 22 test files / 62 tests at the current checkpoint.
- `npm run build` — pass with Next.js static route generation.
- `npm run test:e2e` — prior full matrix passes 65 with 21 expected role-specific skips and zero failures; latest targeted Platform flow passes 2/2, including unauthenticated rejection, deterministic replay, data-preserving suspend/reactivate, manual subscription tracking and UI command serialization.
- `agent-browser` CLI was unavailable locally, so Playwright was used as the browser-verification fallback. This is recorded as a tooling limitation, not remote evidence.

## Database evidence

- Local Supabase reset applies both migrations and synthetic seed data.
- App-owned `public` schema lint passes with `--fail-on error`.
- Local security advisors pass with `--fail-on error`.
- Local pgTAP suites pass: 451/451 across 29 SQL files, including public entry, menu configuration/snapshots, Storage policy, KDS/waiter/service recovery, financial closure, settings, operations/reconciliation reports, Platform tenant lifecycle, suspended-tenant denial, invitations, Realtime publication, cross-tenant RLS, server-role grants and concurrency hardening.
- Unauthenticated `POST /api/v1/staff/menu/items/:id/availability` returns 401 before any write.
- Read-only catalog/data check confirms seeded tenant/menu rows plus explicit public/authenticated grants.
- A local schema-only portable dump of `public`, `app_private` and `auth` restored into an isolated temporary database; 28 public tables, 50 public policies and 28 RLS-enabled public tables were verified before the temporary database was removed. A public-only dump was intentionally rejected because it omitted the app-owned helper schema.
- Unscoped lint output from Supabase-managed extension/pgTAP objects is excluded from app-owned evidence.
- Test isolation note: browser flows intentionally mutate deterministic synthetic fixtures and therefore run before a fresh DB reset for pgTAP; the final 179/179 result above was run after that clean reset.

## Authorized Staging Supabase evidence

- Migration dry-run listed the reviewed 16-file timestamp order; `npx supabase db push --linked --yes` applied all 16 migrations without seed/reset/delete operations.
- `npx supabase migration list --linked` reports local and remote versions equal for all 16 migrations.
- The Staging project was confirmed empty before seed; `supabase db push --linked --include-seed --yes` then applied only the reviewed synthetic seed.
- Read-only integrity query reports 29 public tables, 52 public policies, zero public tables without RLS, zero anon privileges on sensitive tables, zero tenant-scope policy gaps, eight Realtime publication tables, zero duplicate order idempotency groups and zero orphan orders/items/payments/discounts. Seed counts: one restaurant, one branch, three menu items, two sessions, one order and one payment.
- Staging security and performance advisors reported WARN-level findings only and no ERROR-level finding. Warnings include intentionally executable scoped SECURITY DEFINER RPCs, RLS init-plan optimizations and multiple permissive policies; they remain follow-up items before a production-readiness claim.
- Vercel team/project link succeeded. Six encrypted variables remain configured for Preview. Custom `staging` target creation returned `Cannot create more than 0 custom environments`. Three first-deployment candidates were classified Production despite Preview requests and were deleted: `dpl_5UEPiviXtKjYGAT4LjRGwcH2iFAk`, `dpl_FcvnDbwLXb6D6xerNeWgK7nmhbBE`, and `dpl_7FVPyweiFt5ZrAWaYSs6nCjJKeCV`; no deployment remains. Current Vercel CLI dry-run passes after `.vercelignore`: 100 files/~0.54 MB, with zero Supabase temp metadata, tests, reports or internal docs in the upload manifest. An inert 448-byte bootstrap dry-run also passes but has not been deployed.

## Not yet evidenced

Manual screen-reader/visual review, representative device and load targets, provider backup/restore, app-level Staging Golden Path and pilot behavior remain open. The local customer and staff pages now use scoped Realtime invalidation adapters that trigger authoritative resync, with reconnect/offline states and bounded polling fallback. The named Staging Supabase schema/RLS/seed verification passes as recorded above. Hosted app verification is not claimed because Vercel requires the first deployment of the new project to be Production and no retained initialization baseline or confirmed Preview deployment exists. The local Storage drill now uploads a synthetic branch-scoped object, downloads it, copies it to a branch-scoped backup key, restores/downloads the copy and byte-compares it before cleanup; this is local object recovery evidence, not hosted provider backup evidence. Direct synthetic staff/anonymous/cashier/report/order RLS and RPC tests plus representative customer/staff HTTP success/replay pass locally; Production remains separately gated.

## Finish Line effect

Finish Line A: **NOT MET**. The database/RLS scope is `Verified in Staging`; no claim of full app `Verified in Staging`, Production Ready Candidate or Production Ready is made. Vercel hosted verification is blocked by the provider-required first-deployment bootstrap authorization; no deployment currently remains.
