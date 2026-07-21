# Deployment, Migration, Backup and Recovery Plan

Status: Staging schema/RLS rehearsal is verified; current Vercel Preview is blocked by team access and Production remediation is pending owner authorization
Last updated: 2026-07-21

## 1. Authorization boundary

- Local scaffolding/testing: `BUILD` only.
- Remote Preview/Staging changes: explicit named authorization; Finish Line staging work uses `STAGING_VERIFY`.
- Production changes: `RELEASE` with project/database/domain/commit/migration scope.
- Pilot operations: `PILOT_VALIDATE`.

The named Staging Supabase project now contains all 32 reviewed migrations through `20260721155000_staff_self_profile.sql`; linked DB lint and the post-migration RLS/grant/Realtime/security checks pass. Vercel team `dive-restaurant` and project `prj_JLBEMJVcJsR53G6uefmsVwARwgOL` are linked. The Hobby plan exposes only Production/Preview/Development. Six encrypted variables remain configured for Preview. The inert bootstrap `dpl_4qCGhsjyXwAj6cTxTFxm3pL8AsBN` is retained. The default CLI deploy unexpectedly created real-app Production `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2` (`READY`, aliases assigned); no release claim is made and no remediation will occur without exact owner authorization. Explicit Preview deployments are currently blocked because the local Git author is not recognized as a member of the Vercel team.

## 2. Environment isolation

| Environment | App | Database/Auth/Storage | Data | Purpose |
|---|---|---|---|---|
| Development | local | local Supabase | synthetic | fast engineering |
| Test/Preview | isolated | isolated project or local CI | synthetic | change validation |
| Staging | separate named projects | production-shaped isolated | synthetic/approved | migration/recovery/E2E/load |
| Production | production project | production only | approved operational | live service |

Guardrails:

- App startup validates environment name/project ref.
- CI blocks Preview/Test config pointing to production refs/domains.
- Secrets are stored per environment and never copied into repo.
- Storage buckets, Auth providers and callback URLs are environment-specific.

## 3. Planned pipeline

1. Developer/CI runs format, lint, typecheck, unit/property, contract, DB/RLS subset and build.
2. Candidate runs full integration/security/E2E/visual/accessibility.
3. Generate immutable application artifact tied to commit and dependency lockfile.
4. Validate migration plan from current Staging version and from empty database.
5. Back up/record recovery point.
6. Apply migration to named Staging, run data checks, advisors and smoke.
7. Deploy same candidate artifact/config class to Staging; run Golden/exception/load/restore evidence.
8. Go/No-Go with known issues, owners and rollback triggers.
9. RELEASE applies approved migration/app to Production.
10. Production smoke on controlled test table; monitor rollback window.

## 4. Migration policy

- Version controlled and CLI-generated migration names.
- Expand → migrate/backfill → verify → contract in later compatible release.
- No destructive schema/data step without backup, exact target, authorization and recovery.
- Avoid long locks; assess table size/query plan and maintenance window.
- Schema/API changes remain backward compatible during rolling deployment.
- Prefer roll-forward; rollback only when tested and safer.
- Record pre/post row counts, constraints, grants, RLS, functions/views and migration version.

## 5. Seed/initialization

- Local/Staging placeholder Dive fixtures clearly marked non-production.
- Production initialization is idempotent, prompts/invites secure staff identities and never stores default passwords.
- Real menu/tables/branding imported only after user review and RELEASE authorization.
- Seed never bypasses tenant constraints/RLS in application runtime.

## 6. Configuration inventory

Names finalized during BUILD; categories include:

- Runtime environment/app URL.
- Supabase URL and publishable key.
- Server-only Supabase/database/admin credentials where strictly needed.
- Auth callback/session settings.
- Observability endpoint/token.
- CAPTCHA/rate-limit provider.
- Feature/provider adapter configuration.

`.env.example` contains names/descriptions only. No service role or secret is prefixed as public.

## 7. Backup

- Confirm Supabase plan's database backup/PITR capability and cost before Production.
- Storage objects need a separate export/replication/verification process.
- Export deployment config/migration/version references without secrets.
- Proposed initial target: RPO ≤24h, RTO ≤4h until owner approves/payments justify stronger plan.
- Production backup/recovery point recorded before migration.

## 8. Restore drill

In isolated authorized Staging:

1. Create clean target.
2. Restore database backup.
3. Restore/verify Storage objects and metadata consistency.
4. Apply required migrations to target version.
5. Verify counts/checksums/constraints/indexes/grants/RLS/functions.
6. Rotate/inject Staging secrets, never Production endpoints.
7. Run Auth/RLS smoke and Golden Path.
8. Measure RPO/RTO and document gaps.
9. Destroy or retain restored environment only under authorization/data policy.

## 9. Rollback triggers

- Confirmed tenant/table data leakage.
- Money/payment/receipt integrity error.
- Material order loss/duplication.
- Golden Path unavailable beyond approved threshold.
- Unrecoverable migration/data corruption.
- Auth bypass or critical supply-chain incident.

Feature flag/traffic rollback, application rollback and database roll-forward are separate decisions. Never roll app backward across incompatible schema without compatibility proof.

## 10. Production smoke

- Health and build/migration version.
- Security headers/CSP/CORS.
- Staff login and role/branch denial.
- Controlled QR/Join Code.
- Order → KDS → Serve → Payment → Receipt → Close → Report.
- Old grant/table reuse denial.
- Logging/metrics/alerts and support contact.

## 11. Go/No-Go report

Must include target, commit/artifact, migration, backups, tests, known issues, accepted risks, rollback, dashboards, alert contacts, training and support window.

Current deployment status: Staging schema/RLS is verified; no usable current Preview exists because Vercel blocks the commit author before build. The unintended Production deployment `dpl_4uXWYhzK8zP5D83UuTazpicEy5h2` is a release-blocking incident requiring exact owner direction. The real app must never use `--prod` or Promote; Production remains a separate `RELEASE` gate.
