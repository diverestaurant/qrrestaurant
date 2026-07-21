# ADR-001 — Layered Modular Monolith for V1

Status: Accepted for planning  
Date: 2026-07-20

## Decision

Build V1 as one deployable Next.js App Router application organized into strict domain/application/contract/infrastructure modules, with Supabase as backend services.

## Context

The product has tightly coupled transactional flows across sessions, orders, kitchen, payments and reports. The repository is greenfield and has no measured scale requiring services.

## Options considered

1. One unstructured full-stack app.
2. Layered modular monolith.
3. Monorepo of multiple frontends/services.
4. Microservices/event-driven services from day one.

## Chosen approach

Option 2 with role-specific shells in one app and enforced import boundaries.

## Reason

It minimizes operational/distributed complexity while preserving clean extraction seams. Transactions and cross-module testing remain straightforward.

## Tradeoffs

- One deployment can affect all roles.
- Module boundaries require lint/fitness tests to avoid erosion.
- Very different scaling needs may later require extraction.

## Consequences and required tests

- UI → contract → application → domain → infrastructure dependency direction.
- Domain has no Next.js/React/Supabase dependency.
- Import-boundary tests and role-shell bundle reviews.

## Revisit triggers

Independent scaling, compliance isolation, deployment cadence or team ownership creates measured pain that a separate service solves.
