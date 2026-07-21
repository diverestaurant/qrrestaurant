# Autopilot Status

Last updated: 2026-07-21  
Execution mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Target Finish Line: A  
Production readiness: `NOT_MET`

Checkpoint 4/7 is committed and step 5/7 is in progress. Lint/typecheck, 22 unit-test files (62 tests), Webpack production build and the prior full Playwright matrix (65 passed / 21 expected skips / zero failures) pass; the new Platform slice passes targeted Playwright 2/2. A clean local reset applies 29 migrations through `20260721152000`; 29 pgTAP files / 451 assertions pass. The inert Vercel Production bootstrap and inspect-confirmed real Preview both exist; no real app was promoted to Production.

## Current milestone

M3–M10 — Core command slices and local hardening

## Delivery status

| Milestone | Status | Delivery label | Evidence |
|---|---|---|---|
| M0 | Complete | Tested Locally | package/runtime validation, local Supabase and build baseline |
| M1 | Complete | Tested Locally | App Router, typed contracts, role shells, local browser checks |
| M2 | Complete | Tested Locally | migrations, grants, RLS, storage policy, pgTAP and advisors |
| M3 | In progress | Implemented / Tested Locally (local adapters/settings) | staff Session open API, transactional Session/hashed Join Code RPC, anonymous-claim join/grant RPC, versioned Restaurant/Branch settings and RLS/validation tests; branch lifecycle/self-profile remain |
| M4 | In progress | Implemented / Tested Locally (repository read + mutation boundary) | local public menu repository/API/page, malformed/unauthenticated staff boundaries, synthetic staff RLS, idempotency and audit/outbox trigger |
| M5 | In progress | Implemented / Tested Locally (local API/UI slice) | grant-bound customer order pricing/snapshots, variant/modifier selection and authoritative configuration snapshots, Customer Join Code/cart/order tracking/service-request UI, customer service requests, waiter transitions, RLS and server-only idempotency |
| M6 | In progress | Implemented / Tested Locally (local API) | KDS order-item transition API, state/version guard and idempotency |
| M7 | In progress | Implemented / Tested Locally (local API) | waiter service-request transition API, state/version guard and idempotency |
| M8 | In progress | Implemented / Tested Locally (atomic local RPC/API) | cashier payment confirmation, allocation, paid-total update and RLS |
| M9 | In progress | Implemented / Tested Locally (administration/report boundaries) | branch summary plus bounded operations/reconciliation reports, Platform-only tenant lifecycle/manual subscription tracking, tenant isolation and guarded concurrent UI commands; print/i18n remain |
| M10 | In progress | Implemented / Tested Locally | 451 DB assertions, prior full 65-pass browser matrix plus targeted Platform 2/2, 62 unit assertions, scoped Realtime/resync/reconnect, repository-backed role apps, financial closure, WCAG automation, 320px layouts, local Storage backup/restore, 30-request load burst and portable schema restore evidence; fresh full browser matrix, manual devices, final UI review and app-Staging evidence remain |

## UI Foundation Gate

The independent UI/UX Design Subagent completed the required review. Result: conditional pass for contract-preserving GREEN local work. Five role shells, mobile/desktop Golden Paths and recovery-state boundaries are coherent. Remaining UI gates include real device coverage, accessibility/manual review, localization, performance and usability evidence.

The UI Architecture Impact Warning remains active: visual/token/layout changes are GREEN; additive shared state/dependencies are YELLOW; QR authorization, session grants, money, offline auto-submit, schema, RLS, permissions and state-machine changes are RED.

## Environment constraints

- The named Staging Supabase project was accessed and modified only under the explicit migration-RLS authorization. Vercel now retains one explicitly authorized inert 448-byte Production bootstrap (`dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`) and an inspect-confirmed real application Preview (`dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn`, `target=preview`, `READY`). The real app has not been promoted to Production.
- No real customer data, payment, password or paid service was used.
- Local Supabase uses synthetic seed data and local-only keys.

## Remaining external gates

- Full `Verified in Staging` still requires the newest migration set to be pushed within the reviewed migration-RLS scope and a fresh Preview Golden Path. The complete local matrix now passes; the earlier Preview baseline predates the newest local slices.
- Pilot validation requires owner-approved participants, device/Wi-Fi model and operational inputs.

## Next actions

Continue authorized local work with remaining M3/M9 setup/reporting/i18n scope and M10 manual accessibility/device/visual/load/operational evidence. Then push only reviewed migrations to the named Staging Supabase project and deploy only a real Preview, requiring `inspect.target=preview`. Keep Finish Line A `NOT_MET` until all local and hosted acceptance evidence exists.
