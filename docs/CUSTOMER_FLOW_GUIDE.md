# Customer Flow Guide — Design Baseline

Status: Local menu demo plus Join/order/service API slices implemented; full customer application is not complete  
Last updated: 2026-07-21

## Normal flow

1. Scan the static QR at the table.
2. Confirm Restaurant, Branch and Table label; browse menu without registration.
3. Select item, variant, modifiers, quantity and note.
4. Review cart and estimated amount.
5. Enter the current Session Join Code when first ordering/viewing current Session.
6. Submit once; wait for server confirmation.
7. View current Session orders, add another order or request service.
8. Request bill; Cashier confirms payment outside the customer flow.
9. Session closes and the customer's current-session access expires.

## Customer messages must explain

- Pending does not mean the order is accepted yet.
- Success appears only after server confirmation.
- If price/sold-out/modifiers changed, the affected item and repair are shown without clearing the cart.
- If network outcome is unknown, Check/Retry Safely prevents duplicates.
- The static QR alone cannot reveal current or previous table orders.
- A closed Session cannot accept more orders; contact staff for a new Session.

## Privacy

- No customer account or PII is required in V1.
- Do not enter unnecessary personal/sensitive information in notes.
- Anonymous device access is limited to the current Session and is revoked at close.

Final public guide requires approved English copy, translations if enabled, screenshots and usability validation.
