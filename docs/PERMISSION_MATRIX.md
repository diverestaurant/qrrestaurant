# Permission Matrix

Status: Proposed V1 authorization contract  
Last updated: 2026-07-20

Legend:

- `P`: Platform scope
- `R`: Own Restaurant scope
- `B`: Authorized Branch scope
- `S`: Current customer Dining Session only
- `—`: Denied
- `C`: Conditional permission/state/reason required

| Capability | Platform Admin | Owner | Branch Manager | Kitchen | Waiter | Cashier | Customer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Create/suspend Restaurant | P | — | — | — | — | — | — |
| View cross-tenant system health | P | — | — | — | — | — | — |
| View cross-tenant audit | P/C | — | — | — | — | — | — |
| Manage Restaurant profile | P/C | R | — | — | — | — | — |
| Manage Branches | P/C | R | — | — | — | — | — |
| Manage Branch settings | P/C | R | B | — | — | — | — |
| Confirm tax/charge/rounding policy | — | R | C | — | — | — | — |
| Invite/disable staff | P/C | R | B/C | — | — | — | — |
| Assign Owner/Platform role | P/C | R/C | — | — | — | — | — |
| Assign Branch roles | P/C | R | B/C | — | — | — | — |
| View role matrix | P | R | B | — | — | — | — |
| Manage tables/QR | P/C | R | B | — | C | — | — |
| Open Dining Session | — | R | B | — | B | — | — |
| View active Session details | P/C | R | B | B/limited | B | B | S |
| Cancel open Session | — | R/C | B/C | — | C | C | — |
| Close paid Session | — | R/C | B/C | — | C | B | — |
| Force close/reopen | — | R/C | B/C | — | — | — | — |
| View public menu | P | R | B | B | B | B | Public |
| Manage menu content/prices | P/C | R | B/C | — | — | — | — |
| Toggle sold-out | P/C | R | B | B/C | B/C | — | — |
| Submit customer order | — | — | — | — | — | — | S |
| Submit staff-assisted order | — | R/C | B/C | — | B | — | — |
| Accept/reject submitted item | — | R/C | B/C | B | — | — | — |
| Mark preparing/ready | — | R/C | B/C | B | — | — | — |
| Mark served | — | R/C | B/C | C | B | — | — |
| Cancel before preparing | — | R/C | B/C | C/reject | C | — | — |
| Cancel after preparing | — | R/C | B/C | — | — | — | — |
| Create service request | — | — | — | — | — | — | S |
| Claim/resolve service request | — | R/C | B | — | B | C | — |
| Request bill | — | R/C | B/C | — | B | B | S |
| View bill | P/C | R | B | — | B/summary | B | S/summary |
| Apply discount | — | R/C | B/C | — | — | C | — |
| Create/confirm payment | — | R/C | B/C | — | — | B | — |
| View payment detail | P/C | R | B | — | — | B | — |
| Generate/reprint receipt | — | R/C | B/C | — | — | B | — |
| Refund/Void/Reopen paid | Deferred | Deferred | Deferred | — | — | — | — |
| View branch reports | P/C | R | B | — | C/limited | B/limited | — |
| View audit logs | P/C | R/C | B/C | — | — | — | — |
| Manage feature flags | P | R/C | B/C | — | — | — | — |

## Mandatory conditional checks

Every allowed cell is additionally constrained by:

- Auth identity is valid and not revoked/suspended.
- Restaurant and Branch are active.
- Membership is active and includes the exact Restaurant/Branch.
- Customer grant is active, unexpired, unrevoked and bound to exact Session/Table/Tenant.
- Entity belongs to the same composite tenant scope.
- Entity state permits the operation.
- Expected version matches for concurrent operations.
- Required reason/authorizer is supplied for sensitive operations.
- Server recalculates money and validates input schema.
- Idempotency key is valid for create/pay commands.

## Permission implementation model

- Stable permission keys, e.g. `session.open`, `order.prepare`, `payment.confirm`.
- System role templates map to keys; custom role support may be limited to Owner-managed mapping.
- Application authorization returns an explicit decision; RLS/database constraints remain defense in depth.
- UI reads a safe capability View Model for affordances but never treats it as the authoritative gate.
- Platform Admin access uses separate permissions, stronger authentication and full audit.

## Tests

Generate a policy test for each matrix cell plus:

- Same role, wrong Restaurant.
- Same role, wrong Branch.
- Suspended membership/tenant.
- Anonymous user attempting staff policy.
- Permanent staff attempting customer grant path.
- Expired/revoked customer grant.
- Entity scope tampering.
- State/version mismatch.
- Direct Data API access bypass attempt.

Final permission names and custom-role behavior require M2/M3 implementation review; this matrix is the design baseline.
