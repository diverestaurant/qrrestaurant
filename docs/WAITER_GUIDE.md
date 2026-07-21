# Waiter Guide — Planning Template

Status: Local Waiter shell plus Session/service-request API slices implemented; not operational for the full workflow  
Last updated: 2026-07-21

## Planned core tasks

- Sign in and confirm Branch/service context.
- Read floor/table/service-request priorities.
- Open an available table with guest count.
- Show/communicate the current Session Join Code without recording it in unsafe channels.
- Enter an assisted order with staff attribution.
- Mark individual items served and resolve service requests.
- Send payment request to Cashier.
- Clear only after Session is validly closed.

## Restrictions

- Do not edit trusted menu price, tax, service charge or payment.
- Do not cancel preparing items without Manager workflow.
- Do not close unpaid Session or reuse an old Session/Join Code.
- Transfer/merge/split/reopen are Deferred.

## Recovery

- Table already opened: refresh and join the current operational view; do not create another Session.
- Conflict: read current actor/state and retry only if action remains allowed.
- Customer cannot join: verify exact table/current code, then rotate through authorized action if necessary.
- Offline/stale: use approved manual fallback and reconcile; never promise an unconfirmed order.

## Final guide evidence

Requires implemented navigation/screens, Branch procedures, Manager escalation, fallback SOP and an unassisted waiter training exercise.
