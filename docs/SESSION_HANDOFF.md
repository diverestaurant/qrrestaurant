# Session Handoff

Last updated: 2026-07-21
Branch: `codex/staging`
Execution: continue; do not restart or discard changes

## Resume point

Local step 5/7 and Staging schema/RLS step 6/7 are complete. Resume by resolving the exact Vercel Preview team-access gate and obtaining owner direction for unintended Production deployment `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2`; never deploy or modify Production without that direction.

## Current local evidence

- 32 migrations through `20260721155000_staff_self_profile.sql` reset cleanly.
- 31 pgTAP files / 508 assertions pass.
- 25 Vitest files / 73 tests pass.
- Fresh full Playwright matrix: 112 total, 85 passed / 27 expected cross-project skips / 0 failures.
- Lint, strict typecheck, local Supabase DB lint and Next.js 16.2.10 Webpack production build pass.
- Production runtime CSP smoke: response nonce present; 17/17 rendered nonce tags matched; no script `unsafe-inline`; no `x-powered-by`.
- `npm audit --audit-level=high`: zero high/critical; two evaluated moderate Next.js-vendored build-time PostCSS findings.
- Current isolated schema restore: 33 public tables, 57 policies, 33 RLS tables, zero RLS gaps, 43 definer functions and zero missing explicit `search_path`; temporary database removed.

## Latest implemented work

- Owner Branch create/suspend/reactivate with version guard, last-active protection and QR/customer-grant revocation.
- Printable one-time Table Entry QR and immutable receipt/reprint route.
- English launch catalog, safe `zh/ms` fallback and QA pseudo-long responsive preview.
- Versioned staff self-profile with self-only RLS, idempotent route and masked audit/outbox.
- Local-only Supabase readiness gate before E2E.
- Hydration contrast defect fixed; targeted axe 10/10 and fresh full matrix pass.
- UI-to-Storage architecture violation removed. Server-scoped image intent plus post-upload byte/signature/4096px verification now gates image metadata; disguised PNG rejection passes E2E.
- `db:test:fresh` and `test:e2e:fresh` isolate stateful suites with explicit local-only resets.
- Health separates liveness from a bounded Supabase readiness probe and returns correlation-scoped no-store responses; logger sensitive-key redaction has unit coverage.

All prior Customer, KDS, Waiter, Cashier, Admin, pricing, multi-tender, receipt, close, report, Realtime, offline, Storage and tenant-isolation slices remain implemented and covered by the current matrix.

## External state

- Supabase Staging: `ztmftdjmtpwymfatmhjp`. All 32 migrations through `20260721155000` are applied; linked DB lint, 33-table/57-policy/13-Realtime RLS verification and security advisor error gate pass. The only unvalidated constraint is Supabase-managed `realtime.messages.messages_payload_exclusive`.
- Vercel team/project: `dive-restaurant` / `prj_JLBEMJVcJsR53G6uefmsVwARwgOL`. Explicit Preview deployments `dpl_7cKdFjoyvvhBYeGChnXxtiTKKCtm` and `dpl_HnyyYCHyGUvjK1naNV8xf3jWLqxR` are `BLOCKED` before build because `oscar@Oscars-MacBook-Pro.local` lacks team access. Unintended Production deployment `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2` is `READY`; do not modify without exact owner authorization.
- Retained inert bootstrap: `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`.
- Prior real Preview: `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn`, `READY`, `target=preview`; it predates current code.
- Never use `--prod`, Promote, Production mutation, destructive Staging reset/delete, real customer/payment/password data or paid services.

## Exact next sequence

1. Staging migration/RLS verification is complete and recorded.
2. Resolve Vercel team-access identity for the current commit author or add that identity to team `dive-restaurant`.
3. Obtain exact owner authorization before deleting/rolling back only `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2`.
4. Deploy with explicit `--target=preview --skip-domain`, verify `READY` and `inspect.target=preview`, then run hosted Golden Path.
5. Continue M10/M11 manual accessibility/device/usability, hosted backup/restore/observability and owner-input gates.

## Do not claim yet

Finish Line A, full app Verified in Staging, Production Ready Candidate, Deployed to Production, Pilot Validated and Production Ready are not yet achieved.
