# Known Issues and Risks

Last updated: 2026-07-20

| ID | Severity/Gate | Issue | Impact | Owner/next action |
|---|---|---|---|---|
| KI-001 | M3–M10 | Full application workflow is not complete | Finish Line A cannot be met | Continue local engineering and evidence |
| KI-002 | UI gate | Independent review is complete, but device/accessibility/usability evidence is open | UI Foundation is only conditionally passed | Run local device/accessibility/usability checks |
| KI-003 | High if ignored | Supabase Anonymous Auth shares `authenticated` Postgres role | Staff/customer policy confusion could escalate access | Implement `is_anonymous` + membership/grant predicates and tests |
| KI-004 | High if ignored | Static QR cannot prove physical presence | Saved QR could re-enter future sessions | Rotating Session Join Code; validate with restaurant operations |
| KI-005 | Release Blocker | SST/service charge/rounding/receipt rules unknown | Incorrect amounts/records | Owner/advisor confirmation and rule fixtures |
| KI-006 | Release Blocker | Privacy/retention/PDPA process unknown | Compliance/lifecycle risk | Owner/advisor policy and data inventory approval |
| KI-007 | M10/Pilot | Actual traffic/device/Wi-Fi model unknown | Performance/realtime targets unverified | Collect Pilot model and run load/device tests |
| KI-008 | Release Blocker | Backup plan tier/budget/RPO/RTO unapproved | Recovery may miss business need | Owner approval and restore drill |
| KI-009 | Scope risk | V1 remains broad across five role apps | Schedule/quality pressure | Freeze Scope Matrix; no hidden Deferred expansion |
| KI-010 | Product/UX | Join Code adds ordering friction | Customer task time may increase | Independent prototype/usability test; do not weaken security silently |
| KI-011 | Operational | Browser printing varies | Receipt/QR print may be inconsistent | Target-device test; hardware adapter remains Deferred |
| KI-012 | Localization | Approved Chinese/BM content absent | Only English can be formally accepted | Provide translations; run layout/content review |
| KI-013 | Version | Framework/runtime/packages are pinned for this local checkpoint | Future security/build drift remains possible | Re-check official releases/advisories before release |
| KI-014 | External Gate | No Staging/Production/Pilot environments authorized | Finish Lines A/B/C cannot be met | Separate mode authorization when engineering is ready |
| KI-015 | Tooling | `agent-browser` CLI is unavailable locally | Its specific automation path cannot be run | Use Playwright fallback and install only if later authorized/needed |

No issue is an accepted risk yet. Accepted Risk requires explicit user evidence, owner, mitigation and expiry, and cannot cover tenant/security/money/data-loss/P0/P1 matters.
