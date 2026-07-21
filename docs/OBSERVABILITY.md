# Observability and Incident Operations Plan

Status: Local structured logger and recovery signals implemented; hosted observability is not configured  
Last updated: 2026-07-21

## 1. Goals

- Detect customer order, kitchen, payment and Session-close failures before they become prolonged restaurant incidents.
- Trace one user action across HTTP, application command, database transaction, outbox/realtime and UI recovery.
- Provide enough evidence without logging secrets or unnecessary personal data.

## 2. Correlation model

- `traceId`: request/distributed trace.
- `correlationId`: user-visible support reference across retries/flows.
- `commandId`/idempotency key fingerprint.
- Domain IDs represented in restricted logs; public errors use opaque correlation only.
- `eventId` and `entityVersion` for realtime.

Payment/order/audit records retain correlation references; raw auth token/idempotency secret is never logged.

## 3. Structured log fields

- timestamp, environment, app version, migration version.
- severity, event/action name, result/error code, duration.
- Restaurant/Branch pseudonymous identifiers where operationally needed.
- actor type/role and pseudonymous ID.
- correlation/trace/command/event IDs.
- entity type/version, not full payload.
- retry/freshness/reconnect metadata.

Redact cookies, Authorization, service keys, Join Codes, QR tokens, notes, full payment references and unnecessary personal data.

## 4. Metrics

### Customer/order

- Table entry/Session join success and denial reason.
- Order submit success/failure/unknown outcome and latency.
- Item repair errors: sold-out/price/modifier.
- Duplicate/idempotency conflicts blocked.

### Kitchen/realtime

- Commit-to-KDS p50/p95/p99.
- Active/stale/disconnected KDS devices.
- Resync/poll fallback rate and duration.
- Queue age/SLA by Branch/station.
- Unassigned routing count.

### Waiter/service

- Open/unclaimed service requests and age.
- Serve state conflicts.
- Payment request-to-checkout time.

### Cashier/finance

- Payment pending/confirmed/failed/unknown/duplicate.
- Confirmed payment vs allocation/reconciliation exceptions.
- PAID Session close failures.
- Receipt creation/reprint failures.

### Security/platform

- Auth/permission/RLS denials trend, separated from expected customer expiry.
- Join Code/QR rate-limit and brute-force indicators.
- Suspended tenant access attempts.
- Privileged/platform actions.
- Upload validation failures.

### Web/infra

- Error rate, route latency, cold starts/build version.
- LCP/INP/CLS by role/device.
- DB connections/query latency/lock waits.
- migration, backup, restore and scheduled cleanup status.

## 5. Initial alert catalogue

| Alert | Severity | Initial trigger | Owner/runbook |
|---|---|---|---|
| Cross-tenant authorization anomaly | P0 | Any confirmed leakage/bypass | Security lead; isolate/revoke/incident plan |
| Money/duplicate payment mismatch | P0 | Any confirmed incorrect/duplicate financial record | Finance/engineering; stop checkout path |
| Order commit outage | P1 | Success below agreed threshold for 5 min | Engineering; DB/app health and fallback SOP |
| KDS visibility delay | P1 | p95 above threshold or stale devices during service | Kitchen lead/engineering; resync/poll/device SOP |
| PAID close failure backlog | P1 | >0 beyond short recovery window | Cashier lead/engineering; safe close recovery |
| Reconciliation exception | P1/P2 | Non-zero unexplained by business-day close | Owner/cashier; compare payments/receipts |
| Elevated auth/RLS denials | P2 or security escalation | Baseline deviation | Security; analyze scope/source |
| Backup/cleanup job failed | P1/P2 | One required job missed | Ops; rerun/verify recovery point |
| Web Vitals regression | P2 | p75 threshold breach over sample | Frontend owner; bundle/query analysis |

Thresholds require Staging/Pilot baseline and should avoid noisy paging. Every alert receives escalation contact, silence rule and test.

## 6. Dashboards

- Live service health: orders, KDS freshness, service requests, payment/close.
- Security: denial/rate-limit/privileged action anomalies.
- Finance integrity: confirmed payments, outstanding, receipts, reconciliation.
- Performance: Web Vitals, API/DB/event latency.
- Release operations: version, migration, backup, errors after deployment.

External observability provider selection may cost money and requires approval. Build provider-neutral interfaces and local structured logging first.

## 7. Incident process

1. Detect/receive report and assign severity.
2. Protect diners/money/data; disable affected feature/tenant path if authorized.
3. Preserve correlation, versions and audit without copying secrets.
4. Communicate safe operational fallback to restaurant contact.
5. Mitigate/rollback/restore under environment authorization.
6. Reconcile orders/payments/sessions.
7. Root-cause review and regression test for P0/P1.

## 8. Retention/access

Log/trace retention, IP/User Agent masking and access require privacy/security approval. Production access is least privilege and audited. Lower environments contain synthetic data.

Structured local logging exists, and the role recovery layer exposes reachability/reconnect signals. Metrics, dashboards, alerts, runbook automation and hosted observability are not configured.
