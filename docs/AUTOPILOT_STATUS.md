# Autopilot Status

Last updated: 2026-07-21  
Execution mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel staging deployment work  
Target Finish Line: A  
Production readiness: `NOT_MET`

Checkpoint 4/7: lint/typecheck, 22 unit-test files (62 tests) and Webpack production build pass. Database runtime evidence passes through migration `20260721143000` (21 pgTAP files / 263 assertions); migrations `144000`–`148000` are implemented with pgTAP coverage but are not yet runtime-verified because the current sandbox cannot access the Docker socket. The inert Vercel Production bootstrap and inspect-confirmed real Preview both exist; no real app was promoted to Production.

## Current milestone

M3–M10 — Core command slices and local hardening

## Delivery status

| Milestone | Status | Delivery label | Evidence |
|---|---|---|---|
| M0 | Complete | Tested Locally | package/runtime validation, local Supabase and build baseline |
| M1 | Complete | Tested Locally | App Router, typed contracts, role shells, local browser checks |
| M2 | Complete | Tested Locally | migrations, grants, RLS, storage policy, pgTAP and advisors |
| M3 | In progress | Implemented / Tested Locally (local adapters) | staff Session open API, transactional Session/hashed Join Code RPC, anonymous-claim join/grant RPC and RLS/validation tests |
| M4 | In progress | Implemented / Tested Locally (repository read + mutation boundary) | local public menu repository/API/page, malformed/unauthenticated staff boundaries, synthetic staff RLS, idempotency and audit/outbox trigger |
| M5 | In progress | Implemented / Tested Locally (local API/UI slice) | grant-bound customer order pricing/snapshots, variant/modifier selection and authoritative configuration snapshots, Customer Join Code/cart/order tracking/service-request UI, customer service requests, waiter transitions, RLS and server-only idempotency |
| M6 | In progress | Implemented / Tested Locally (local API) | KDS order-item transition API, state/version guard and idempotency |
| M7 | In progress | Implemented / Tested Locally (local API) | waiter service-request transition API, state/version guard and idempotency |
| M8 | In progress | Implemented / Tested Locally (atomic local RPC/API) | cashier payment confirmation, allocation, paid-total update and RLS |
| M9 | In progress | Implemented / Tested Locally (report boundary) | branch summary report RPC/API and tenant isolation |
| M10 | In progress | Implemented / Tested Locally | 179 DB assertions, 58 passed browser checks with 16 expected skips, 43 unit assertions, scoped customer Session and staff Branch Realtime adapters with authoritative resync/reconnect/polling fallback, server-only staff repository snapshots, discount/multi-tender/receipt/close recovery, local Storage object backup/restore, synthetic 30-request menu read burst and portable schema restore evidence; Staging DB scope is Verified in Staging: 16/16 migrations, 29 RLS-enabled public tables, 52 policies, 8 Realtime tables and integrity checks passing; provider backup/restore and full device/app-Staging evidence remain |

## UI Foundation Gate

The independent UI/UX Design Subagent completed the required review. Result: conditional pass for contract-preserving GREEN local work. Five role shells, mobile/desktop Golden Paths and recovery-state boundaries are coherent. Remaining UI gates include real device coverage, accessibility/manual review, localization, performance and usability evidence.

The UI Architecture Impact Warning remains active: visual/token/layout changes are GREEN; additive shared state/dependencies are YELLOW; QR authorization, session grants, money, offline auto-submit, schema, RLS, permissions and state-machine changes are RED.

## Environment constraints

- The named Staging Supabase project was accessed and modified only under the explicit migration-RLS authorization. Vercel now retains one explicitly authorized inert 448-byte Production bootstrap (`dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN`) and an inspect-confirmed real application Preview (`dpl_9ZDvXRQqKjARWiVyiZ386sZszuNn`, `target=preview`, `READY`). The real app has not been promoted to Production.
- No real customer data, payment, password or paid service was used.
- Local Supabase uses synthetic seed data and local-only keys.

## Remaining external gates

- Full `Verified in Staging` still requires the newest migrations/UI to pass the complete local matrix, be pushed within the reviewed migration-RLS scope, and pass a fresh Preview Golden Path. The earlier Preview baseline is verified but predates the newest local slices.
- Pilot validation requires owner-approved participants, device/Wi-Fi model and operational inputs.

## Next actions

Continue authorized local work with M10 manual accessibility/device/visual/load and operational backup evidence. For Vercel, obtain exact authorization to create and retain one inert first-deployment Production bootstrap with domain assignment disabled; then deploy the real app as Preview and require `inspect.target=preview` before browser verification. Keep Finish Line A `NOT_MET` until all local and hosted acceptance evidence exists.
