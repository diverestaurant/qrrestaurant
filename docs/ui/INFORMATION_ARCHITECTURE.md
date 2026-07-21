# Information Architecture

Status: Planned  
Last updated: 2026-07-20

## 1. Route and shell separation

Proposed public route:

```text
/order/{restaurantSlug}/{branchSlug}/{tableToken}
```

Proposed role homes:

```text
/kds
/waiter
/cashier
/admin
/platform
```

Final URLs may include locale and safe branch context, but internal IDs and capability secrets do not appear in permanent public URLs.

## 2. Customer hierarchy

```text
Table entry
├── Menu
│   ├── Category
│   └── Item configurator
├── Cart
├── Current session
│   ├── Orders/status
│   ├── Add order
│   └── Bill status
└── Service request
```

Session join appears only when a capability-required action is attempted or current-session access is requested. Public menu browsing remains immediate.

Persistent mobile elements:

- Restaurant/Branch/Table context.
- Cart quantity/estimated amount when non-empty.
- Current Session/orders entry when joined.
- Service/help entry.

## 3. KDS hierarchy

```text
Live queue
├── Station filter
├── Item/order detail
├── Expo/all stations
├── Unassigned
└── Recently completed

Device/status
├── Station pairing
├── Audio/fullscreen/wake guidance
└── Connection/last sync
```

The queue remains the dominant home. Settings never compete with fulfillment actions.

## 4. Waiter hierarchy

```text
Floor
├── Table/session detail
│   ├── Open table / Join Code
│   ├── Assisted order
│   ├── Orders/serving
│   └── Cashier handoff
├── Service inbox
└── Notifications/status
```

Floor and service inbox are first-level destinations. Branch/actor/context remains visible.

## 5. Cashier hierarchy

```text
Checkout queue
└── Bill detail
    ├── Discount
    ├── Payment/multi-tender
    ├── Paid/close recovery
    └── Receipt/reprint

Reconciliation
```

Financial flow is linear and prevents accidental navigation away during a pending/unknown payment outcome.

## 6. Admin hierarchy

Separate live operations from configuration:

```text
Overview
Live Operations
├── Tables/Sessions
├── Orders
├── Service Requests
└── Payments

Menu
├── Categories & Items
├── Modifiers
├── Availability/Sold Out
└── Kitchen Stations

People & Access
├── Staff
└── Roles & Permissions

Configuration
├── Restaurant
├── Branches
├── Tables & QR
├── Charges/Tax/Rounding
└── Feature Flags

Reports
Audit & Security
```

Platform navigation is separate from Restaurant Admin.

## 7. Context selection

- Restaurant scope is shown to Owners/Platform users.
- Branch scope is mandatory for KDS, Waiter and Cashier.
- Changing Branch with unsaved/pending work requires confirmation and invalidates scoped cache/subscription.
- Deep links verify context; they never silently switch into an unauthorized Branch.
- Wrong Branch warning names current vs requested context without exposing unauthorized data.

## 8. State placement

- Global: auth expiry, tenant suspension, offline/reconnecting, current actor/branch.
- Page: loading/empty/error/permission for a route query.
- Entity: stale/version conflict/status.
- Command: pending/confirmed/failed/unknown outcome.
- Field/item: validation, availability and repair.

Do not collapse these into a single generic toast. Persistent problems remain visible until resolved.

## 9. Navigation accessibility

- Landmarks and heading hierarchy.
- Skip-to-content on employee desktop shells.
- Mobile navigation uses labelled controls and focus-managed sheets/dialogs.
- Current destination indicated by more than color.
- Keyboard focus moves to new route/main heading or blocking error intentionally.

The independent UI/UX Subagent must validate this IA against real workflow prototypes before BUILD role implementations.
