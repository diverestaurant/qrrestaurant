# Admin Guide — Planning Template

Status: Local Admin shell plus menu/report foundation implemented; not operational for the full workflow  
Last updated: 2026-07-21

## Intended tasks

- Sign in and verify Restaurant/Branch context.
- Complete Restaurant and Branch setup.
- Manage tables, QR rotation and print preparation.
- Manage menu, modifiers, availability, sold-out and station routing.
- Invite/disable staff and assign scoped roles.
- Configure approved operational/financial settings.
- Review live operations, reports and masked audit.
- Manage basic feature flags within permission.

## Required warnings

- Immediate menu publication affects live customer ordering.
- Branch timezone/currency/business-day/charge changes affect reports or money and require approved effective-date policy.
- QR rotation invalidates the old entry.
- Role changes can escalate access or lock out operators.
- Audit and financial records are not directly editable.
- Split bill/refund/void/reopen and scheduled menu publish are Deferred.

## Recovery topics

- Unsaved edit, version conflict and permission denial.
- Failed image upload.
- QR batch/print failure.
- Suspended staff/session revoke.
- Report empty/large-range/timezone mismatch.
- Audit investigation and incident escalation.

## Final guide evidence

Add verified screenshots, exact navigation labels, role prerequisites, implemented error states and a tested task checklist after Admin implementation stabilizes. Until then use `ui/SCREEN_INVENTORY.md` as design input, not operational instruction.
