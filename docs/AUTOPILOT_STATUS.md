# Autopilot Status

Last updated: 2026-07-22
Execution mode: `BUILD` plus authorized named Staging Supabase migration/RLS verification and named Vercel Preview deployment/verification
Target Finish Line: A
Production readiness: `NOT_MET`

Step 5/7 is complete locally and step 6/7 is in progress. The complete current local automated matrix passes: lint, strict typecheck, local database lint, 25 Vitest files / 73 tests, production Webpack build, 31 pgTAP files / 508 assertions, and 85 passed Playwright checks with 27 expected cross-project skips and zero failures. Fresh stateful suites explicitly reset only local synthetic Supabase, then wait for Auth/REST readiness. The current Vercel Preview is READY and its hosted public/staff-boundary route smoke now passes in the logged-in Chrome session.

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
| M11 | In progress | Verified in Staging (schema/RLS scope) | all 32 migrations, linked DB lint, 33-table/57-policy/13-Realtime verification and security error gate pass; Preview route smoke passes, hosted transactional operations and owner inputs remain |
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

- Staging Supabase `ztmftdjmtpwymfatmhjp` now has all 32 migrations through `20260721155000`; linked DB lint has no schema errors, all 33 public tables have RLS, 57 policies and 13 Realtime tables are present, 0 app SECURITY DEFINER functions lack an explicit search_path, and the security advisor error gate is clean. The sole unvalidated constraint is Supabase-managed `realtime.messages.messages_payload_exclusive` and is not an app migration defect.
- Vercel project `prj_JLBEMJVcJsR53G6uefmsVwARwgOL` retains the inert bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`. Current real-app Preview `dpl_Cio3RFsqiFndX7nD4SjwHQoJLvgN` is `READY`, `target=preview`, with build output present. Logged-in Chrome verified the hosted landing page, Supabase-synced customer menu, variant/modifier controls, and KDS/Waiter/Cashier/Admin staff-boundary routes. The customer route displayed `App reachable` / `Authoritative refresh available`, confirming the app's own `/api/health` liveness fetch; direct address navigation to the endpoint was separately blocked by the Chrome client (`ERR_BLOCKED_BY_CLIENT`), so direct endpoint transport evidence remains pending. An unintended real-app Production deployment `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2` is READY with Production aliases and must remain untouched until the owner explicitly authorizes exact remediation. Earlier Preview attempts remain blocked historical evidence.
- No real customer data, real payment, real password or paid service is used. Production remains out of scope.
- Finish Line A still needs the newest Staging schema/app Golden Path plus manual/device/accessibility/operational evidence and the release-blocking client inputs tracked in `CLIENT_INPUT_REQUIRED.md`.

## Next action

Staging migration/RLS verification and the current Preview route smoke are recorded. Continue M10/M11 with hosted transactional/operational evidence, manual device/screen-reader/usability review and owner-input gates. Keep the unintended Production deployment untouched; never use `--prod`, Promote or any Production mutation for the real app.
