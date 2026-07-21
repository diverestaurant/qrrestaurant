# Project Index

Last updated: 2026-07-21
Current mode: `BUILD` plus authorized named Staging Supabase/Vercel Preview work
Implementation status: M0–M9 complete locally; M10 automated matrix passes; M10 manual and M11 Staging/operations remain in progress

## Start here

- Governing prompt: [`../DIVE_RESTAURANT_AUTOPILOT_MASTER_PROMPT_V3.md`](../DIVE_RESTAURANT_AUTOPILOT_MASTER_PROMPT_V3.md)
- Session instructions: [`../AGENTS.md`](../AGENTS.md)
- Current status: [`AUTOPILOT_STATUS.md`](AUTOPILOT_STATUS.md)
- Current task: [`CURRENT_TASK.md`](CURRENT_TASK.md)
- Master Plan: [`MASTER_PLAN.md`](MASTER_PLAN.md)
- V1 scope: [`V1_SCOPE_MATRIX.md`](V1_SCOPE_MATRIX.md)
- M0 audit: [`M0_AUDIT_REPORT.md`](M0_AUDIT_REPORT.md)

## Architecture truth

- System architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Database architecture: [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md)
- Permission matrix: [`PERMISSION_MATRIX.md`](PERMISSION_MATRIX.md)
- State machines: [`STATE_MACHINES.md`](STATE_MACHINES.md)
- Application/API contracts: [`API_CONTRACTS.md`](API_CONTRACTS.md)
- Realtime and recovery: [`REALTIME_ARCHITECTURE.md`](REALTIME_ARCHITECTURE.md)
- Data inventory: [`DATA_INVENTORY.md`](DATA_INVENTORY.md)
- Decisions index: [`DECISIONS.md`](DECISIONS.md)
- ADR directory: [`adr/README.md`](adr/README.md)

## UI/UX planning

- Principles: [`ui/UI_PRINCIPLES.md`](ui/UI_PRINCIPLES.md)
- Screen inventory: [`ui/SCREEN_INVENTORY.md`](ui/SCREEN_INVENTORY.md)
- Information architecture: [`ui/INFORMATION_ARCHITECTURE.md`](ui/INFORMATION_ARCHITECTURE.md)
- User flows: [`ui/USER_FLOWS.md`](ui/USER_FLOWS.md)
- Design system: [`ui/DESIGN_SYSTEM.md`](ui/DESIGN_SYSTEM.md)
- Responsive matrix: [`ui/RESPONSIVE_MATRIX.md`](ui/RESPONSIVE_MATRIX.md)
- UI contracts: [`ui/UI_CONTRACTS.md`](ui/UI_CONTRACTS.md)
- Accessibility: [`ui/ACCESSIBILITY_CHECKLIST.md`](ui/ACCESSIBILITY_CHECKLIST.md)
- Usability test plan: [`ui/USABILITY_TEST_PLAN.md`](ui/USABILITY_TEST_PLAN.md)
- Review report: [`ui/UI_REVIEW_REPORT.md`](ui/UI_REVIEW_REPORT.md)

## Quality, security, and operations

- Testing strategy: [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md)
- Current test report: [`TEST_REPORT.md`](TEST_REPORT.md)
- Security review: [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md)
- Observability: [`OBSERVABILITY.md`](OBSERVABILITY.md)
- Deployment plan: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Production checklist: [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- Finish Line evidence: [`FINISH_LINE.md`](FINISH_LINE.md)
- Known issues: [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)
- Client inputs: [`CLIENT_INPUT_REQUIRED.md`](CLIENT_INPUT_REQUIRED.md)

## Planned role and release guides

- Setup guide: [`SETUP_GUIDE.md`](SETUP_GUIDE.md)
- Admin guide: [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md)
- Kitchen guide: [`KITCHEN_GUIDE.md`](KITCHEN_GUIDE.md)
- Waiter guide: [`WAITER_GUIDE.md`](WAITER_GUIDE.md)
- Cashier guide: [`CASHIER_GUIDE.md`](CASHIER_GUIDE.md)
- Customer flow guide: [`CUSTOMER_FLOW_GUIDE.md`](CUSTOMER_FLOW_GUIDE.md)
- Backup guide: [`BACKUP_GUIDE.md`](BACKUP_GUIDE.md)
- Recovery guide: [`RECOVERY_GUIDE.md`](RECOVERY_GUIDE.md)
- Future roadmap: [`FUTURE_ROADMAP.md`](FUTURE_ROADMAP.md)
- Go/No-Go template: [`GO_NO_GO_REPORT.md`](GO_NO_GO_REPORT.md)

## Handover and context

- Session handoff: [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md)
- Context rules: [`CONTEXT_BUDGET_RULES.md`](CONTEXT_BUDGET_RULES.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Client handover plan: [`CLIENT_HANDOVER.md`](CLIENT_HANDOVER.md)
- Staff training plan: [`STAFF_TRAINING.md`](STAFF_TRAINING.md)
- Archive policy: [`archive/README.md`](archive/README.md)
- Official references: [`REFERENCES.md`](REFERENCES.md)

## Current repository fact

As of 2026-07-21, local BUILD has a fully passing M0–M9 plus M10 automated matrix: 32 migrations, 508 pgTAP assertions, 73 unit tests, 85 passing browser checks, strict nonce CSP, verified private image uploads, bounded readiness/redacted logs and a current isolated schema/Storage restore rehearsal. The named Staging Supabase project has the first 16 reviewed migrations; the 16 newest migrations await dry-run/push because the current remote tool approval still references a stale `EXTERNAL_SCOPE=NONE` snapshot. Vercel retains the authorized inert bootstrap and an earlier inspect-confirmed real Preview that predates current code. See [`TEST_REPORT.md`](TEST_REPORT.md) and [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md).
