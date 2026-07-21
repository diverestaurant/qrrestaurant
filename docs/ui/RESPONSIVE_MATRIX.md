# Responsive and Device Matrix

Status: Planned; requires real-device validation  
Last updated: 2026-07-20

## Viewport classes

| Class | Width/orientation | Primary roles | Layout expectation |
|---|---|---|---|
| XS phone | 320–374 portrait | Customer, Waiter | Single column, no page horizontal scroll, sticky primary/cart area |
| Phone | 375–479 portrait | Customer, Waiter | Single column; bottom/sheet navigation where appropriate |
| Large phone/small tablet | 480–767 | Customer, Waiter | Wider cards/two-up only when content remains clear |
| Tablet | 768–1023 portrait/landscape | KDS, Waiter, Cashier | Split panes or multi-column queues; touch-first |
| Desktop | 1024–1439 | KDS, Cashier, Admin | Persistent navigation, tables/panels, keyboard-first plus touch |
| Large display | ≥1440 | KDS/Expo, Admin reports | More columns with bounded reading widths; no uncontrolled stretching |

Breakpoints are implementation details; layouts should respond to available space/content, not device names alone.

## Role matrix

| Role | Minimum test | Target devices | Input | Special checks |
|---|---|---|---|---|
| Customer | 320×568 | Common iPhone/Android, Safari/Chrome | Touch, screen reader | one-handed reach, cart visibility, keyboard/input zoom |
| KDS | 768×1024 | 10–13-inch tablet and desktop display | Touch, mouse, keyboard | viewing distance, glare, landscape, density, wake/audio |
| Waiter | 360×640 | Android/iPhone | Touch, occasional keyboard | one hand, walking use, urgent requests, offline |
| Cashier | 768×1024 | Tablet/desktop | Touch, keyboard, numeric input | rapid tender entry, focus, print dialog, conflict |
| Admin | 1024×768 | Laptop/desktop | Keyboard/mouse | data tables, zoom, filters, unsaved changes |

## Responsive behavior

- Primary action stays reachable without covering error or total information.
- Dialogs become sheets/full-screen flows on narrow phones when content/keyboard requires it.
- Tables collapse to labelled rows/cards only when relationships remain understandable; financial columns may use controlled horizontal region, never page-wide accidental scroll.
- KDS cards preserve table, quantity, item, modifiers, note, elapsed time and state at every supported density.
- Staff shell context and connection status remain visible or one labelled action away.
- Mobile on-screen keyboard does not cover submit/error controls.

## Orientation and environment

- KDS supports tablet landscape and portrait; landscape is recommended for multi-column queue.
- Customer/Waiter do not require orientation change.
- Cashier supports tablet landscape and desktop.
- Test high brightness/glare, low-light contrast, noisy environment without reliance on sound and intermittent Wi-Fi.

## Text and localization

- 200% browser zoom on employee desktop flows.
- OS large text where browser exposes it.
- Pseudo-long English expansion 30–50%.
- Chinese/BM line-breaking and button label tests when approved strings exist.
- Currency/number/date formats do not overflow amount columns.

## Performance conditions

Record for each measurement:

- Device/model or emulation profile.
- Browser/version.
- Viewport and DPR.
- Network latency/bandwidth/loss.
- Cold/warm cache.
- Menu/order data volume.
- Build/commit/environment.

Real-device evidence is required for Finish Line A engineering device Gate and broader representative-user evidence for Finish Line C.
