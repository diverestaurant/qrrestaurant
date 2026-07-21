# ADR-007 — Audited Immediate Menu Publication for V1

Status: Accepted for planning  
Date: 2026-07-20

## Decision

V1 menu edits become live after an explicit Save/Publish action with validation, version conflict handling and audit. Draft, scheduled publication and rollback are Deferred. Historical orders use immutable snapshots.

## Context

Restaurants need immediate price/content/sold-out changes. A full revision/publish scheduling system adds workflow and schema complexity. Direct uncontrolled autosave risks unintended live changes.

## Options considered

1. Autosave every field directly live.
2. Explicit validated immediate publication.
3. Full draft/preview/schedule/rollback revisions.

## Chosen approach

Option 2.

## Reason

It is operationally usable and auditable without building a complete CMS in V1.

## Tradeoffs

- No future scheduled price/menu change.
- No one-click rollback; correction is a new audited edit.
- Admin UI needs clear live-impact and unsaved/conflict warnings.

## Consequences and required tests

- Explicit Save/Publish, no silent autosave for consequential fields.
- Validate modifier rules/routing/prices before commit.
- Snapshot orders and revalidate customer carts on submit.
- Sold-out toggle is a separate high-frequency command.

## Revisit triggers

Multi-branch content operations or regulatory/business needs require approval workflow, scheduled effective dates or rollback.
