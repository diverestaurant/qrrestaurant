# Current Task

Mode: `BUILD` plus authorized named Staging Supabase/Vercel Preview work
Milestone: M10–M11 — Staging rehearsal and release-candidate evidence
Status: In progress; local step 5/7 and Staging schema/RLS step 6/7 complete; current Vercel Preview route smoke passes, hosted transactional/operational evidence remains

## Objective

Advance Finish Line A without touching Production: checkpoint the fully passing local M3–M9 implementation, apply only reviewed additive migrations to the named Staging Supabase project, verify RLS/isolation/integrity, verify the current real app only as Vercel Preview, then complete hosted Golden Path and remaining M10/M11 evidence.

## Current authoritative evidence

- Local database reset and named Staging now apply 32 migrations through `20260721155000_staff_self_profile.sql`.
- pgTAP: 31 SQL files / 508 assertions pass.
- Vitest: 25 files / 73 tests pass.
- Playwright: 112 total, 85 pass / 27 expected role-project skips / 0 failures from a fresh local reset.
- Lint, strict typecheck, local Supabase database lint and `next build --webpack` pass.
- Production runtime CSP uses per-request nonces: all 17 rendered nonce tags matched the response nonce, production `script-src` omitted `unsafe-inline`, and `x-powered-by` was absent.
- Liveness plus dependency readiness (`application` + Supabase Data API/DB/RLS) return no-store, correlation-scoped responses; logger fields are automatically redacted for common secrets and PII.
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

1. Checkpoint `8d13585` preserves the current reviewed local source, tests and evidence with a clean worktree.
2. Obtain refreshed current-session authorization accepted by the remote tool boundary; the previous attempt was denied against a stale `EXTERNAL_SCOPE=NONE` snapshot before any remote access.
3. Use the reviewed migration order/risk record already shown in this handoff; no seed, reset or delete was used.
4. Verify migration history, RLS coverage, grants, Realtime publication and basic data integrity on the named Staging project — complete for schema/RLS scope.
5. Verify the current Preview `dpl_Cio3RFsqiFndX7nD4SjwHQoJLvgN` is `READY` with `target=preview`, then run hosted public/customer/staff-boundary smoke — complete for route scope.
6. Resolve the remaining hosted health/transactional/operational evidence without submitting real orders or using real credentials; the browser `/api/health` navigation was blocked by `ERR_BLOCKED_BY_CLIENT`.
7. Continue M10/M11 manual device/screen-reader/usability, hosted backup/restore/observability and release-input evidence.

## Boundaries

- Never use `--prod`, Promote or any Production mutation for the real app.
- Never reset/delete Staging data or use a destructive migration without new explicit approval.
- Never use real customer data, real payments, real passwords or paid services.
- Finish Line A remains `NOT_MET` until the hosted transactional Golden Path, manual/operational evidence and owner gates are evidenced.
