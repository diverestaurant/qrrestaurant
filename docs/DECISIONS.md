# Decision Index

Last updated: 2026-07-20  
All decisions are design baselines; implementation evidence does not yet exist.

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](adr/ADR-001-modular-monolith.md) | Single-deployable layered modular monolith for V1 | Accepted for planning |
| [ADR-002](adr/ADR-002-session-entry-capability.md) | Staff-opened Session and rotating Join Code; static QR is not Session credential | Accepted for planning |
| [ADR-003](adr/ADR-003-supabase-auth-rls.md) | Supabase permanent/anonymous Auth with membership/grant RLS model | Accepted for planning |
| [ADR-004](adr/ADR-004-money-payment-integrity.md) | Server Pricing Engine, integer money and immutable payment/receipt records | Accepted for planning |
| [ADR-005](adr/ADR-005-realtime-source-of-truth.md) | Database truth, outbox/versioned events and resync | Accepted for planning |
| [ADR-006](adr/ADR-006-v1-payment-scope.md) | Whole-session manual multi-tender In Scope; split/refund/void/reopen Deferred | Accepted for planning |
| [ADR-007](adr/ADR-007-menu-publication.md) | V1 audited immediate menu publication; draft/schedule/rollback Deferred | Accepted for planning |

Future decision records must use the ADR template in `adr/README.md`. UI-originated contract/core changes must also follow the YELLOW/RED warning process.
