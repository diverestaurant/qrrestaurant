# Changelog

All notable project changes are recorded here. This file does not prove implementation status.

## 2026-07-21 — M3–M10 local completion checkpoint

### Added

- Owner Branch lifecycle, printable Table Entry QR/immutable receipt, English-first i18n/pseudo-long architecture and staff self-profile/RLS.
- Complete local automated matrix: 73 unit tests, 508 pgTAP assertions and 85 passing Playwright checks with zero failures.
- Local-only Supabase readiness gate and hydration-transition contrast regression coverage.
- Current migration-155 portable schema restore: 33 public tables, 57 policies, 33 RLS-enabled tables, zero RLS gaps and safe definer `search_path` checks.
- Per-request production nonce CSP/security headers and private menu-image intent/verification boundary, including rejection and cleanup of a script payload disguised as PNG.
- Explicit fresh-state commands for local pgTAP and Playwright suites so stateful evidence cannot contaminate later assertions.
- Correlation-scoped application liveness/Supabase readiness plus privacy-safe structured logger redaction.

### Scope boundary

- The newest 16 migrations and current app have not yet been verified in Staging. Real app Production deployment remains prohibited.

## 2026-07-21 — BUILD local hardening

### Added

- Concurrency hardening plus private Storage bucket/policy pgTAP coverage and server-only idempotency/membership grant regressions: 27 new assertions, bringing local database evidence to 102/102 across eleven SQL files.
- Playwright M10 hardening suite for 320px role surfaces, keyboard focus/action names, browser offline → online recovery and a local menu latency smoke budget; full local E2E now reports 49 passed and 9 expected role-specific skips, including staff menu/Session/order/service/KDS/payment success/replay, report-read and branch-scoped Storage lifecycle evidence.
- Synthetic anonymous customer and runtime-created staff Auth E2E for Join, order/service, menu availability and Session success/replay.
- Portable schema-only local backup/restore rehearsal covering `public`, `app_private` and `auth`, with isolated RLS/policy verification.

### Scope boundary

- No remote Preview, Staging, Production, Vercel or Supabase project was accessed or modified.
- Hosted backup/Storage, Realtime, full HTTP success/replay and representative device/load evidence remain open.

## 2026-07-20 — BUILD local foundation

### Added

- Pinned local Next.js/React/TypeScript/Supabase application baseline.
- Local App Router role shells, typed contracts, domain guards, unit tests and Playwright checks.
- Local Supabase migrations, synthetic seed data, explicit grants, RLS, storage policy and pgTAP baseline.
- Independent UI/UX Design Subagent Foundation Gate report.

### Scope boundary

- No remote Preview, Staging, Production, Vercel or Supabase project was accessed or modified.
- M0–M2 are tested locally; M3 Session adapters, M4 menu, M5–M8 command routes, M9 report boundary and M10 hardening slices are tested locally; full product matrix remains in progress.

## 2026-07-20 — PLAN_ONLY planning baseline

### Added

- Master Prompt v3 authorization corrections.
- M0 greenfield audit and project index.
- Master Plan and frozen proposed V1 scope.
- Architecture, database, authorization, state, API and Realtime designs.
- Complete role-based UI/UX planning set.
- Security, data lifecycle, testing, observability, deployment, backup/recovery and release plans.
- ADR, current task/status, Finish Line, handover and context files.

### Explicitly not added

- Application/package source.
- Database schema or migrations.
- Seed or real data.
- Automated tests or CI.
- Supabase/Vercel projects/configuration.
- Staging/Production/Pilot changes.

### Status

Design documentation only. Production readiness is not met.
