# Recovery Guide — Planning Template

Status: Local schema restore rehearsal complete; operational recovery remains environment-gated  
Last updated: 2026-07-21

## Incident categories

- Application release failure.
- Migration/schema/data failure.
- Database/Storage loss or corruption.
- Auth/secret compromise.
- Order/KDS Realtime outage.
- Payment/reconciliation/Session-close inconsistency.
- Tenant/permission/security incident.

## Generic recovery sequence

1. Identify severity and authorized incident owner.
2. Protect customer/order/money/data integrity; disable affected path if authorized.
3. Record version, migration, environment, correlation and recovery point.
4. Use tested app rollback, roll-forward or isolated restore plan as appropriate.
5. Rotate compromised secrets/sessions when required.
6. Verify grants/RLS/Auth, data counts, Storage, Golden Path and monitoring.
7. Reconcile orders, payments, receipts and Sessions before reopening operations.
8. Communicate status/fallback to restaurant contact.
9. Complete root cause and regression test.

## Local BUILD rehearsal evidence

The local schema-only restore rehearsal succeeded in an isolated temporary database after including `public`, `app_private` and local `auth` schemas and omitting ownership/privilege statements. It verified 28 public tables, 50 public policies and 28 RLS-enabled public tables, then removed the temporary database. Hosted data, Storage, Auth retention, backups, monitoring and Golden Path recovery remain unverified.

## Financial recovery rule

Never delete or silently edit confirmed payments/receipts. A PAID-but-not-CLOSED Session retries close without taking payment again. Any future correction uses explicit reversal records and approved authorization.

Exact commands and escalation contacts require deployed architecture, approved providers and Staging restore evidence.
