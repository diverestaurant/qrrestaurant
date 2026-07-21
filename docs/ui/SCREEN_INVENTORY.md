# Screen Inventory

Status: Planned; no screens implemented  
Last updated: 2026-07-20

Every screen uses a formal View Model and named commands from `../API_CONTRACTS.md`. Common states include Loading, Empty, Error, Offline, Reconnecting, Stale, Permission Denied, Suspended, Session Expired, Conflict, Success and Partial Success as applicable.

## Common employee screens

| Screen | Role/purpose | Entry and primary action | Data/permission | Required exceptions and success |
|---|---|---|---|---|
| Login | All staff authenticate | Direct/protected redirect; Sign in | Auth provider, no tenant data before auth | Invalid/locked/suspended/MFA/reset; success routes to context |
| Branch context | Multi-branch staff select exact workplace | Post-login/header; Continue in Branch | StaffContextView, active membership | No branch/wrong branch/suspended; success persists safe context |
| Session expired | Restore authentication safely | Any protected route; Sign in again | Auth status | Preserve non-sensitive route intent, not unsubmitted financial commands |
| No permission | Explain denial | Direct/deep link/action | Server authorization result | Do not reveal hidden data; link to permitted home |
| Account/tenant suspended | Stop operations | Login/refresh | Active tenant/membership | Support contact; no operational data mutation |
| Profile/logout | Confirm actor/context and leave session | Shell menu; Log out | Safe profile/context | Pending action warning; success revokes local session |
| Connectivity panel | Explain freshness and recovery | Global status control | Realtime/poll health, last sync | Audio/offline/stale/retry diagnostics |

## Customer mobile screens

| Screen | Purpose | Entry/primary action | Data/permission | Exceptions/success |
|---|---|---|---|---|
| Table entry/menu | Show correct restaurant/menu immediately | QR URL; Browse/add item | ResolveTableEntry + CustomerMenuView; public | Invalid/revoked QR, inactive branch/table, loading/offline cached shell |
| Session join | Obtain current Session capability | Ordering action when no grant; Join | Anonymous identity + Join Code | Invalid/expired/rate-limited code, closed/no Session; success opens current session |
| Item detail/configurator | Select variant/modifiers/quantity/note | Menu item; Add to cart | Menu item contract | Sold out, required min/max, long content; success updates cart |
| Cart | Review editable order | Persistent cart entry; Review order | Local draft + current menu view | Empty, changed/invalid line, offline; preserve edits |
| Submit review | Confirm table/items/estimate | Cart; Submit order | SubmitOrder contract/live grant | Pending, unknown outcome, item repair, price change, closed grant, duplicate |
| Order success | Confirm authoritative order | Server result; View order status | Confirmed order result | Never shown without commit; display correlation/help path |
| Current session/orders | Track this Session only | Persistent nav; Add order | CustomerSessionView/live grant | Stale/reconnect/closed/revoked; no historical Session |
| Service request | Ask waiter/water/cutlery/bill | Persistent action; Send request | Grant + request contract | Duplicate/claimed/resolved/offline; clear current status |
| Bill requested | Explain handoff | Request bill result | Session state | Ordering paused/resumed/payment progress/closed |

## KDS tablet/desktop screens

| Screen | Purpose | Entry/primary action | Data/permission | Exceptions/success |
|---|---|---|---|---|
| Device/station setup | Select Branch/station and readiness | First run/settings; Start station | Staff context/stations | Unsupported device, no permission, wake/audio/fullscreen guidance |
| Live queue | Make next item | KDS home; Accept/Start/Ready | KdsQueueView, station permission | Empty, stale, offline, conflict, unassigned, long notes, partial order |
| Item/order detail | Read all preparation context | Queue card; Advance state | Item snapshot/version | Unknown modifier, routing issue, cancellation/rejection reason |
| Expo/all stations | Coordinate complete orders | Shell nav; Mark served/handoff | Branch expo permission | Mixed station status, delayed item, partial readiness |
| Recently completed | Recall recent work | Queue secondary tab; Inspect | Bounded history | Empty/stale; no unauthorized reversal |
| Unassigned queue | Resolve routing gaps | Visible alert; Assign/escalate | Manager/expo permission | Station unavailable, conflict, audit reason |
| KDS settings/status | Audio, density, station, sync health | Shell control; Apply safe setting | Device-local + server context | Unsaved, permission, audio failure, reconnect |

## Waiter mobile screens

