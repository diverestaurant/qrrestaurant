# System Architecture

Status: Local implementation baseline; deployment and production verification remain open  
Last updated: 2026-07-21

## 1. Architecture decision

V1 uses a single deployable Next.js App Router modular monolith with strict internal boundaries and Supabase as managed backend infrastructure.

Why:

- One small product team can change related order/session/payment flows atomically.
- A single deployment reduces restaurant operational complexity.
- Domain modules and typed ports preserve a later path to service extraction if proven necessary.
- Microservices would introduce distributed transactions, event operations and deployment overhead before V1 has scale evidence.

## 2. Logical context

```text
Customer browser ─┐
KDS browser ──────┤
Waiter browser ───┼─ HTTPS ─ Next.js application ─ Supabase Auth/Postgres/Storage
Cashier browser ──┤                 │                         │
Admin browser ────┘                 └─ Realtime subscription ┘

Future providers ← provider-neutral adapters/domain events
```

Database commit is authoritative. Realtime, cache, UI state and browser storage are projections or accelerators.

## 3. Deployable units

### V1

- One Next.js application.
- One Supabase project per environment.
- One Storage configuration per environment.
- Vercel is the preferred app host after explicit environment authorization.

### Deferred extraction candidates

- Payment provider webhook processor.
- Printer bridge/local agent.
- Notification worker.
- Analytics warehouse/export.
- E-Invoice or supplier integrations.

Extraction requires measured load, isolation, deployment or compliance need plus ADR.

## 4. Internal layers

```text
Presentation
  role pages, shells, feature UI, view models
        ↓
Interface adapters
  Server Actions, Route Handlers, realtime/polling adapters
        ↓
Application
  commands, queries, authorization orchestration, transactions
        ↓
Domain
  state machines, pricing, invariants, policy decisions, ports
        ↓
Infrastructure
  Supabase repositories, Auth, Storage, outbox, observability adapters
```

Dependencies only point downward. Infrastructure implements domain/application ports; domain never imports infrastructure.

## 5. Proposed source topology for BUILD

This topology is the governing implementation boundary; current local BUILD authority is recorded in `AGENTS.md` and does not authorize remote deployment.

```text
src/
  app/
    (customer)/order/[restaurantSlug]/[branchSlug]/[tableToken]/
    (staff)/kds/
    (staff)/waiter/
    (staff)/cashier/
    (staff)/admin/
    api/v1/customer/
    api/v1/realtime/
  modules/
    tenancy/
    identity/
    tables/
    sessions/
    menu/
    ordering/
    kitchen/
    service/
    pricing/
    payments/
    reporting/
    audit/
    each-module/
      domain/
      application/
      contracts/
      infrastructure/
  server/
    auth/
    supabase/
    observability/
  ui/
    primitives/
    patterns/
    role-shells/
  config/
  test/
supabase/
  migrations/
  tests/
  seed.sql or controlled initialization equivalent
```

Exact paths may adapt to the generated framework, but import boundaries and role separation are mandatory.

## 6. Role shells

- Customer: public/mobile, anonymous capability, dynamic current-session data.
- KDS: station/branch context, high-density realtime queue, touch/keyboard.
- Waiter: branch/shift/table context, mobile operational workflow.
- Cashier: branch/register context, financial workflow and stronger confirmations.
- Admin: restaurant/branch configuration and reporting.
- Platform: separate high-privilege navigation and authorization scope.

Shared primitives do not contain role rules. A universal page with many role conditionals is prohibited.

## 7. Request paths

### Queries

- Server Components call server-only Query Services and return minimal typed View Models.
- Client-side refresh/polling calls versioned Route Handlers returning the same View Model schemas.
- Personalized/session data is dynamic and never shared in public caches.
- Public menu may use cache tags scoped by restaurant/branch/menu revision, with explicit invalidation.

### Commands

- Staff form commands may use Server Actions as adapters.
- Customer/public commands use `/api/v1/customer/*` Route Handlers or equivalently versioned adapters.
- Every adapter parses Zod schema, authenticates, authorizes, resolves tenant scope, calls one application use case, maps typed result/error and emits correlation metadata.
- Adapters do not implement domain rules.

