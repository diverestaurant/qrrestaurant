# Autopilot Status

Last updated: 2026-07-21
Execution mode: `BUILD` plus authorized named Staging Supabase migration/RLS verification and named Vercel Preview deployment/verification
Target Finish Line: A
Production readiness: `NOT_MET`

Step 5/7 is complete locally and step 6/7 is in progress. The complete current local automated matrix passes: lint, strict typecheck, local database lint, 25 Vitest files / 73 tests, production Webpack build, 31 pgTAP files / 508 assertions, and 85 passed Playwright checks with 27 expected cross-project skips and zero failures. Fresh stateful suites explicitly reset only local synthetic Supabase, then wait for Auth/REST readiness.

## Delivery status

| Milestone | Status | Delivery label | Evidence |
|---|---|---|---|
| M0 | Complete | Tested Locally | pinned runtime, local workflow and build baseline |
| M1 | Complete | Tested Locally | strict App Router foundation, typed boundaries, five role shells and independent UI gate |
| M2 | Complete | Tested Locally | 32 additive migrations, explicit grants, RLS, Storage and 508 pgTAP assertions |
| M3 | Complete locally | Tested Locally | Restaurant/Branch lifecycle and settings, staff invite/membership/self-profile, tables, QR, Session and Join Code capabilities |
| M4 | Complete locally | Tested Locally | full menu/variant/modifier/image/availability/station administration and immutable order snapshots |
| M5 | Complete locally | Tested Locally | table entry, Session join, menu/cart/configuration, authoritative submit/add order, tracking and service requests |
| M6 | Complete locally | Tested Locally | repository KDS, item workflow, station/unassigned/recent queues, SLA, sound/visual fallback, density and reconnect/resync |
| M7 | Complete locally | Tested Locally | table/session dashboard, assisted order, partial serving, service inbox, payment handoff and cleaning recovery |
| M8 | Complete locally | Tested Locally | discounts, multi-tender manual payment, receipts/reprint, close and reconciliation |
| M9 | Complete locally | Tested Locally | full V1 Admin, Branch/Platform lifecycle, reports, audit viewer, flags, print and English-first i18n architecture |
| M10 | In progress | Tested Locally (automated scope) | full automated matrix passes; manual screen-reader/device/usability and final independent review evidence remain |
| M11 | In progress | Tested Locally (restore scope) | current 33-table/57-policy schema restore and synthetic Storage byte-compare pass; newest Staging migrations, fresh Preview, hosted operations and owner inputs remain |
| M12 | Not authorized | Designed | Production and Pilot require separate RELEASE/PILOT authorization |

## Latest completed slices

- Owner-only Branch creation/suspend/reactivate with last-active guard and automatic QR/customer-grant revocation.
- Printable one-time Table Entry QR and immutable receipt/reprint pages with print-only CSS.
- English launch catalog, safe `zh/ms` English fallback and QA-only 30–50% pseudo-long layout mode.
- RLS-protected, versioned staff self-profile with masked audit/outbox facts.
- Strict per-request nonce CSP, production security headers and hidden framework signature; all rendered nonce tags matched the response header in the production runtime smoke.
- Menu-image UI no longer imports a database/Storage client. A scoped server intent authorizes direct private upload, then server verification rejects MIME disguises, invalid dimensions and byte-count mismatches before metadata commit.
- Health now separates cheap app liveness from an explicit bounded Supabase readiness probe. Both return opaque correlation IDs; structured logs add environment/release fields and redact sensitive context keys.
- Hydration-transition contrast defect fixed; repeated axe verification passed 10/10 before the clean full matrix passed.
- `npm audit --audit-level=high` reports zero high/critical findings. Two moderate findings are Next.js-vendored build-time PostCSS; the proposed force fix is a breaking downgrade and was not applied.

## External state and remaining gates

- Staging Supabase `ztmftdjmtpwymfatmhjp` has the previously reviewed first 16 migrations. Sixteen newer additive local migrations (`20260721140000`–`20260721155000`) still require reviewed dry-run, push and post-migration RLS/isolation/integrity verification.
- Vercel project `prj_JLBEMJVcJsR53G6uefmsVwARwgOL` retains the explicitly authorized inert bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN` and prior real Preview `dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn` (`READY`, `target=preview`). The Preview predates the newest slices and must be refreshed without `--prod` or Promote.
- No real customer data, real payment, real password or paid service is used. Production remains out of scope.
- Finish Line A still needs the newest Staging schema/app Golden Path plus manual/device/accessibility/operational evidence and the release-blocking client inputs tracked in `CLIENT_INPUT_REQUIRED.md`.

## Next action

Checkpoint `8d13585` is complete. Obtain refreshed current-session authorization accepted by the remote tool boundary, then present/confirm the exact 16-migration order, execute the Staging dry-run/push/verification and deploy only a fresh Vercel Preview. Continue M10/M11 after hosted evidence; never use `--prod` or Promote for the real app.
