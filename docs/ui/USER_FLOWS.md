# User Flows

Status: Planned, not usability-tested  
Last updated: 2026-07-20

## 1. Customer scans and orders

1. Scan static Table Entry QR.
2. System validates Restaurant/Branch/Table/token and shows public menu.
3. Customer browses immediately; no account tutorial.
4. Customer adds an item; required Variant/Modifiers are completed.
5. Cart preserves quantity, modifiers and note.
6. On first capability-required action, system creates/reuses anonymous identity and requests current Session Join Code.
7. Customer enters code; server creates short-lived Session grant.
8. Customer reviews correct table/items/estimated amount and submits.
9. UI shows Pending; server revalidates Session/menu/availability/modifiers/price and idempotency.
10. Only committed result shows success and current status.

Acceptance:

- Public menu visible without login/join.
- No-modifier item adds in one main tap.
- Cart-to-submit uses at most two main confirmations.
- No server confirmation means no success.
- Failure preserves cart and gives exact repair.

## 2. Add order at same table

1. Joined customer opens Current Session.
2. Existing current orders are visible within grant scope.
3. Customer returns to menu and builds another cart.
4. New order uses a new idempotency key and same Session grant.
5. Server rejects if bill/payment/close state no longer permits ordering.

## 3. Old customer/table reuse

1. Cashier closes prior Session; system revokes grants and Join Code.
2. Old customer sees Session ended and no historical detail after authorized window/session view closes.
3. Waiter opens new Session and new Join Code.
4. Saved static QR can show public menu but cannot join without the new physical/operational code.
5. New customer joins only the new Session.

## 4. Sold out/price/modifier change during checkout

1. Customer submits stale cart.
2. Server identifies affected client line IDs and current valid choices/prices.
3. No order is partially created unless a future explicit partial-acceptance contract is approved.
4. UI returns to cart with unaffected lines preserved and affected lines highlighted.
5. Customer repairs and retries with a new/revised request and safe key policy.

## 5. Unknown order outcome

1. Request sent; network fails before response.
2. UI labels outcome unknown, not failed or successful.
3. Retry/status query uses same idempotency key.
4. Server returns original committed result or processes once.
5. UI restores confirmed order or safely returns to cart.

## 6. Kitchen fulfillment

1. KDS loads authoritative station snapshot then subscribes.
2. New committed item appears with audible/visible alert.
3. Kitchen accepts and starts item using expected version.
4. Other KDS receives state event or resync.
5. Kitchen marks Ready.
6. Expo/Waiter sees partial/all ready and serves item.
7. Completed item moves to bounded recent history.

Conflict: if another device acts first, losing device shows current actor/state and refreshes without overwriting.

## 7. Service request

1. Customer chooses request type.
2. Server deduplicates same type within a bounded active window.
3. Waiter inbox prioritizes and allows claim.
4. Concurrent claim conflict identifies current assignee.
5. Waiter resolves; customer current Session reflects status.

## 8. Bill and manual multi-tender payment

1. Customer/Waiter requests bill.
2. Cashier opens Session and begins checkout with expected version.
3. Server returns authoritative item/discount/charge/tax/rounding breakdown.
4. Cashier optionally applies authorized discount with reason/authorizer.
5. Cashier selects tender and amount ≤ outstanding.
6. For cash, enters received amount and confirms server-calculated change.
7. Payment stays Pending until cashier confirms observed payment.
8. Confirmed allocation reduces outstanding.
9. Repeat tender if balance remains; no item/person split.
10. Final payment creates/locks receipt boundary and marks Session PAID.
11. Close Session; if close fails, retry close without recording payment again.

## 9. Payment unknown/failure

- Before confirmation: mark failed/cancelled attempt; outstanding unchanged.
- Response lost after confirmation request: query idempotency/payment status before offering retry.
- Confirmed payment but close failed: show Paid/Close Recovery with payment reference and Retry Close only.
- Duplicate tender key: return original attempt/result.

## 10. Preparing-item cancellation

1. Manager opens item detail.
2. UI states preparation/payment impact and asks required reason.
3. Server verifies Manager permission, current state/version and unpaid policy.
4. Commit cancellation/history/audit/outbox.
5. Kitchen/Waiter/Customer projections update.

Customer and ordinary Waiter never get a hidden direct control for this action.

## 11. Realtime disconnect/reconnect

1. Global status changes to Reconnecting then Offline/Stale with last sync.
2. UI keeps last known data visually marked stale.
3. Polling fallback starts; commands remain possible only when their risk policy allows and server confirms.
4. On reconnect, resync snapshot/cursor before clearing stale.
5. Gaps/conflicts appear as refreshed current state, not silently replayed local edits.

## 12. Staff session expiration during work

- Non-sensitive draft forms may be preserved locally for re-authentication.
- Payment/order/state commands are not automatically re-submitted after login.
- User re-authenticates, context/permission is reloaded, then explicitly reviews/resubmits with appropriate idempotency behavior.

## 13. Setup flow

1. Create Restaurant and Owner.
2. Configure Branch/currency/timezone/business-day test settings.
3. Configure stations.
4. Create menu/categories/items/modifiers/routing.
5. Create tables and QR.
6. Invite staff/assign Branch roles.
7. Run controlled test table Golden Path.
8. Production-specific tax/receipt/privacy settings remain blocked until approved.

## Deferred workflow boundaries

No UI flow is designed as functional for Split Bill, Refund, Void, Reopen, table transfer/merge/split, online payment, menu scheduled publishing, inventory, reservation, delivery, loyalty, E-Invoice or supplier integration.
