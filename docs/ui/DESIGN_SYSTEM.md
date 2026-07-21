# Design System Plan

Status: Token/component specification only; no implementation  
Last updated: 2026-07-20

## 1. Layering

```text
Design tokens
→ visual primitives
→ interaction patterns
→ role-aware feature components
→ page composition
```

Design tokens and primitives contain no order, permission, money, Session or database logic.

## 2. Token groups

- Color: background/surface/text/border/accent plus semantic info/success/warning/danger/neutral.
- Typography: interface, numeric/monospace, heading, body, label, caption.
- Space: consistent 4px-based scale with role density profiles.
- Radius: restrained small/medium/large values.
- Elevation: minimal layers for popover/dialog/sticky controls.
- Motion: fast feedback, standard transition, reduced/none.
- Size: touch targets, controls, nav, KDS card minimums.
- Z-index: documented shell/sticky/popover/dialog/toast order.

Restaurant branding maps only to approved accent/logo/content tokens. Semantic colors and contrast remain system-controlled.

## 3. Typography

- Default UI body ≥16px.
- Operational identifiers, amounts, timers and timestamps may use a tabular/monospace face where clarity improves.
- KDS critical quantity/table/timer use larger sizes at viewing distance.
- Avoid all-uppercase paragraphs and low-contrast captions.
- Use locale-aware numeric/currency formatting; never hand-concatenate `RM` and values in components.

Font selection is finalized in BUILD. Prefer self-hosted/framework-optimized fonts and system fallbacks; do not add remote fonts without licensing/performance review.

## 4. Semantic state language

Every state has:

- Text label.
- Optional icon/shape.
- Color token.
- Accessible name/description.

Do not encode New/Preparing/Ready/Paid only as red/yellow/green. Timer/SLA warnings state elapsed time and threshold.

## 5. Primitive inventory

- Button, IconButton with label/tooltip as appropriate.
- Input, Textarea, Select/Combobox, Checkbox, Radio, Switch.
- Card/surface, Separator, Badge, Alert, Progress/Spinner/Skeleton.
- Dialog, AlertDialog, Sheet/Drawer, Popover, Dropdown.
- Tabs, Table/Data Grid pattern, Pagination/filter bar.
- Toast for transient confirmation only; persistent errors stay inline/banner.
- Visually hidden text, focus ring and live region utilities.

shadcn/ui may supply accessible primitives, but product state and content still require review.

## 6. Interaction patterns

- Confirm dangerous action: entity + impact + required reason + irreversible/recovery statement.
- Unknown command outcome: persistent panel with Check Status/Retry Safely.
- Conflict: current server value/version + refresh/reapply, no blind overwrite.
- Offline/stale: persistent shell banner/status, not toast.
- Empty: explain why and one appropriate next action.
- Partial success: list completed and failed items separately.
- Unsaved change: route/branch change guard.
- Amount entry: locale-safe digits, server validation, tabular figures and explicit minor/currency handling.

## 7. Feature component boundaries

Examples:

- `MenuItemCard` consumes `MenuItemView` and emits `SelectItem` intent.
- `CartSummary` consumes local cart projection and server estimate label; no Pricing Engine.
- `KdsItemCard` consumes state/version/capabilities and emits named command intent.
- `BillBreakdown` renders authoritative `CashierSessionView`; it does not calculate totals.
- `PermissionGate` may hide/disable affordances but never replaces server authorization.

## 8. Motion

- 100–200ms press/state feedback.
- 150–300ms sheet/dialog/spatial changes.
- No continuous pulsing for whole queues; critical new item alert stops after acknowledgement or bounded duration.
- Reduced motion removes transforms/animated reordering while preserving state indication.
- High-frequency KDS/Waiter actions prioritize instant clarity over delight.

## 9. Density modes

- Customer: comfortable touch density.
- Waiter: compact but ≥48px frequent targets.
- KDS normal: readable at arm/viewing distance.
- KDS peak: more cards through information prioritization, not sub-16px body text.
- Cashier/Admin: desktop density with keyboard support and responsive touch fallback.

## 10. Content tokens

State labels, action verbs, errors and confirmations live in locale resources keyed by semantic intent. English copy is complete. Pseudo-long tests use ~30–50% expansion. Chinese/BM content is enabled only after approved translation.

## 11. Gate

The independent UI/UX Design Subagent must validate token semantics, role density, component states, branding constraints and accessibility before implementation. This plan is not that independent approval.