| Screen | Purpose | Entry/primary action | Data/permission | Exceptions/success |
|---|---|---|---|---|
| Floor list/map | See what needs attention | Waiter home; Open table/request | WaiterFloorView | Empty, stale, branch mismatch, status conflict |
| Service inbox | Claim and resolve requests | Badge/nav; Claim next | Service requests/version | Duplicate, already claimed, urgent priority, offline |
| Table/session detail | Understand and act for one table | Floor; context-specific action | Session/order/request summaries | Session changed/closed/payment pending/permission |
| Open table | Start Session/Join Code | Available table; Open | Table/version/open permission | Already opened, invalid guest count; success shows code |
| Session Join Code | Help diners join/rotate | Session action; Show/rotate code | Session capability admin | Expired/rotate conflict; never expose code in logs |
| Assisted order | Submit for diner with staff attribution | Session; Add order | Menu/Submit staff command | Same cart repair/price/availability rules |
| Serving workflow | Mark partial/all served | Session/items; Mark served | Item version/permission | Already served/conflict/wrong station if restricted |
| Cashier handoff | Request checkout | Session; Send to cashier | Session/version | No orders/already pending/partial payment |
| Clear table | Finish physical turnover | Closed Session; Mark available/clean | Table-turn permission | Session not closed, conflict, required reason |

## Cashier tablet/desktop screens

| Screen | Purpose | Entry/primary action | Data/permission | Exceptions/success |
|---|---|---|---|---|
| Checkout queue | Find waiting tables | Cashier home; Open bill | Branch session summaries | Empty/stale/another cashier active/conflict |
| Bill detail | Verify authoritative amount | Queue; Begin checkout | CashierSessionView | Price state invalid, changed version, permission, prior partial payment |
| Apply discount | Authorized adjustment | Bill; Apply discount | Rules/caps/authorizer | Missing reason, over cap, concurrent bill change |
| Payment entry | Record tender safely | Bill; Confirm payment | Outstanding/method/version/idempotency | Duplicate/unknown outcome/failed/exceeds balance |
| Cash keypad/change | Confirm cash received/change | Payment method cash; Confirm | Server-calculated due/change | Insufficient cash, decimal/format error, conflict |
| Partial/multi-tender summary | Complete remaining balance | Payment result; Add tender | Allocations/outstanding | No item/person split; prevent overpayment |
| Paid/close recovery | Close without repaying | Confirmed final payment; Retry close | PAID Session/receipt | Receipt exists, close failure, stale state |
| Receipt | Display/print/reprint | Paid/closed; Print | Immutable receipt view | Print failure, reprint marker, no silent edits |
| Reconciliation | Review daily tender exceptions | Cashier/admin nav; Resolve/acknowledge | Authorized daily summary | Missing ref, payment/session mismatch, timezone filter |

## Admin desktop screens

| Screen | Purpose | Entry/primary action | Data/permission | Exceptions/success |
|---|---|---|---|---|
| Setup checklist | Guide first configuration | Admin home; Continue next step | Tenant setup View Model | Incomplete/blocking fields, permission |
| Live operations dashboard | Monitor orders/tables/requests | Admin home; Investigate issue | Branch operational summary | Stale/partial source failure |
| Restaurant profile | Manage safe tenant identity/brand | Configuration; Save | Restaurant settings permission | Unsaved, invalid asset/contrast, conflict |
| Branch management | Configure Branch/timezone/currency | Configuration; Save | Owner/Platform permission | Impact warning, existing data, inactive branch |
| Table/QR management | Create labels/rotate/print QR | Configuration; Generate/rotate | Table/QR permission | Duplicate label, revoke impact, batch print failure |
| Menu categories/items | Manage current menu | Menu nav; Save/publish update | Menu permission/version | Unsaved, conflict, invalid modifiers, upload failure |
| Sold-out operations | Rapid live availability | Live operations; Toggle | Availability permission/version | Concurrent change, affected Branch scope |
| Modifier management | Configure selection rules | Menu; Save | Menu permission | min/max inconsistency, in-use history safe |
| Station management | Configure routing | Operations/config; Save | Station permission | Unassigned items, disabling active station impact |
| Staff list/invite | Manage access lifecycle | People; Invite/disable | Staff permission | Duplicate identity, last owner, session revoke |
| Role matrix | Preview/change permissions | People; Apply role change | Role permission | Escalation, self-lockout, scope preview, audit reason |
| Orders/payments | Investigate operations | Records; Open record | Scoped read permission | Masked data, no unsupported correction action |
| Reports | Understand performance | Reports; Apply filters | Report permission | Empty/large range/timezone/currency/export failure |
| Audit viewer | Inspect sensitive change trail | Security; Inspect diff | Audit permission | Masked fields, large range, export control |
| Feature flags | Control scoped rollout | Platform/config; Apply | Flag permission | Scope/effective time/rollback explanation |
| Settings | Configure charges/operations | Configuration; Save | Owner/authorized Manager | Requires business confirmation, effective-date impact |

## Platform screens

- Platform tenant list/detail/create/suspend.
- Platform feature entitlement.
- Platform system health and cross-tenant audit access.
- Break-glass/audit workflow for privileged support.

These require stronger authentication and are not combined with ordinary Restaurant Admin navigation.

## Deferred screens that must not silently appear

- Split bill by person/item.
- Refund/Void/Reopen.
- Online payment checkout.
- Menu draft/scheduled publish/rollback.
- Table transfer/merge/split.
- Hardware printer configuration.
- Inventory/reservation/delivery/loyalty/E-Invoice/supplier.

If shown as roadmap information, they must be non-interactive and clearly labelled unavailable; production navigation should generally omit them.
