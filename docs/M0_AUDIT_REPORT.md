# M0 Repository Audit Report

Audit date: 2026-07-20  
Mode at audit time: `PLAN_ONLY` (historical baseline)  
Authorized directory: `/Users/oscar/Documents/QR restaurant odering system`  
Audit method: local read-only inspection plus official documentation research

## Executive result

At audit time the repository was a greenfield documentation repository. Local BUILD has since created the controlled scaffold and foundation; this report remains the historical M0 pre-build baseline. No remote environment is in scope.

## Evidence observed

Root files before planning work:

- `DIVE_RESTAURANT_AUTOPILOT_MASTER_PROMPT_V3.md`
- `Dive_Restaurant_Master_Prompt_v2.md`
- `Dive_Restaurant_Master_Prompt_v2.rtf`
- `PROMPT_REVIEW_FINDINGS.md`
- `.git/`

Git status at audit time:

- Branch: `main`
- No commits yet
- Prompt/review files untracked

Not found:

- `package.json` or lockfile
- Next.js source or configuration
- `tsconfig.json`
- Supabase directory/configuration
- Database schema or migrations
- Environment example
- Tests or test runners
- CI/CD workflow
- Deployment configuration
- Application documentation

## Findings

### M0-01 — No implementation baseline

Severity: Informational  
Status: Expected for greenfield

There is no code to assess for correctness, security, performance, accessibility, or technical debt. All those controls remain `Designed`, not implemented.

### M0-02 — No version baseline

Severity: Medium  
Status: Open until BUILD

Framework, runtime, package manager, Supabase CLI, PostgreSQL, and testing versions are not pinned. Current official material indicates Next.js 16.2.x is stable while 16.3 is preview, but BUILD must re-check the current stable patched release and advisories immediately before scaffolding.

### M0-03 — Supabase exposure behavior changed in 2026

Severity: High if ignored  
Status: Addressed in plan

Supabase announced that new tables may no longer be exposed automatically to Data/GraphQL APIs. The build plan requires explicit grants, an exposure inventory, RLS on every exposed table, and tests for both missing grants and over-broad grants.

### M0-04 — Anonymous Auth is not the `anon` database role

Severity: High if misunderstood  
Status: Addressed in architecture

Supabase Anonymous Auth users use the `authenticated` Postgres role and carry an `is_anonymous` claim. Staff RLS cannot rely on `TO authenticated` alone. It must distinguish permanent staff identities from anonymous customers and require staff memberships or customer Session grants.

### M0-05 — No external environment is authorized

Severity: Gate  
Status: Correctly blocked

There is no Supabase project, Vercel project, staging environment, production environment, domain, or credential in scope. Planning must not claim environment verification.

### M0-06 — Business inputs are incomplete

Severity: Launch blocker, not planning blocker  
Status: Tracked in `CLIENT_INPUT_REQUIRED.md`

Real menu, tables, branding, employee identities, business day, SST/service charge/rounding, receipt policy, Pilot volumes, retention, and support contacts are not supplied.

### M0-07 — Independent UI review had not occurred at audit time

Severity: BUILD gate  
Status: Not started by design

The governing prompt required an independent UI/UX Design Subagent before M1 and each role UI. The review is now recorded in `docs/ui/UI_REVIEW_REPORT.md`; device/accessibility/usability evidence remains open.

## Greenfield recommendation

Use a single deployable Next.js modular monolith for V1 with strong module boundaries rather than a monorepo or microservices. Use Supabase PostgreSQL as the source of truth, RLS as database defense, Realtime plus an outbox/resync design for responsiveness, and provider-neutral ports for deferred integrations.

## BUILD entry checklist

Before creating the first application file:

1. Obtain explicit BUILD authorization for this exact directory.
2. Confirm package manager preference; default recommendation is `pnpm` if available, otherwise npm.
3. Re-check current stable patched Next.js, React, Node LTS, Supabase CLI/client and security advisories.
4. Run the mandatory independent UI/UX Foundation review.
5. Create the app without overwriting the planning documents.
6. Establish strict TypeScript, lint/import boundaries, environment validation, test runners and CI from the first commit.
7. Start local Supabase only; do not link remote projects without a separate authorized scope.

## Audit conclusion

M0 planning audit: Complete.  
M0 engineering audit: Foundation evidence exists; full M1–M10 evidence remains open.  
Production readiness: Not met.
