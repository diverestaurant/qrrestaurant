# Kitchen Guide — Planning Template

Status: Local KDS shell/API slice implemented; not operational for the full workflow  
Last updated: 2026-07-21

## Planned startup

1. Sign in and verify Branch/role.
2. Select authorized station/device context.
3. Check connection, last sync, full-screen/wake and audio permission.
4. Confirm visible alert works even if sound is blocked.

## Planned item workflow

```text
Submitted → Accepted → Preparing → Ready
```

- Read table, quantity, variant, modifiers and notes before accepting.
- Act on item state, not a whole-order shortcut that hides partial station work.
- Reject only before preparation with required permission/reason.
- After preparation starts, cancellation is Manager-only.
- Expo/Waiter marks served; kitchen does not fabricate payment/service state.

## Incident behavior

- Reconnecting/Stale: use last sync and wait for resync/polling; do not repeat commands blindly.
- Conflict: another device acted; refresh and follow current state.
- Unassigned item: send to Expo/Manager queue; do not ignore.
- Audio failure: keep visible alerts and notify lead.
- Full KDS outage: follow approved paper/verbal fallback and reconcile when restored.

## Final guide evidence

Requires implemented screenshots, station-specific SOP, device model, audio/wake procedure, fallback owner and successful Kitchen training drill.
