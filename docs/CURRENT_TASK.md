# Current Task

Mode: `BUILD` plus authorized named Staging Supabase/Vercel Preview work
Milestone: M10–M11 — Staging rehearsal and release-candidate evidence
Status: In progress; step 5/7 complete locally, step 6/7 in progress

## Objective

Advance Finish Line A without touching Production: checkpoint the fully passing local M3–M9 implementation, apply only reviewed additive migrations to the named Staging Supabase project, verify RLS/isolation/integrity, deploy the current real app only as Vercel Preview, then complete hosted Golden Path and remaining M10/M11 evidence.

## Current authoritative evidence

- Local database reset applies 32 migrations through `20260721155000_staff_self_profile.sql`.
- pgTAP: 31 SQL files / 508 assertions pass.
- Vitest: 24 files / 72 tests pass.
- Playwright: 110 total, 83 pass / 27 expected role-project skips / 0 failures from a fresh local reset.
- Lint, strict typecheck, local Supabase database lint and `next build --webpack` pass.
- Production runtime CSP uses per-request nonces: all 17 rendered nonce tags matched the response nonce, production `script-src` omitted `unsafe-inline`, and `x-powered-by` was absent.
- Dependency gate: zero high/critical findings; two evaluated moderate Next.js-vendored PostCSS findings remain without a safe non-breaking package fix.
- Independent UI/UX Design Subagent review is complete; latest GREEN/YELLOW work stayed within the approved Master Plan architecture.

## Locally complete V1 capability slices

- Customer Session join, public menu, variant/modifier cart, authoritative price recheck/submit/add order, tracking and service requests.
- Repository-backed KDS, Waiter, Cashier and Admin workflows with scoped Realtime invalidation and authoritative resync.
- Discounts, multiple manual tenders, immutable receipt/reprint, Session close and reconciliation.
- Restaurant, Branch and Platform lifecycle/settings; menu/staff/table/station/flag administration; reports and masked audit viewer.
- Printable secure QR and receipt surfaces.
- English-first locale contract, `zh/ms` safe fallback and pseudo-long responsive QA.
- Versioned staff self-profile with self-only RLS and privacy-safe audit/outbox.
- Local accessibility, 320px, offline/reconnect, concurrency, 30-request burst and Storage object backup/restore automation.
- Authorized private menu-image upload intents with server-side byte count, JPEG/PNG/WebP signature and 4096 × 4096 dimension verification before metadata publication.

## Next executable work

1. Commit the current reviewed local slice and evidence.
2. Show the pending migration order `20260721140000` through `20260721155000` and summarize additive/locking/security risks.
3. Run linked Staging dry-run, then push only those migrations under the existing `migration-RLS` authorization; do not seed over existing data, reset or delete.
4. Verify migration history, RLS coverage, cross-tenant isolation, grants, Realtime publication and basic data integrity on the named Staging project.
5. Deploy the current app only to Vercel Preview, verify `inspect.target=preview`, run hosted health/public/customer/staff authorization Golden Paths and preserve the previous inert bootstrap.
6. Continue M10/M11 manual device/screen-reader/usability, hosted backup/restore/observability and release-input evidence.

## Boundaries

- Never use `--prod`, Promote or any Production mutation for the real app.
- Never reset/delete Staging data or use a destructive migration without new explicit approval.
- Never use real customer data, real payments, real passwords or paid services.
- Finish Line A remains `NOT_MET` until hosted and manual/operational gates are evidenced.
