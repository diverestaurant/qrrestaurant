# Data Inventory and Lifecycle Plan

Status: Proposed; requires owner/legal confirmation  
Last updated: 2026-07-20

| Data class | Examples | Source/purpose | Access | Proposed retention/disposal | Backup impact |
|---|---|---|---|---|---|
| Public | Restaurant name, branch label, menu text/prices, public images | Restaurant configuration/customer menu | Anyone with public entry | While published plus cache purge | DB and Storage |
| Internal | Table labels, station routing, availability, feature flags, operational metrics | Restaurant operations | Authorized staff by Branch/role | Business need plus audit window | DB |
| Personal | Staff name/email/auth ID, minimal IP/User Agent, invite status | Auth, authorization, audit and support | Owner/Manager limited; Platform support controlled | Employment/policy/legal period; revoke immediately on departure | Auth DB, app DB, logs |
| Pseudonymous | Anonymous Auth UID, customer grant, order device actor reference | Current Session authorization/idempotency | Current grant and authorized staff | Revoke at close; delete/pseudonymize after bounded support/audit window | Auth/app DB |
| Financial/Internal-sensitive | Orders, prices, discounts, payments, receipts, reconciliation | Billing/operations/records | Owner/Manager/Cashier scoped | Restaurant/legal/tax policy; immutable correction | DB/export backup |
| Sensitive security | Role changes, audit before/after, incident evidence, token fingerprints | Security and accountability | Least-privilege security/owner | Security/legal policy; masked/pseudonymized | Encrypted DB/log backup |
| Secret | Service keys, DB credentials, signing secrets, provider tokens | Runtime infrastructure | Secret manager/runtime only | Rotate; never store in repo/docs/logs | Secret manager recovery process |

## Data minimization

- Customers provide no name, email or phone in V1.
- Notes are free text and may accidentally contain personal/sensitive data; UI warns not to include unnecessary personal information and logs avoid copying notes.
- Audit before/after includes allowlisted safe fields, not whole rows.
- IP/User Agent are truncated/hashed or otherwise minimized according to incident need and policy.
- Reports aggregate where detail is unnecessary.

## Anonymous user lifecycle

- Anonymous Auth account creation is rate-limited and protected by CAPTCHA/Turnstile or an approved equivalent.
- Current grant expires and is revoked when Session closes.
- Orphan/old anonymous Auth users require a scheduled cleanup policy because Supabase does not provide automatic cleanup by default.
- Cleanup must not delete order/financial facts; actor references become pseudonymous/tombstoned if required.

## Data subject handling plan

Restaurant/Platform process must cover:

- Access request identity verification.
- Correction of staff profile and tenant configuration.
- Deletion/erasure analysis against financial/audit retention duties.
- Portable export format and secure delivery.
- Request log, deadlines, approver and legal escalation.

Anonymous diners generally cannot be re-identified without possession of their device/session evidence; privacy notice must explain this limitation honestly.

## Storage lifecycle

- Menu uploads use opaque paths and metadata records.
- Replaced/unpublished assets become cleanup candidates after grace period.
- Delete Storage object and metadata consistently.
- Backup/restore covers Storage separately from database backups.

## Environment rules

- Development/Test/Staging use synthetic data.
- No production copy enters lower environments unless specifically authorized, minimized and protected.
- Test screenshots/logs must not contain real staff/customer/financial secrets.

## Required confirmations

- Malaysia PDPA applicability and privacy notice owner.
- Financial/order/receipt retention periods.
- Audit/IP/User Agent retention and masking.
- Staff offboarding/deletion process.
- Backup residency/encryption/access.
- Data incident contact and escalation window.

Compliance status remains `policy/legal review pending`; this plan is not legal advice or a compliance certification.
