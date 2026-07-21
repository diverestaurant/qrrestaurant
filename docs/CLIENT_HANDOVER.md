# Client Handover Plan

Status: Planning template; no application to hand over  
Last updated: 2026-07-20

## Handover package required at Finish Line A/B

- Source repository and traced release commit.
- Architecture, ADRs, schema/migrations, RLS/grant/storage policies.
- Environment variable inventory without secrets.
- Setup/local development/CI guide.
- Staging/Production deployment, migration and rollback guide.
- Backup/restore/incident/reconciliation runbooks.
- Admin, Kitchen, Waiter, Cashier and Customer flow guides.
- QR generation/rotation/print procedure.
- Staff invite/offboarding/MFA/break-glass procedure.
- Test, security, accessibility, performance and UI review reports.
- Known issues, deferred roadmap, client inputs and accepted risks.
- Monitoring dashboards/alerts/support contacts.

## Ownership transfer

| Area | Client owner needed | Evidence |
|---|---|---|
| Restaurant/Branch configuration | Restaurant Owner | Approved settings/export |
| Menu and availability | Menu/Branch Manager | Training and test update |
| Staff access | Owner/Manager | Invite/disable/role exercise |
| Kitchen operation | Kitchen Lead | KDS/reconnect drill |
| Checkout/reconciliation | Cashier Lead/Owner | Payment/close/exception drill |
| Privacy/retention | Owner/advisor | Approved policy |
| Incident/support | Named owner | Escalation drill/contact sheet |
| Deployment/backups | Technical owner | Restore/release evidence |

## Acceptance walkthrough

- Verify version/environment and no shared test credentials.
- Run controlled Golden Path and at least duplicate/closed-session/payment-close recovery.
- Demonstrate audit and report reconciliation.
- Demonstrate QR/Join Code rotation and old-session denial.
- Demonstrate offline/reconnect and manual fallback.
- Review Deferred boundaries so staff do not expect unsupported Split Bill/refund/online payment.

## Current handover status

- Planning documents: in progress/available.
- Source application: not created.
- Database/deployment: not created.
- Training: not performed.
- Acceptance: not requested or signed.

No handover or production readiness claim is made in PLAN_ONLY.
