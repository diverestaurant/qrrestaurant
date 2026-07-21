# UI Contracts

Status: Implemented presentation contracts; local role shells and recovery-state examples exist  
Last updated: 2026-07-20

## 1. Boundary

UI consumes only formal View Models and invokes named commands. UI never imports raw Supabase types, table rows, repositories, migration types, service-role clients or pricing/state-machine implementations.

## 2. Shared envelope states

All query views expose or are wrapped with:

- `status`: loading/ready/empty/error/permission_denied/suspended.
- `freshness`: fresh/reconnecting/stale/offline.
- `serverTime`, `lastSyncedAt`, optional cursor/version.
- safe `correlationId` on errors.
- role/task-specific `capabilities` for affordances; server remains authoritative.

All command results expose:

- pending locally, then confirmed/failed/unknown_outcome/conflict.
- stable error code and recovery metadata.
- updated entity/view version on success.
- idempotency result identity when applicable.

## 3. View Model mapping

| UI area | Formal contract | Data prohibited from UI |
|---|---|---|
| Public entry/menu | `ResolveTableEntry`, `CustomerMenuView` | internal UUIDs, token hashes, costs, audit/settings internals |
| Customer session | `CustomerSessionView` | prior sessions, other devices/auth IDs, staff/private payment refs |
| KDS | `KdsQueueView` | full bill/payment/customer identity, unrelated stations/branches |
| Waiter floor | `WaiterFloorView` | unrestricted audit/staff settings/payment details |
| Cashier bill | `CashierSessionView` | secret provider data, raw DB rows, other Branches |
| Staff shell | `StaffContextView` | authorization implementation and raw JWT |
| Admin | task-specific admin DTOs | secret hashes/keys, raw auth internals, unmasked sensitive audit |

## 4. Command intent mapping

UI emits intent with user-entered fields and current entity version. It does not supply trusted actor, tenant, permission, final money or server timestamp.

Examples:

- Customer cart → `SubmitOrder` with item/option IDs, quantities, notes and idempotency key.
- KDS state button → `StartPreparingItem` with item ID and expected version.
- Waiter served → `MarkItemServed` with expected version.
- Cashier tender → `BeginPayment`/`ConfirmPayment` with method, requested amount, observed ref and expected Session version.
- Admin sold-out → `SetMenuItemSoldOut` with expected item version.

## 5. State presentation contract

Unknown server states/events:

- Do not guess or map to success.
- Display safe “Update required / Refresh state” fallback.
- Log schema/version/correlation without sensitive payload.
- Trigger authoritative refresh and compatibility telemetry.

## 6. Pricing presentation

- `Cart` displays an estimate labelled as subject to server confirmation.
- `Order success` displays authoritative order snapshot.
- `BillBreakdown` renders authoritative subtotal/adjustments/service/tax/rounding/grand total/paid/outstanding.
- UI may format integer minor units using locale/currency utility but cannot recalculate business components.
- Any arithmetic used for display formatting has tests and is not used as command truth.

## 7. Permission presentation

- Capabilities decide enabled/visible affordances and explanatory disabled state.
- Sensitive hidden actions remain denied at command and database layers.
- Permission-denied responses replace stale capabilities and refresh StaffContext.
- No role name comparison scattered through components; use stable capability keys from View Model.

## 8. Import boundary acceptance

Automated rules must fail when:

- UI imports Supabase client/database/repository/server-only modules.
- Domain imports Next.js/React.
- Contracts import database-generated row types as public API.
- A React component defines pricing, transition or tenant authorization rules.

## 9. Change classification

- Visual token/layout preserving these contracts: GREEN.
- Additive View Model/route/shared-state/dependency request: YELLOW unless already approved in plan.
- Schema/RLS/money/state/breaking contract requested by UI: RED and requires explicit approval.

## 10. Command freshness and recovery matrix

| Command family | Freshness input | Safe failure behavior | Success authority |
|---|---|---|---|
| Customer submit order | Session version and live session state | Show conflict/unknown outcome; refresh before retry | Server order snapshot and idempotency record |
| KDS item transition | Item/order version and station scope | Keep item visible, explain stale state, resync queue | Committed order-item state |
| Waiter service action | Session/order version and capability | Preserve actionable item; never imply completion | Committed service event/state |
| Cashier tender | Session version, outstanding balance and tender idempotency key | Check payment status before any retry | Payment allocation and receipt snapshot |
| Admin menu change | Menu-item version and branch capability | Keep unsaved/conflict state visible | Committed menu-item version and audit event |

Partial Success never means partial Customer Order acceptance. The UI must render the command result envelope and only show the success state after authoritative confirmation.

Independent UI/UX review completed for this document by the BUILD-stage design subagent; device, accessibility and usability evidence remain separate gates.
