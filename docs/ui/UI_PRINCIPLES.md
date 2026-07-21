# UI Principles

Status: BUILD design input; independent UI/UX Subagent review recorded in `UI_REVIEW_REPORT.md`  
Last updated: 2026-07-20

## Product character

The interface should feel calm, clear, predictable, fast and low-learning-cost in a noisy restaurant. Simplicity means reducing ambiguity and unnecessary steps, not hiding required status, authorization or recovery.

## 1. One clear next action

- Each screen has one visually dominant primary action.
- Competing actions are secondary, grouped or moved to an explicit overflow only when they remain discoverable.
- Critical actions use text labels; icons may reinforce but never replace meaning.
- No essential action depends only on hover, swipe, long press or gesture memory.

## 2. Make system truth visible

- Distinguish estimated cart price from authoritative server-confirmed order/bill.
- Distinguish Pending, Confirmed, Failed, Unknown Outcome, Stale and Conflict.
- Show table, Branch, actor and role context continuously on employee shells.
- Show last sync and connection status when operational data can become stale.
- Realtime arrival never appears as confirmation of a command unless the server result is matched.

## 3. Preserve work and recover safely

- Validation, availability and price errors preserve cart/form input.
- Retrying a command reuses the same idempotency key where outcome may be unknown.
- Conflict screens explain who/what changed and offer refresh/reapply, not blind overwrite.
- Payment and closing recovery never asks the cashier to pay again without checking current status.
- Destructive actions require proportional confirmation, reason, permission and audit.

## 4. Role-specific focus

- Customer: find food and order with minimal interruption.
- Kitchen: decide what to make next and act reliably under peak load.
- Waiter: understand floor needs and resolve them quickly on a phone.
- Cashier: verify money, prevent duplicate payment and close safely.
- Admin: configure deliberately, understand impact and inspect evidence.

Role apps share primitives and language, not incompatible workflows or one conditional mega-dashboard.

## 5. Speed without false optimism

- Press feedback target ≤100ms.
- Use optimistic UI only for reversible, low-risk local feedback; order/payment/state truth waits for server confirmation.
- Skeletons reflect final geometry and do not conceal long waits.
- Avoid decorative animation in high-frequency operations.
- Motion communicates feedback/spatial continuity, usually ≤300ms, with reduced-motion alternative.

## 6. Accessibility is operational reliability

- WCAG 2.2 AA target.
- Body text default ≥16px.
- Touch targets ≥44×44 CSS px; frequent staff controls target ≥48×48.
- Visible focus, logical tab order and screen-reader names.
- Status uses text/icon/shape as well as color.
- 200% zoom/text enlargement does not hide critical actions.
- Customer pages support 320px width without page-level horizontal scroll.

## 7. Content is part of the control

- Error copy states what happened, whether the action succeeded, and the next safe step.
- Avoid “Something went wrong” as the only message.
- State labels use consistent verbs and tense.
- Sensitive confirmation names the table/order/amount/impact.
- English is complete; layouts handle pseudo-long text and future Chinese/Bahasa Melayu.

## 8. Context and privacy

- Show public Restaurant/Branch/Table label without exposing internal IDs.
- Customer screens never show prior Session data.
- Staff screens show only task-relevant customer/order/payment data.
- Do not expose secret token values after issuance or copy sensitive data into toasts/logs.

## 9. Tenant branding boundary

- Logo, approved brand colors, branch name, locale and currency come from validated tenant configuration.
- Tenant theming is limited to controlled tokens/assets/content/feature flags.
- No arbitrary remote CSS, JavaScript, font or icon packages.
- Accessibility contrast and layout constraints override unsafe brand choices.

## 10. Design review questions

For every screen:

1. Who is the role and what single task are they completing?
2. What is the authoritative data source and freshness state?
3. What permission and entity state enables each action?
4. What happens on slow network, validation failure, conflict and partial success?
5. Can keyboard, touch, screen reader and reduced-motion users complete it?
6. Does the UI request any YELLOW/RED contract or architecture change?

No UI milestone may be marked complete until the independent BUILD-stage review answers these against working screens.