### Realtime

- Client receives versioned event hints.
- Client deduplicates by event ID and compares entity version.
- Any gap/stale/conflict triggers authoritative query resync.

## 8. Trust boundaries

Untrusted:

- Browser input, URL tokens, cookies not verified by Auth, prices, totals, role UI, event payload ordering, uploaded files, headers and client timestamps.

Trusted only after verification:

- Supabase Auth identity/claims from server-authenticated context.
- Active staff membership or customer Session grant from database.
- Server-loaded menu/rules/state/version.
- Committed database transaction result.

Privileged:

- Migrations, controlled initialization, background administrative jobs and narrowly justified SECURITY DEFINER functions.
- Privileged paths require least privilege, explicit grants, audit and dedicated tests.

## 9. Framework version policy

At planning time, official Next.js sources list 16.2.x as stable and 16.3 as preview. BUILD must query current stable releases and advisories immediately before scaffolding, then pin:

- Current patched stable Next.js; no canary.
- Compatible patched React/React DOM.
- Active LTS Node supported by both Next.js and Supabase libraries; do not blindly pin Node 20 because Supabase has announced future support changes.
- TypeScript ≥ the framework minimum, strict enabled.
- Exact Supabase client/SSR/CLI versions and lockfile.

Do not initialize database, Redis or external SDK clients at module scope; use server-only lazy accessors so builds do not require runtime secrets.

## 10. Next.js security rules

- App Router and Server Components by default.
- Client Components only for interaction/browser APIs.
- Proxy is optional for optimistic redirects/context and never the sole access control.
- Server Actions and Route Handlers are public attack surfaces: validate, authenticate, authorize and rate-limit them.
- Configure allowed origins narrowly where cross-origin infrastructure requires it; default same-origin.
- Keep command request sizes bounded; uploads use dedicated validated paths.
- Use `server-only` boundaries for DAL, repositories and secrets.

## 11. Caching

| Data | Default |
|---|---|
| Public restaurant/menu shell | Cache by tenant/menu revision where safe |
| Availability/sold-out | Short-lived or dynamic; validate on command |
| Customer Session/orders | Dynamic, user/session scoped, no shared cache |
| KDS/waiter/cashier operational data | Dynamic plus realtime/resync |
| Staff permissions/membership | Dynamic for sensitive command; bounded render cache only |
| Reports | Server query with authorized filters; optional tenant-scoped cache after correctness tests |

Every cached response must include tenant scope in its key and have explicit invalidation or bounded staleness. Never cache user metadata across anonymous users.

## 12. Environment boundaries

| Environment | Data | External actions |
|---|---|---|
| Local Development | Synthetic fixtures | BUILD only |
| Test/Preview | Synthetic, isolated | Named Preview authorization if remote |
| Staging | Production-shaped synthetic/approved data | STAGING_VERIFY only |
| Production | Approved operational data | RELEASE only |

Startup validation rejects missing variables and detects Preview/Test pointing at Production project refs.

## 13. Architecture fitness functions

- Import-boundary test forbids UI → infrastructure and domain → framework imports.
- Contract schemas versioned and tested against adapters.
- RLS matrix tests every role/scope/operation.
- Pure domain unit tests run without Next.js or Supabase.
- UI visual change test suite runs without migration/schema changes.
- Dependency graph and bundle analysis identify cross-shell coupling.

## 14. Capacity approach

M0 default test model until Pilot inputs arrive:

- 30 active tables per Branch.
- Up to 4 customer devices per table.
- Burst of 30 order submissions in 60 seconds.
- 3 KDS devices, 10 waiter devices and 3 cashier/admin devices.
- 2× burst safety scenario for test, not a contractual production capacity claim.

Replace these assumptions with Restaurant-approved Pilot volumes before load acceptance.

## 15. Official references

- Next.js App Router: https://nextjs.org/docs/app
- Next.js authentication/authorization: https://nextjs.org/docs/app/guides/authentication
- Next.js installation/system requirements: https://nextjs.org/docs/app/getting-started/installation
- Supabase Anonymous Auth: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database functions: https://supabase.com/docs/guides/database/functions

All version-sensitive details require revalidation during BUILD.
