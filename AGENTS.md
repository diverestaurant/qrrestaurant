# Dive Restaurant project instructions

## Current authority

- Current execution mode: `BUILD` + authorized `STAGING_VERIFY` database and Vercel deployment work.
- Authorized path: `/Users/oscar/Documents/QR restaurant odering system`.
- External scope: named Staging Supabase only for migrations, RLS, indexes, constraints, approved synthetic seed, verification and the explicitly authorized Anonymous Sign-Ins setting; Vercel team `dive-restaurant`, project `prj_JLBEMJVcJsR53G6uefmsVwARwgOL` only for link, Preview environment configuration/deployment/verification and the explicitly authorized retained 448-byte Production bootstrap.
- Local application source, migrations, RLS, tests, configuration and docs may be created/modified under the authorized path because the user explicitly authorized `BUILD`.
- Do not deploy/promote the real application to Production, modify the inert bootstrap, access unrelated Preview/Vercel/Supabase projects, reset/delete Staging data, use destructive migrations, or configure the final custom domain without explicit authorization.
- The governing product prompt is `DIVE_RESTAURANT_AUTOPILOT_MASTER_PROMPT_V3.md`.

## Session startup order

Read only what the current task needs, in this order:

1. `AGENTS.md`
2. `docs/PROJECT_INDEX.md`
3. `docs/AUTOPILOT_STATUS.md`
4. `docs/CURRENT_TASK.md`
5. ADRs and architecture documents referenced by the current task
6. Directly relevant source, migrations, and tests once those exist

Do not scan unrelated projects, personal notes, or the whole workspace by default.

## Facts and claims

Evidence priority:

1. Running environment evidence and migration state
2. Source code, migrations, RLS policies, and automated tests
3. CI/deployment artifacts
4. ADRs, Master Plan, and test reports
5. Status documents and chat summaries

This repository contains local implementation slices and documentation. Never describe a feature as implemented, tested, deployable, or production-ready without corresponding higher-priority evidence.

Use only these delivery labels:

- Designed
- Implemented
- Tested Locally
- Verified in Staging
- Production Ready Candidate
- Deployed to Production
- Pilot Validated
- Production Ready

## Architecture guardrails for BUILD

- Use TypeScript strict mode and a layered modular monolith unless an ADR changes it.
- Dependency direction is UI → typed contract → application → domain → infrastructure.
- Domain code must not import React, Next.js, Supabase clients, or UI packages.
- UI must not import database clients, repositories, migrations, or server-only infrastructure.
- Store money as integer minor units; the server-side Pricing Engine is authoritative.
- Enforce tenant scope at database level with constraints, explicit grants, and RLS.
- Never rely on UI, Proxy/Middleware, route hiding, or an unguessable URL as authorization.
- Never expose a Supabase secret/service-role key to client code.
- Staff and customer commands must re-authorize, validate state/version, and be idempotent.
- Realtime is a notification accelerator; database commits are the source of truth.
- Preserve immutable order, price, payment, receipt, and audit snapshots.

## Supabase guardrails for BUILD

- Re-check the Supabase changelog and official docs before implementation.
- New tables are not assumed to be automatically exposed to the Data API; use explicit grants.
- Enable RLS on every table in an exposed schema.
- Anonymous Auth users use the `authenticated` Postgres role; distinguish them with trusted JWT `is_anonymous` claims plus current customer session grants.
- Do not authorize using user-editable metadata.
- Default database functions to `SECURITY INVOKER`.
- If `SECURITY DEFINER` is strictly required, keep it narrowly scoped, use an empty/fixed `search_path`, fully qualify relations, revoke `PUBLIC` execute, grant only intended roles, and test the bypass boundary.
- Create views with `security_invoker = true` or keep them out of exposed schemas.
- Run database advisors and the RLS policy matrix before marking M2 complete.

## Next.js guardrails for BUILD

- Re-check the current stable patched Next.js/React versions before scaffolding; do not use canary for production.
- Use App Router and Server Components by default; push Client Components to interactive leaves.
- Treat Server Actions and Route Handlers as public security boundaries and authorize inside each command.
- Proxy may do optimistic redirect/context checks but is never the only authorization layer.
- Keep database/SDK initialization lazy and server-only.
- Use dynamic rendering for identity-specific anonymous customer data; never share cached customer/session data across users.
- Pin dependency versions and commit the lockfile.

## UI architecture impact

The warning system applies to UI-originated architectural changes, not backend work already approved in the Master Plan.

- GREEN: contract-preserving visual work; proceed in BUILD with tests.
- YELLOW: new backward-compatible fields, shared state, dependencies, analytics, or cross-role components; warn and obtain a decision unless already approved.
- RED: schema, breaking API/event, RLS, permissions, QR security, money, audit, or state-machine changes initiated by UI; warn and wait for explicit approval.

An independent UI/UX Design Subagent is a BUILD gate. It completed the required read-only review; retain the warning system.

## Documentation hygiene

- Put current executable work only in `docs/CURRENT_TASK.md`.
- Keep milestone status concise in `docs/AUTOPILOT_STATUS.md`.
- Put durable decisions in `docs/adr/` and index them in `docs/DECISIONS.md`.
- Move verbose completed history into `docs/archive/`.
- Do not paste terminal logs or source code into long-term documents.
- Update `docs/SESSION_HANDOFF.md` at the end of each work session.

## Current next gate

Local `BUILD` remains authorized under the named path. The named Staging Supabase project is authorized only for the reviewed migration/RLS/index/constraint/synthetic-seed/verification scope plus the completed Anonymous Sign-Ins enablement. The named Vercel project is authorized for Preview configuration/deployment/verification and the retained inert Production bootstrap only. Real application Production deployment, final domain binding, Pilot use and all unrelated external environments remain out of scope.
