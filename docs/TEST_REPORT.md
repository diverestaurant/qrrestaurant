# Test Report

Report date: 2026-07-21
Environment: local synthetic Supabase/Next.js plus previously authorized named Staging evidence
Current result: M0–M9 **TESTED LOCALLY**; M10 automated scope **TESTED LOCALLY**; full Finish Line A **NOT COMPLETE**

## Latest local matrix

| Gate | Result | Evidence |
|---|---|---|
| Lint | PASS | `eslint .` |
| TypeScript | PASS | strict `tsc --noEmit` |
| Unit/domain | PASS | 23 Vitest files / 68 tests |
| Database | PASS | clean reset through migration `20260721155000`; 31 pgTAP files / 508 assertions |
| Browser/E2E | PASS | 108 total: 81 passed / 27 expected cross-project skips / 0 failed |
| Production compile | PASS | Next.js 16.2.10 `next build --webpack`; 17 static pages generated and all current dynamic routes compiled |
| Dependency high/critical gate | PASS | `npm audit --audit-level=high`: 0 high, 0 critical; 2 moderate build-time PostCSS findings |

The browser matrix covers customer join/order/replay/tracking/service requests and scoped Realtime resync; repository-backed KDS/Waiter/Cashier/Admin; role and unauthenticated boundaries; Branch/Platform lifecycle; settings/Profile/i18n; discount/multi-tender/receipt/close/reconciliation; QR and receipt print; WCAG axe scans; keyboard focus; 320px overflow; offline/reconnect; a 30-request read burst; and synthetic Storage backup/restore.

## Regression findings closed in this checkpoint

- Axe intermittently observed the Customer Join button while its hydration-driven disabled-to-enabled color transition was mid-animation (`2.89:1`). Removing that color transition made the enabled state immediately compliant. Repeated targeted verification passed 10/10 and the fresh full matrix passed.
- Fresh Supabase reset could return before Auth/PostgREST were application-ready. `pretest:e2e` now runs a localhost-only readiness gate; it rejects remote URLs and waits for both local Auth health and an authenticated REST read before Playwright starts.

## Database/security evidence

- All 32 migrations are additive; the current reset does not require destructive data operations.
- Profile migration 155 enables RLS, grants authenticated users self-read only, revokes raw writes, validates active permanent staff scope in a narrow guarded function, uses optimistic versioning, and omits display names from audit/outbox payloads.
- Full pgTAP coverage includes explicit grants, RLS/cross-tenant isolation, anonymous-vs-staff boundaries, QR/Join Code grants, menu/pricing snapshots, state/version conflicts, payments/receipts/close, settings/reports, Branch/Platform lifecycle, Realtime publication, Storage and concurrency.
- App-owned migration/reset and pgTAP pass. Supabase-managed extension warnings are not counted as app defects.

## Dependency advisory assessment

`npm audit` reports two moderate findings for PostCSS vendored inside Next.js. The app does not accept or transform user-provided CSS at runtime; this PostCSS path is build-time tooling. `npm audit fix --force` proposes a breaking downgrade to Next 9.3.3, so it is rejected. Track the upstream patched Next.js release and upgrade through the pinned dependency review instead of forcing an unsafe downgrade.

## Existing Staging evidence

- The named Staging Supabase project previously matched the first 16 reviewed migrations and passed RLS/tenant/integrity checks with synthetic seed only.
- Vercel retains the explicitly authorized inert bootstrap and an earlier real Preview that was `READY` with `inspect.target=preview`.
- This hosted evidence predates migrations `20260721140000`–`20260721155000` and the newest application slices; it is not current Finish Line evidence.

## Current local restore evidence

- A schema-only dump of `public`, `app_private` and local `auth` restored into an isolated temporary database after removing provider-specific ownership/default-privilege statements.
- Verification found 33 public tables, 57 public policies, 33 RLS-enabled tables, zero public tables without RLS, 43 `SECURITY DEFINER` functions and zero such functions without explicit `search_path`; the temporary database was then removed.
- The browser Storage drill separately verifies synthetic object copy/restore and byte equality. This is not hosted provider backup evidence.

## Remaining evidence

- Reviewed push and verification of the 16 pending migrations on the named Staging project.
- Fresh Vercel Preview and hosted Golden Path against the updated Staging schema.
- Manual screen-reader, real target-device/browser, glare/noise/print/usability review and final independent UI sign-off.
- Hosted/provider backup/restore, observability/alert drill, agreed load model, operational owners and release-blocking business inputs.

Finish Line A remains **NOT MET**. No Production Ready Candidate, Production deployment or Pilot claim is made.
