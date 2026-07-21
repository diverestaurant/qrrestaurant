# Application and API Contracts

Status: Contract design with local menu, Session, order, service, KDS, payment and report boundaries implemented  
Last updated: 2026-07-21

## 1. Contract policy

- Application commands and queries are framework-neutral TypeScript/Zod contracts.
- HTTP/Server Action/Realtime adapters map to the same application contracts.
- Public HTTP APIs use `/api/v1/...`; breaking changes require a new version or documented compatibility migration.
- Commands include schema version, idempotency key where relevant, expected entity version and correlation context.
- Server ignores client-supplied trusted fields such as tenant IDs inferred from route, roles, prices, totals, tax and timestamps.
- View Models expose only task-required data and never mirror raw database rows by default.

## 2. Error envelope

```text
{
  ok: false,
  error: {
    code: stable_machine_code,
    message: safe_localizable_message_key_or_text,
    correlationId: opaque_id,
    retryable: boolean,
    fieldErrors?: map,
    itemErrors?: [{ clientLineId, code, recovery }],
    currentVersion?: number
  }
}
```

Core codes include `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_QR`, `SESSION_JOIN_REQUIRED`, `SESSION_CLOSED`, `VALIDATION_FAILED`, `ITEM_UNAVAILABLE`, `PRICE_CHANGED`, `INVALID_MODIFIER`, `IDEMPOTENCY_CONFLICT`, `VERSION_CONFLICT`, `PAYMENT_CONFLICT`, `RATE_LIMITED`, `TEMPORARILY_UNAVAILABLE`.

Do not reveal whether a guessed token/table/tenant exists when authorization fails.

## 3. Customer entry/query contracts

### Implemented local endpoint

`GET /api/v1/customer/menu?restaurantSlug=dive-demo&branchSlug=main` reads active Restaurant, Branch, visible Categories and available Menu Items through the configured Supabase Data API. It returns `CustomerMenuView` with `meta.source = "supabase"`, an explicit local/Preview/Production deployment environment, and never returns prices calculated by the client. Unknown slugs return a safe `NOT_FOUND` envelope; database outage returns a retryable `INTERNAL_ERROR` envelope.

`POST /api/v1/staff/menu/items/:menuItemId/availability` is the local staff mutation boundary. It requires staff Auth, `available`, `expectedVersion` and an idempotency key. The normal Supabase client enforces RLS for the menu update; server-only idempotency bookkeeping never reaches the browser; a database trigger writes masked audit and outbox records. Malformed input returns `VALIDATION_ERROR`; unauthenticated requests return `UNAUTHORIZED`; direct synthetic manager/outsider/anonymous-claim RLS impersonation passes locally. Authorized HTTP success/replay/conflict evidence remains open.

`POST /api/v1/staff/sessions` is the local staff Session-open boundary. It requires staff Auth, `tableId`, `guestCount` and an idempotency key. A transactional local RPC creates the Session and hashed Join Code under RLS; the plaintext six-digit Join Code is returned only to the authorized staff response. Malformed input returns `VALIDATION_ERROR`; unauthenticated requests return `UNAUTHORIZED`.

`POST /api/v1/customer/sessions/join` requires a server-derived Supabase anonymous Auth UID and a six-digit Join Code. The database rechecks the hashed code, Session state, expiry and actor binding before issuing a bounded customer Session grant. Invalid/expired codes return a safe `FORBIDDEN` envelope without disclosing whether a Session exists. Anonymous Auth is not enabled in remote environments under this local-only task.

`POST /api/v1/customer/service-requests` creates a session-grant-bound request with server-only idempotency. `POST /api/v1/staff/service-requests/:requestId/transition` applies waiter state/version transitions. `POST /api/v1/staff/kds/items/:orderItemId/transition` applies KDS state/version transitions. Each uses the normal authenticated Supabase client for RLS-protected data and returns safe validation, authorization, conflict and unknown-outcome envelopes.

`POST /api/v1/customer/orders` accepts only the session ID, item IDs, quantities, optional variant/modifier selections, notes, expected Session version and idempotency key from the customer. A narrow server-side RPC rechecks the live anonymous grant, menu visibility/availability, active configuration, branch currency and prices, calculates integer minor-unit totals, writes immutable order/item/variant/modifier snapshots and advances the Session version. Client-supplied prices and totals remain rejected as truth.

