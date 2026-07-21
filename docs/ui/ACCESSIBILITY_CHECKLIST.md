# Accessibility Checklist

Target: WCAG 2.2 AA  
Status: Planned; no automated or manual implementation evidence  
Last updated: 2026-07-20

## Global

- [ ] Valid language and locale metadata.
- [ ] Logical headings and landmark regions.
- [ ] Skip link for employee desktop shells.
- [ ] Full keyboard operation; no keyboard trap.
- [ ] Visible focus at least WCAG 2.2 requirements.
- [ ] Focus order follows task order after navigation/dialog/errors.
- [ ] Touch targets ≥44×44; high-frequency staff targets preferably ≥48×48.
- [ ] Text/background and non-text contrast meet AA.
- [ ] State never relies on color alone.
- [ ] 200% zoom and text enlargement preserve content/actions.
- [ ] Reduced motion respected.
- [ ] No unexpected auto-focus, motion, sound or timeout without control.

## Forms and commands

- [ ] Every input has persistent label/instructions.
- [ ] Required/optional and modifier min/max announced.
- [ ] Field errors linked to fields and summarized on submit.
- [ ] Error text says whether command succeeded and next step.
- [ ] Pending controls expose busy state and prevent accidental duplicate action without trapping recovery.
- [ ] Dangerous action dialog names entity/impact and receives intentional focus.
- [ ] Amount inputs work with keyboard, screen reader and mobile numeric keypad.

## Dynamic/realtime content

- [ ] New KDS/order/request events do not steal focus.
- [ ] Live regions announce concise priority changes, not every timer tick.
- [ ] Elapsed timers have readable text and do not continuously spam assistive tech.
- [ ] Offline/reconnecting/stale status is programmatically available.
- [ ] Conflict and partial success are announced and focus moves to recovery summary.
- [ ] Audio alerts have visible equivalent and permission/failure state.

## Customer

- [ ] 320px width has no page-level horizontal scroll.
- [ ] Sticky cart/primary action does not obscure content/focus.
- [ ] Item images have meaningful alt text or empty alt when decorative.
- [ ] Modifier groups expose radio/checkbox semantics and limits.
- [ ] Quantity control has name, current value and ≥44px controls.
- [ ] Cart changes and authoritative order result are announced.
- [ ] Join Code supports paste/autofill and does not reveal sensitive detail in error.

## KDS

- [ ] Table, quantity, item, state and elapsed time readable at target viewing distance.
- [ ] Density mode maintains minimum readable text.
- [ ] Touch and keyboard paths for accept/prepare/ready.
- [ ] Long notes/modifiers wrap and remain accessible.
- [ ] Priority/SLA uses text/icon in addition to color.

## Waiter/Cashier/Admin

- [ ] Mobile/desktop navigation labelled and current state announced.
- [ ] Data tables have captions/headers or accessible responsive alternative.
- [ ] Filters have explicit applied state and clear reset.
- [ ] Financial totals use unambiguous labels and reading order.
- [ ] Print/receipt content has accessible screen version.
- [ ] Drag-and-drop sorting has keyboard alternative if implemented.

## Test matrix

- Automated: axe or equivalent on critical screens/states.
- Keyboard-only manual pass in Chrome/Safari target environments.
- Screen reader: VoiceOver/Safari and at least one additional approved combination.
- Zoom/reflow at 200% and 400% where criterion applies.
- Reduced motion, high contrast/forced colors where supported.
- Real touch target and outdoor/restaurant visibility checks.

No checkbox may be marked complete without artifact reference in `UI_REVIEW_REPORT.md` or `TEST_REPORT.md`.
