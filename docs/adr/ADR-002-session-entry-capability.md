# ADR-002 — Staff-Opened Sessions and Rotating Join Capability

Status: Accepted for planning  
Date: 2026-07-20

## Decision

Staff opens each Dining Session. Static Table QR resolves public Restaurant/Branch/Table/menu only. Ordering/current-session access requires a rotating, expiring Session Join Code exchanged for a device-bound anonymous capability grant.

## Context

A static QR cannot prove physical presence. If it alone grants the current Session, a prior diner with a saved URL could join a future table use. Customer auto-open also creates abuse/concurrent-open risks.

## Options considered

1. Static QR grants current Session.
2. Customer auto-opens from static QR.
3. Staff opens; QR plus rotating Join Code grants Session.
4. Dynamic per-session QR/electronic table display.
5. Staff approves every device.

## Chosen approach

Option 3. Option 4 may be evaluated later as an operational enhancement.

## Reason

It provides a practical physical-presence factor without requiring new hardware and ensures old URLs/cookies cannot enter a new Session.

## Tradeoffs

- Additional customer step and waiter responsibility.
- Code display/communication process must be tested.
- Abuse/rate-limit and code rotation UX are required.

## Consequences and required tests

- Hash codes, expire/rotate/rate-limit them.
- Grant binds anonymous Auth UID + Restaurant + Branch + Table + Session.
- Close revokes all grants.
- Test saved URL, screenshot, cleared cookie, shared code, multi-device, brute force and table reuse.

## Revisit triggers

Usability testing fails task targets, restaurant provides dynamic display hardware, or a safer lower-friction presence proof is validated.
