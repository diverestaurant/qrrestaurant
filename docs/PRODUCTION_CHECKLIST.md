# Production Checklist

Status: NOT READY; planning template only  
Last updated: 2026-07-20

## Authorization and identity

- [ ] `RELEASE` authorization names exact Production app/project/database/domain/commit/migration.
- [ ] Release owner and second reviewer identified.
- [ ] Platform Admin, Owner, Manager, Kitchen, Waiter and Cashier accounts provisioned securely.
- [ ] MFA/high-privilege and break-glass policy verified.
- [ ] Staff offboarding/session revocation tested.

## Product inputs

- [ ] Legal Restaurant/Branch information and contacts approved.
- [ ] Tables/areas/capacity and QR labels approved.
- [ ] Menu/content/images/modifiers/stations approved.
- [ ] MYR/timezone/business-day cutoff approved.
- [ ] SST/service charge/discount/rounding/receipt rules approved by responsible owner/advisor.
- [ ] Privacy notice, retention and support policy approved.
- [ ] English and enabled translations approved.

## Build and migration

- [ ] Commit/artifact/dependency lockfile recorded.
- [ ] Current stable patched framework/runtime verified.
- [ ] All required CI gates pass.
- [ ] Migration verified from empty and production-shaped Staging.
- [ ] Data validation, lock risk and roll-forward/rollback documented.
- [ ] Explicit Data API grants, RLS, functions, views and Storage policies reviewed.
- [ ] Preview/Test production-ref guard verified.

## Security

- [ ] Cross-tenant/branch/table RLS matrix passes.
- [ ] Anonymous staff/customer distinction and grant expiry/revoke pass.
- [ ] QR/Join Code tamper/brute/rate tests pass.
- [ ] Price/modifier/idempotency/payment attacks pass.
- [ ] Function/view/EXECUTE/search-path review passes.
- [ ] CSP/headers/CORS/CSRF/XSS/upload tests pass.
- [ ] Dependency/secret scan has no blocking finding.
- [ ] No Critical/High unresolved security defect.

## Reliability and quality

- [ ] Golden Path and required exception paths pass in Staging.
- [ ] Concurrency and Realtime reconnect/resync pass.
- [ ] Payment unknown/duplicate/close recovery pass.
- [ ] Load/soak/failure recovery meets agreed Pilot model.
- [ ] Web Vitals/order-to-KDS targets meet recorded conditions.
- [ ] Accessibility and device/browser matrix pass.
- [ ] Independent UI review passes.
- [ ] No P0/P1 defects.

## Backup and operations

- [ ] Database backup/PITR plan active and cost approved.
- [ ] Storage backup/export active.
- [ ] Restore drill passes and RPO/RTO recorded.
- [ ] Pre-release recovery point confirmed.
- [ ] Logs/metrics/dashboards/alerts/runbooks enabled.
- [ ] Incident, breach, rollback and reconciliation owners available.
- [ ] Support/hypercare window confirmed.

## Training and Pilot

- [ ] Admin/Kitchen/Waiter/Cashier training completed.
- [ ] Test table/device/audio/fullscreen/print readiness verified.
- [ ] Manual outage/fallback SOP understood.
- [ ] Pilot scope/success metrics and acceptance owner confirmed.
- [ ] Representative-user test plan scheduled.

## Release

- [ ] Go/No-Go signed by authorized owners.
- [ ] Production migration deployed and verified.
- [ ] Application artifact deployed and version visible.
- [ ] Production security/Auth/QR smoke passes.
- [ ] Controlled Golden Path completes.
- [ ] Monitoring and rollback window active.
- [ ] Deployment report completed.

No item becomes complete merely because the project is in BUILD. Each checkbox must link implementation, local/staging or production evidence before it changes.
