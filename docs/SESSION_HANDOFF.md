# Session Handoff

Last updated: 2026-07-21
Branch: `codex/staging`
Execution: continue; do not restart or discard changes

## Resume point

Step 5/7 is complete locally. Resume at step 6/7: checkpoint the current fully passing slice, then run the reviewed Staging Supabase migration/RLS rehearsal and a fresh Vercel Preview Golden Path. Do not stop after the commit or deploy the real app to Production.

## Current local evidence

- 32 migrations through `20260721155000_staff_self_profile.sql` reset cleanly.
- 31 pgTAP files / 508 assertions pass.
- 23 Vitest files / 68 tests pass.
- Full Playwright matrix: 108 total, 81 passed / 27 expected cross-project skips / 0 failures.
- Lint, strict typecheck and Next.js 16.2.10 Webpack production build pass.
- `npm audit --audit-level=high`: zero high/critical; two evaluated moderate Next.js-vendored build-time PostCSS findings.

## Latest implemented work

- Owner Branch create/suspend/reactivate with version guard, last-active protection and QR/customer-grant revocation.
- Printable one-time Table Entry QR and immutable receipt/reprint route.
- English launch catalog, safe `zh/ms` fallback and QA pseudo-long responsive preview.
- Versioned staff self-profile with self-only RLS, idempotent route and masked audit/outbox.
- Local-only Supabase readiness gate before E2E.
- Hydration contrast defect fixed; targeted axe 10/10 and fresh full matrix pass.

All prior Customer, KDS, Waiter, Cashier, Admin, pricing, multi-tender, receipt, close, report, Realtime, offline, Storage and tenant-isolation slices remain implemented and covered by the current matrix.

## External state

- Supabase Staging: `ztmftdjmtpwymfatmhjp`. Remote has the previously reviewed first 16 migrations; local has 16 additional migrations from `20260721140000` through `20260721155000` awaiting dry-run/push/verification.
- Vercel team/project: `dive-restaurant` / `prj_JLBEMJVcJsR53G6uefmsVwARwgOL`.
- Retained inert bootstrap: `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`.
- Prior real Preview: `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn`, `READY`, `target=preview`; it predates current code.
- Never use `--prod`, Promote, Production mutation, destructive Staging reset/delete, real customer/payment/password data or paid services.

## Exact next sequence

1. Safe Git checkpoint of current source/tests/docs.
2. Present pending migration order and risk summary.
3. Linked Staging migration dry-run; apply only reviewed migrations; no seed overwrite/reset/delete.
4. Verify remote migration history, all exposed tables RLS, grants, tenant isolation, Realtime publication and integrity.
5. Deploy current app only as Vercel Preview; verify `inspect.target=preview` and hosted Golden Path.
6. Continue M10/M11 manual accessibility/device/usability, hosted backup/restore/observability and owner-input gates.

## Do not claim yet

Finish Line A, full app Verified in Staging, Production Ready Candidate, Deployed to Production, Pilot Validated and Production Ready are not yet achieved.
