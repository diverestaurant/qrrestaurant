# Client Input Required

Status: Open  
Last updated: 2026-07-20

Planning can continue without these inputs. Items marked Release Blocker must be confirmed before Production; Pilot items before Pilot validation.

| Input | Needed by | Why/decision owner | Safe planning default |
|---|---|---|---|
| Legal Restaurant name/registration/contact | Release | Receipt/admin identity; Owner | Placeholder Dive Restaurant |
| Branch name/address/contact | Release | QR/receipt/support; Owner | Placeholder Pilot Branch |
| Logo/brand colors/assets/license | UI implementation/Release | Tenant branding; Owner/UI Lead | Neutral accessible tokens |
| Table list/areas/capacity/labels | Pilot setup | QR/session operations; Manager | Synthetic 30-table model |
| Guest count policy | BUILD M3 | Session validation; Manager | 1–20 configurable test range |
| Menu/categories/items/descriptions/images | Pilot setup | Customer/KDS flow; Menu Owner | Clearly marked synthetic menu |
| Variants/modifiers/min-max/prices | Pilot setup | Pricing and ordering; Menu Owner | Synthetic boundary fixtures |
| Allergens/spice/content policy | Pilot setup | Display/liability; Owner | Display-only architecture; no claim |
| Kitchen stations/routing/expo process | BUILD M4/M6 | KDS model; Kitchen Lead | Main Kitchen, Drinks, Grill, Dessert |
| Currency | BUILD M1/Release | Money format/rules; Owner | MYR |
| Timezone | BUILD M1/Release | timestamps/reports; Owner | Asia/Kuching |
| Business-day cutoff/cross-midnight | BUILD M2/Release | reports/reconciliation; Owner | Calendar day until confirmed |
| SST/tax inclusive/exclusive/effective date | Release Blocker | Legal/financial correctness; Owner/advisor | Disabled/test fixture only |
| Service charge basis/taxability/effective date | Release Blocker | Pricing; Owner/advisor | Disabled/test fixture only |
| Cash/non-cash rounding rule | Release Blocker | Payment/receipt; Owner/advisor | Disabled/test fixture only |
| Receipt numbering/required fields/reprint policy | Release Blocker | Financial records; Owner/advisor | Synthetic branch sequence |
| Discount types/caps/authorizers | BUILD M8/Release | Cashier control; Owner | Manager-authorized bounded test rules |
| Cancellation after preparation policy | BUILD M6/M8 | Kitchen/financial handling; Owner/Manager | Manager only, reason, unpaid only |
| Join Code operating method | BUILD M3/Pilot | Customer friction/security; Manager | Waiter device verbally/displays code |
| Staff names/emails/roles/branches | Release | Secure invites; Owner | Synthetic users, no default passwords |
| MFA/break-glass owner | Release Blocker | Privileged security; Owner/Security | Required but undecided |
| Expected peak tables/orders/devices | Staging load | Capacity/SLO; Manager | 30 tables, 30 orders/min burst, 3 KDS |
| Target device models/browsers | M10/Pilot | Responsive/performance; Manager | Documented generic matrix |
| Restaurant Wi-Fi characteristics | Staging/Pilot | Realtime/offline; Manager | Controlled latency/loss scenarios |
| English copy approver | Release | Operational content; Owner | Product English draft |
| Chinese/Bahasa Melayu translations | Locale release | Translation accuracy; Owner | Locale framework/pseudo-long only |
| Privacy notice/PDPA advisor/retention | Release Blocker | Compliance/lifecycle; Owner/advisor | Minimize data; no compliance claim |
| Backup RPO/RTO and plan budget | Release Blocker | Recovery/cost; Owner | RPO 24h/RTO 4h planning target |
| Incident/support contacts/hours | Release Blocker | Operational response; Owner | Unassigned |
| Pilot dates/shift/menu/tables/success metrics | Pilot Blocker | Finish Line C; Owner | Not scheduled |
| Usability participants/consent | Pilot Blocker | UI Gate; Owner/UI Lead | Not recruited |

## Confirmation format

For each business rule, record:

- Value/rule and examples.
- Scope (Restaurant/Branch/payment method/menu item).
- Effective date/timezone.
- Approver and confirmation date.
- Migration/config owner.
- Test cases.

Do not place passwords, API keys, payment secrets or sensitive personal data in this file.
