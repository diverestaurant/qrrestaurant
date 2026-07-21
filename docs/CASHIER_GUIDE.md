# Cashier Guide — Planning Template

Status: Local Cashier shell plus payment RPC/API slice implemented; not operational for the full workflow  
Last updated: 2026-07-21

## Planned checkout

1. Select a payment-requested table and verify Branch/table/Session.
2. Review authoritative subtotal, discount, service charge, tax, rounding, paid and outstanding.
3. Apply only an allowed discount with authorizer/reason.
4. Choose tender and amount not exceeding outstanding.
5. For cash, enter received amount and confirm displayed change.
6. Confirm only after cash/terminal/QR result is observed.
7. Add another tender if outstanding remains.
8. When paid, generate receipt and close Session.

## Critical recovery

- Unknown payment outcome: Check Status using the same transaction context; never create a second payment blindly.
- Failed payment: outstanding remains; record failure and retry intentionally.
- Paid but close failed: use Retry Close; do not take payment again.
- Duplicate conflict: inspect the existing payment result.
- Print failure: reprint existing receipt with reprint marker; do not regenerate payment.

## V1 boundaries

- Whole-session multi-tender only.
- No split by item/person.
- No online payment confirmation by the system.
- Refund/Void/Reopen are Deferred and require the approved external correction SOP.

## Final guide evidence

Requires owner-approved money/receipt rules, implemented screenshots, device/print procedure, reconciliation SOP and a successful cashier recovery drill.