`POST /api/v1/staff/payments/:paymentId/confirm` invokes the atomic local payment RPC after the application guard checks method, amount, outstanding balance, cash received and observed reference. The RPC rechecks cashier permission and actor binding, then confirms the payment, creates one allocation and advances the Session paid total under one transaction.

`GET /api/v1/staff/reports/branch-summary?branchId=:branchId` returns an aggregate branch report only when the server-derived staff identity has `report.read`. The RPC returns no row for an unauthorized branch and does not expose raw cross-tenant records.

### ResolveTableEntry

Input: restaurant slug, branch slug, table token.  
Output: public Restaurant/Branch/Table label, public menu revision and whether ordering requires Session join.  
Never returns current Session ID/orders or internal IDs before grant.

### JoinDiningSession

Input: table entry context, Session Join Code.  
Server context: verified anonymous Auth UID.  
Output: capability status/expiry and current `CustomerSessionView`.

### CustomerMenuView

- Brand/branch/table public display.
- Menu revision/currency/locale.
- Categories/items/variants/modifier groups/options.
- Display price ranges and availability.
- No internal tenant, cost, audit, staff or rule internals.

### CustomerSessionView

- Public table label and current Session display identifier.
- Capability expiry/rejoin requirement.
- Order cards with submitted time, item snapshots, quantities and safe customer-facing status.
- Session subtotal estimate/bill state as authorized.
- Allowed action capability flags derived by server.

## 4. Customer commands

### SubmitOrder

Input:

- schema version
- idempotency key
- customer grant context from server session
- cart lines with client line ID, menu item ID, optional variant ID, modifier option IDs/quantities, quantity and note
- observed menu revision for conflict messaging

Not accepted as truth: unit prices, tax, service charge, discount, totals, Restaurant/Branch/Session IDs from body.

Output:

- authoritative order display ID/version/status
- accepted line snapshots and authoritative totals
- any item-specific repair errors if transaction rejected
- correlation ID

### CreateServiceRequest

Input: type enum, optional safe note, idempotency key.  
Output: request view and dedupe result.

### RequestBill

Input: expected Session version, idempotency key.  
Output: current bill-request status; never creates payment.

## 5. Staff query View Models

### StaffContextView

- Actor display name.
- Active Restaurant/Branch label.
- Role and safe capability keys.
- Wrong-branch/suspended/session-expiry state.

### KdsQueueView

- Sync cursor/time/stale state.
- Station filters.
- Order/item display identifiers, table, elapsed time, snapshots, notes, state/version and allowed commands.
- No unnecessary payment/customer identity data.

### WaiterFloorView

- Table read models, current Session summary, service request counters, payment-request marker and versions.

### CashierSessionView

- Immutable bill line snapshots, pricing components/rule versions, payment allocations, outstanding, allowed discount/payment actions and Session version.

### Admin views

- Task-specific DTOs for tenants, branches, menu, staff, reports and masked audit.
- Never return secret hashes, raw auth records, service keys or full private metadata.

## 6. Staff commands

Named application commands include:

- `OpenDiningSession`
- `RotateSessionJoinCode`
- `CreateStaffOrder`
- `AcceptOrderItem`
- `RejectOrderItem`
- `StartPreparingItem`
- `MarkItemReady`
- `MarkItemServed`
- `CancelOrderItem`
- `ClaimServiceRequest`
- `ResolveServiceRequest`
- `RequestBillForTable`
- `BeginCheckout`
- `ApplySessionDiscount`
- `BeginPayment`
- `ConfirmPayment`
- `FailPayment`
- `CloseDiningSession`
- `SetMenuItemSoldOut`

Each command specifies actor permission, state precondition, expected version, reason/authorization if sensitive, idempotency policy, transaction boundary, audit action and outbox event.

## 7. Contract compatibility

- Additive optional response fields are backward-compatible only when clients tolerate unknown fields.
- Removing/renaming/changing meaning is breaking.
- State/event additions require clients to safely render unknown state and prompt refresh/update.
- Route token format changes require old-token revocation/rotation plan and safe error behavior.
- Contract fixtures are shared by server adapters, UI tests and E2E.

## 8. Import boundary

- `ui` imports View Model and command input/result types only.
- `contracts` imports schema/type utilities but not database or React.
- `application` imports contracts/domain ports.
- `infrastructure` implements ports and maps database records.
- Route/Action adapters may import application composition and contracts, not repositories directly.

The independent UI/UX Subagent must review these contracts before each role implementation. Any UI-requested contract change follows YELLOW/RED classification.
