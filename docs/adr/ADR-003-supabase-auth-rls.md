# ADR-003 — Supabase Auth, Explicit Grants and RLS Capability Model

Status: Accepted for planning  
Date: 2026-07-20

## Decision

Use Supabase permanent Auth identities for staff and Anonymous Auth identities for customers. Authorization requires live database membership/grant checks, explicit Data API grants, RLS on exposed objects and narrow transactional functions.

## Context

Supabase Anonymous Auth users use the `authenticated` Postgres role and must be distinguished by trusted `is_anonymous` claim. `TO authenticated` alone is not authorization. Supabase's 2026 exposure changes also mean new table API access must be explicit.

## Options considered

1. App-only authorization with service-role database access.
2. Direct client access protected only by RLS.
3. Layered application authorization plus explicit grants/RLS and narrow RPCs.
4. Custom authentication/JWT platform.

## Chosen approach

Option 3.

## Reason

It combines database defense with application use-case control, supports anonymous customers without PII and avoids a custom identity platform.

## Tradeoffs

- Policy/function complexity and extensive matrix tests.
- Anonymous account abuse/cleanup operations.
- Live membership checks add database work and require indexes.

## Consequences and required tests

- Never authorize with user metadata.
- Staff: non-anonymous + active scoped membership/permission.
- Customer: anonymous + live exact Session grant.
- Default functions invoker; definer only with fixed/empty search path, revoked PUBLIC execute and internal checks.
- Security-invoker views; explicit exposure inventory.
- Full direct-API RLS and function privilege tests.

## Revisit triggers

Supabase changes Auth/RLS capabilities, verified performance cannot meet needs, or external identity/compliance requirements mandate another provider.
