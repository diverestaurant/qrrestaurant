# V1 Scope Matrix

Status: Proposed freeze for BUILD  
Last updated: 2026-07-20  
Default owner labels are accountable roles, not named people.

| Capability | Scope | Owner | Operational impact / fallback | Acceptance evidence |
|---|---|---|---|---|
| Multi-tenant Restaurant/Branch isolation | IN_SCOPE | Principal Architect | Mandatory; no fallback for data leakage | Composite constraints, RLS matrix, cross-tenant tests |
| Platform restaurant create/suspend | IN_SCOPE | Platform Admin | Manual subscription tracking | Platform workflows and audit tests |
| Automated subscription billing | DEFERRED | Product Owner | Track plan/status manually | Adapter boundary and deferred SOP |
| Staff Auth and branch roles | IN_SCOPE | Restaurant Owner | Manual invite/disable | Auth, membership, revoke and permission tests |
| Staff MFA/break-glass | IN_SCOPE for Production policy | Security Owner | Cannot release high privilege accounts without policy | Production checklist evidence |
| Table management and secure entry QR | IN_SCOPE | Branch Manager | Staff may identify table manually during outage | QR rotation/tamper tests and printable view |
| Staff-opened Dining Session | IN_SCOPE | Waiter/Manager | Staff opens table before customers order | Session concurrency and lifecycle tests |
| Customer auto-open Session | DEFERRED | Product Owner | Customer asks staff to open table | Public screen explains next action |
| Session Join Code/capability grant | IN_SCOPE | Security Owner | Staff can rotate code or re-pair device | Expiry/revoke/old-link/security tests |
| Customer public menu | IN_SCOPE | Menu Manager | Waiter can take manual order if unavailable | Mobile/accessibility/performance evidence |
| Customer cart and modifier selection | IN_SCOPE | Product Owner | Waiter manual order | Contract and E2E tests |
| Customer submit/add order | IN_SCOPE | Product Owner | Waiter manual order; never fake success | Idempotency, price recheck and recovery tests |
| Customer order tracking | IN_SCOPE | Product Owner | Staff provides status verbally | Session-scoped RLS and realtime/resync tests |
| Customer service requests | IN_SCOPE | Waiter Lead | Verbal call as fallback | Deduplication and waiter inbox tests |
| Menu categories/items/variants/modifiers | IN_SCOPE | Menu Manager | Manual menu unavailable list | CRUD, validation, snapshot and RLS tests |
| Menu image upload | IN_SCOPE | Menu Manager | Text-only menu remains usable | Storage policy, MIME/size and alt text tests |
| Live availability and sold-out | IN_SCOPE | Branch Manager | Staff verbally declines and corrects order | Server checkout revalidation |
| Draft/preview/scheduled menu publish/rollback | DEFERRED | Product Owner | Audited immediate updates; edit carefully | Deferred trigger and data boundary documented |
| Kitchen stations and item routing | IN_SCOPE | Kitchen Lead | Unassigned queue handled by expo/manager | Snapshot routing and unassigned tests |
| KDS item-level workflow | IN_SCOPE | Kitchen Lead | Paper/verbal fallback in incident SOP | Queue, conflict, reconnect and E2E tests |
| KDS sound alerts | IN_SCOPE | Kitchen Lead | Visible alert if audio unavailable | Permission/failure UI tests |
| Waiter table/session dashboard | IN_SCOPE | Waiter Lead | Manual floor sheet during outage | Mobile workflow and concurrency tests |
| Waiter manual order | IN_SCOPE | Waiter Lead | Core fallback for customer device issues | Actor attribution and pricing tests |
| Partial serving | IN_SCOPE | Waiter Lead | Verbal coordination | Item aggregate and recovery tests |
| Transfer/merge/split tables | DEFERRED | Product Owner | Manager closes/reopens only before orders; otherwise keep original table | Written SOP and future trigger |
| Whole-session checkout | IN_SCOPE | Cashier Lead | Manual calculation only during declared incident | Pricing snapshot and E2E evidence |
| Authorized percent/fixed discount | IN_SCOPE | Restaurant Owner | Manager approval and reason required | Permission, cap and audit tests |
| Manual Cash/Card/DuitNow/E-Wallet/Other payment | IN_SCOPE | Cashier Lead | External terminal/QR remains independent | Immutable payment and reconciliation tests |
| Multiple tenders against one session | IN_SCOPE | Cashier Lead | No item/person split; allocate to session balance | Partial payment and concurrency tests |
| Split bill by guest/item | DEFERRED | Product Owner | Cashier accepts multiple tenders for total only | Boundary shown clearly in UI/docs |
| Online payment provider | DEFERRED | Product Owner | Manual confirmation | Payment Provider Port only |
| Refund/Void/Reopen after paid | DEFERRED | Restaurant Owner | Manager uses documented external correction process; no silent DB edits | SOP, immutable record boundary |
| Receipt generation and reprint | IN_SCOPE | Cashier Lead | Browser print/PDF view; mark reprints | Immutable snapshot and sequence tests |
| Hardware kitchen/receipt printer protocol | DEFERRED | Product Owner | Browser print/manual ticket | Printer Port only |
| Daily reconciliation exception list | IN_SCOPE | Restaurant Owner | Manual terminal comparison | Report/payment consistency tests |
| Operational and sales reports | IN_SCOPE | Restaurant Owner | CSV/manual query only as controlled incident fallback | Tenant-scoped totals and timezone tests |
| Audit log viewer | IN_SCOPE | Security Owner | Restricted database access only during incident | Append-only, masking and RLS tests |
| Basic feature flags | IN_SCOPE | Platform Admin | Manual configuration | Scope and audit tests |
| English UI/content | IN_SCOPE | Product Owner | Required launch language | Full role E2E and content review |
| Chinese and Bahasa Melayu architecture | IN_SCOPE | Product Owner | Locale switching, layout and pseudo-long tests; final translations require client input | i18n contract and layout tests |
| Verified Chinese/BM translations | DEFERRED until supplied | Restaurant Owner | English remains official V1 language | Signed content approval before enabling |
| Accessibility WCAG 2.2 AA | IN_SCOPE | UI/UX Lead | No acceptable fallback for critical flows | Automated and manual review evidence |
| Inventory | DEFERRED | Product Owner | Staff handles stock outside system; sold-out is manual | Inventory Port only |
| Reservation, takeaway, delivery | DEFERRED | Product Owner | Existing restaurant processes | Domain boundaries documented |
| Loyalty/membership | DEFERRED | Product Owner | None in V1 | Loyalty Port only |
| E-Invoice | DEFERRED | Restaurant Owner | Follow approved external process | E-Invoice Port; legal trigger documented |
| FAMFOOD/supplier integration | DEFERRED | Product Owner | Existing ordering process | Supplier Port only |
| Full accounting/payroll/POS | DEFERRED | Restaurant Owner | Existing accounting/POS process | Export boundary only |

## Scope change rule

- Any change affecting money, tenant isolation, QR/Session ownership, RLS, audit or state machines requires an ADR and explicit product approval.
- UI-originated YELLOW/RED changes follow the warning process in the governing Prompt.
- A Deferred item may enter V1 only with owner, operational need, acceptance criteria, security review, migration/rollback plan and milestone impact.
- Deferred status never permits hidden mock buttons or dead-end navigation; the UI must either omit the feature with documentation or state the supported boundary honestly.
