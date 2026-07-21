# Usability Test Plan

Status: Planned; no participants recruited or tests run  
Last updated: 2026-07-20

## Objectives

- Verify first-time diners can order without training.
- Verify Kitchen/Waiter/Cashier can operate accurately under time pressure and network problems.
- Verify Admin can configure without unsafe scope/permission mistakes.
- Identify hidden actions, unnecessary steps, cognitive load and recovery failures.

## Participants

Finish Line C target:

- At least 5 representative first-time Customers.
- At least 5 representative participants for each key operational role, or a user-approved equivalent sampling plan when the restaurant has fewer staff in a role.
- Participants must not have built the feature they test.
- Record device familiarity and accessibility needs without collecting unnecessary personal data.

Engineering walkthroughs and the independent UI/UX Subagent review occur earlier but do not replace representative-user Pilot evidence.

## Environments

- Production-like Staging for pre-release sessions.
- Controlled Production/Pilot only after RELEASE/PILOT authorization.
- Target phones, KDS tablet, waiter phone, cashier device and admin laptop.
- Include stable network and controlled loss/latency/disconnect scenarios.

## Customer tasks

1. Scan correct table and find a specified item.
2. Add a simple item in one principal action.
3. Configure required variant/modifiers.
4. Review cart and submit.
5. Recover from sold-out/price-change response.
6. Find current order and add another item.
7. Request water/service and bill.
8. Encounter closed Session and explain what to do.

Target: ordinary selection-to-submit ≤2 minutes excluding menu reading; critical task completion 100%; overall unassisted completion ≥90%.

## Kitchen tasks

- Pair/select station and verify audio state.
- Accept/start/ready new items.
- Handle long notes/modifiers and partial station order.
- Resolve a multi-device conflict.
- Continue during realtime disconnect/polling and verify freshness.
- Find recently completed item without reversing it.

## Waiter tasks

- Identify most urgent table/request.
- Open table and help customer join.
- Enter assisted order.
- Serve partial items and correct conflict.
- Handoff bill to Cashier.
- Clear only an eligible table.

## Cashier tasks

- Find payment-requested table and verify total.
- Apply authorized discount with reason.
- Record cash with change.
- Complete two-tender payment.
- Recover from unknown outcome and paid-but-close-failed.
- Reprint receipt without creating another payment.

Zero tolerance: wrong table, incorrect amount, duplicate payment, false paid state or unintended Session close.

## Admin tasks

- Complete Branch/table/menu/station setup.
- Mark item sold out and restore.
- Invite/disable staff and preview role change.
- Rotate/print QR with scope awareness.
- Run branch/date/timezone report.
- Inspect masked audit change.
- Respond to unsaved/conflicting edit.

## Measures

- Completion/abandonment.
- Unassisted vs assisted completion.
- Time on task and excessive backtracking.
- Error/recovery count and severity.
- Wrong entity/scope/money actions.
- Confidence and short qualitative feedback.
- Accessibility barriers.

## Severity

- Critical: tenant/table/money/data/safety breach or unrecoverable wrong action.
- High: Golden Path cannot complete or frequent serious operational error.
- Medium: recoverable delay/confusion with workaround.
- Low: cosmetic/content improvement.

Critical/High blocks release. Must Fix issues receive revision and regression usability test.

## Privacy

- Obtain participant consent for observation/recording.
- Use synthetic/controlled data before Pilot.
- Do not include auth tokens, real payment secrets or unnecessary faces/names in artifacts.
- Retain notes/recordings only for approved period and access.

## Evidence

For every session record role, build/commit, environment, device/browser, tasks, outcomes, issues and moderator. Aggregate report links from `UI_REVIEW_REPORT.md` and `FINISH_LINE.md`.
