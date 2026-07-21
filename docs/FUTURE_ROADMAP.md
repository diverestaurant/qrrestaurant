# Future Roadmap

Status: Directional; not committed scope  
Last updated: 2026-07-20

Roadmap items enter implementation only through product evidence, Scope Matrix change, ADR and capacity/security review.

## Near-term after stable V1/Pilot

- Menu draft/preview/scheduled publish/rollback.
- Table transfer/merge/split where operational evidence justifies it.
- Refund/Void/Reopen and stronger reconciliation.
- Split bill by person/item.
- Hardware receipt/kitchen printer adapter.
- Enhanced staff shift/service-area management.

## Commercial/engagement

- Subscription automation and self-service tenant onboarding.
- Membership and loyalty.
- Reservation, takeaway and delivery.
- Notification provider integrations.

## Operations and supply

- Inventory and waste tracking.
- Supplier/FAMFOOD ordering adapter.
- Kitchen production forecasting.
- Multi-branch/franchise controls.

## Finance and compliance

- Online Payment Provider adapter and webhook reconciliation.
- E-Invoice adapter after confirmed Malaysian requirements.
- Full POS/accounting export/integration, not necessarily replacement.

## Architecture rule

Do not prebuild full future state machines/tables. V1 provides vendor-neutral ports/events and immutable facts; future modules are added only with concrete use cases/tests/migration plan.
