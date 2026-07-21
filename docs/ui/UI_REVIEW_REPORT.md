# UI Review Report

Review date: 2026-07-20  
Mode: `BUILD` — local-only  
Review type: independent UI/UX Foundation Gate  
Independent UI/UX Design Subagent: **Peirce** — completed, read-only

## Conclusion

**Conditional pass for GREEN local implementation.** The independent review found the five role boundaries and Golden Paths coherent: Customer public menu/session join, KDS station queue, Waiter floor/service, Cashier authoritative bill/tender and Admin configuration/report/audit. No files were changed by the subagent and no remote environment was accessed.

## Required boundaries retained

- Static QR is entry context, not authorization; a live session and Join Code/grant are required.
- Customer order estimate is not authoritative; only server-confirmed order state is success.
- Payment unknown outcome requires status check before retry.
- Realtime is an accelerator; database commit and refresh are the source of truth.
- Split/refund/void/reopen/scheduled publish remain deferred and must not appear as dead-end mock controls.

## UI Architecture Impact Warning

| Change | Classification | Rule |
|---|---|---|
| Tokens, layout, role shell, focus treatment, copy structure | GREEN | May proceed locally while preserving contracts. |
| Existing freshness/outcome/recovery states or new shared state/dependencies | YELLOW | Review impact and preserve the typed contract. |
| QR authorization/session grants, money, offline auto-submit, schema, RLS, permissions, state machine | RED | Stop and obtain an explicit product/architecture decision. |

## Review risks to carry into implementation

- Verify 320/360/768 mobile widths, keyboard and sticky-action overlap.
- Verify KDS viewing distance/density and audio fallback behavior.
- Verify cashier integer-money rendering, printing fallback and unknown-payment recovery.
- Verify Admin tables at 200% zoom and all five-role responsive boundaries.
- Add approved Chinese/BM strings before localization acceptance.
- Exercise Join Code focus, masking/paste behavior, live-region feedback, stale/offline states and staff expiry.

## Remaining UI gates

Device matrix, automated/manual accessibility, visual regression, localization review, representative-user usability and performance measurements are not complete. UI status is `Implemented` for the local foundation and `Tested Locally` for the current browser checks; it is not independently device-approved or production-ready.
