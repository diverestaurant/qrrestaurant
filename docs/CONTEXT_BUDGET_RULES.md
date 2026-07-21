# Context Budget Rules

Last updated: 2026-07-20

## Startup budget

Default read order:

1. `AGENTS.md`
2. `docs/PROJECT_INDEX.md`
3. `docs/AUTOPILOT_STATUS.md`
4. `docs/CURRENT_TASK.md`
5. Only the ADR/architecture files named by the current task
6. Only directly relevant source/migrations/tests

## Routing by task

- Tenant/Auth/RLS: `DATABASE_ARCHITECTURE.md`, `PERMISSION_MATRIX.md`, ADR-003, relevant migrations/tests.
- Orders/state: `STATE_MACHINES.md`, `API_CONTRACTS.md`, relevant module/tests.
- Money/payment: ADR-004/006, `STATE_MACHINES.md`, pricing/payment source/tests.
- Realtime/KDS: `REALTIME_ARCHITECTURE.md`, ADR-005, KDS contracts/tests.
- UI: relevant files under `docs/ui/`, `API_CONTRACTS.md`, permissions/state; invoke required UI Subagent Gate in BUILD.
- Deployment/security: `DEPLOYMENT.md`, `SECURITY_REVIEW.md`, `PRODUCTION_CHECKLIST.md`.

## Do not load by default

- Full Prompt v2/v3 after `AGENTS.md` and project documents are established, unless authorization/governance is disputed.
- Entire repository or unrelated modules.
- All ADRs when only one applies.
- Archived sessions/logs.
- Personal Vault or sibling projects.
- Full terminal/build/CI logs; keep artifact link and concise failure excerpt.

## Document ownership

- Current executable task: `CURRENT_TASK.md`.
- Current milestone/status: `AUTOPILOT_STATUS.md`.
- Durable architecture decision: one ADR + index.
- Implemented fact: source/migration/test.
- Test evidence: `TEST_REPORT.md` with artifacts.
- Release evidence: `FINISH_LINE.md` and deployment report.

Avoid duplicating the same detail. Link to the authoritative document.

## End-of-session compression

Update `SESSION_HANDOFF.md` with:

- mode/branch/commit/environment.
- changed files grouped by purpose.
- tests and artifacts.
- blockers/client input.
- exact next task and commands.

Move old detailed handoffs to `docs/archive/` when they no longer represent the active session.

Never store secrets, auth tokens, personal notes or full logs in context documents.
