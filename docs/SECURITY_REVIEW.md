# Security Review

Review status: Architecture threat review plus local automated verification  
Implementation verification: Partial local M0–M10 slices verified; full Finish Line review remains open  
Last updated: 2026-07-21

## Executive conclusion

The architecture addresses the highest-risk boundaries, and local migrations, grants, RLS, command authorization, idempotency, concurrency and Realtime publication controls have automated evidence. Security is not a production-readiness claim; manual review, representative load/device checks, restore drills and separately authorized hosted verification remain open, so Finish Line A remains `NOT_MET`.

## Assets

- Tenant/menu/order/session/payment/receipt/report data.
- Staff identities, memberships and permissions.
- Table QR/Session Join Codes/customer grants.
- Supabase/Vercel/database/storage secrets.
- Audit and incident evidence.
- Restaurant brand/content and uploaded images.

## Trust boundaries

- Public browser ↔ Next.js/Supabase Auth.
- Staff browser ↔ protected app entry points.
- App ↔ Supabase Data API/Postgres/Storage/Realtime.
- Realtime channel ↔ client projection.
- Local/Preview/Staging/Production environments.
- Future payment/printer/notification providers.
- Platform Admin ↔ tenant data.

## Threat register

| Threat | Severity | Planned controls | Verification |
|---|---|---|---|
| Cross-Restaurant/Branch BOLA | Critical | Composite keys, explicit grants, RLS, application scope | Full RLS matrix/direct API attacks |
| Cross-table/current-old Session access | Critical | QR not credential, rotating Join Code, live grant, revoke on close | Old URL/device/table reuse tests |
| Staff privilege escalation | Critical | trusted membership/permission, no user metadata auth, server + RLS | role mutation/direct command tests |
| Service/secret key exposure | Critical | server-only lazy client, env scan, no NEXT_PUBLIC secret | build/secret scan/runtime review |
| Client price/tax manipulation | Critical | server Pricing Engine/snapshots, ignore totals | tamper/property/integration tests |
| Duplicate order/payment | Critical | idempotency hash/unique key, version/locks | race and unknown-outcome tests |
| Unsafe SECURITY DEFINER/view | Critical | invoker default, private schema, fixed path, revoke/grant, security-invoker views | catalog/advisor/exploit tests |
| Anonymous Auth abuse/database growth | High | CAPTCHA/rate limit, attempt counters, cleanup | abuse/load/cleanup verification |
| QR/Join Code brute force | High | entropy, hashing, expiry, rotation, rate limit, generic errors | rate/timing/tamper tests |
| Session/JWT stale after revocation | High | short token strategy, DB active-state checks on commands | revoke/suspended session tests |
| CSRF/forged Server Action | High | same-origin/allowedOrigins, auth, CSRF review, SameSite cookies | cross-origin tests |
| XSS from menu/notes | High | React escaping, schema limits, no raw HTML, CSP | payload tests/CSP scan |
| Malicious upload | High | MIME/content/size/dimension validation, safe formats, Storage RLS | polyglot/SVG/oversize tests |
| Realtime data leakage | Critical | scoped channel auth, minimal payload, resync query RLS | wrong-channel/revocation tests |
| Audit tampering/PII overcollection | High | append-only, restricted writes/read, allowlisted masking | direct mutation/access tests |
| Payment/close partial failure | Critical | transaction/Saga boundary, PAID recovery state | injected failure tests |
| Dependency/RSC vulnerability | Critical | current patched stable versions, lockfile, scan | BUILD/release advisory gate |
| SSRF/provider callback abuse | High | no arbitrary URLs, allowlist, outbound adapter validation | unit/integration security tests |
| Denial of service | High | rate/body limits, query bounds, indexes, reverse/WAF defense | load/abuse tests |

## Authentication

- Permanent staff identities are distinct from Anonymous Auth identities.
- Anonymous Supabase users use `authenticated`; staff access must also require `is_anonymous = false` and active membership.
- Customer access requires `is_anonymous = true` plus current grant.
- Do not use `raw_user_meta_data`/user metadata for authorization.
- Sensitive commands query live membership/tenant/grant state to limit stale JWT risk.
- High privilege MFA and break-glass procedures block Production until confirmed.

## Authorization

- Route/layout/Proxy checks are user experience only.
- Every Server Action/Route Handler calls centralized application authorization.
- RLS and constraints enforce database defense.
- Capability flags in View Models do not grant access.
- Platform access uses explicit permission and audit; no universal silent support backdoor.

## Database/API

- Explicit table/function grants; default no exposure.
- RLS on exposed tables and `WITH CHECK` for mutations.
- Views use security invoker.
- Database function execute revoked from PUBLIC by default.
- Security-definer functions only when necessary to execute a transactional capability that cannot safely use invoker; each contains its own identity/scope/state checks.
- Bounded query ranges/pagination prevent report/queue abuse.

## QR and customer grant

- Static entry token high entropy and revocable.
- Token/code errors avoid enumeration.
- Session code hashed, short-lived, rate-limited and rotated.
- Grant binds Auth UID + Restaurant + Branch + Table + Session + expiry/version.
- Close/paid/cancel revokes writes; close revokes all grant access.
- Public menu and current Session data are separate authorization surfaces.

## Application/web

- Zod validation at every external boundary.
- React escaping; no tenant HTML/JS.
- CSP/headers/CORS/CSRF policies verified in deployed environment.
- Server Action body size and origins remain narrow.
- Error responses omit SQL, stack, secret, internal ID and permission predicate.
- Correlation ID is opaque and safe to expose.

## Storage

- Approved raster formats by content signature; SVG disabled by default.
- File size, dimensions and decompression limits.
- Opaque tenant-scoped paths.
- Separate read/write/upsert/delete policy tests.
- Image processing cannot fetch arbitrary attacker URLs.

## Secrets and environments

- `.env.example` contains names only.
- Secret values live in authorized local/host secret stores.
- Preview/Staging/Production project-ref guard.
- Rotation runbook for Auth signing, DB, service, provider and platform credentials.
- Logs/traces redact headers/cookies/tokens/payment secrets.

## Privacy/compliance boundary

Technical data inventory and minimization are designed. Malaysia PDPA, privacy notice, retention, SST, receipt and E-Invoice positions require owner/qualified advice. No compliance certification is claimed.

## Required security evidence

- Threat model review after implementation.
- Dependency/secret/SAST scan.
- RLS/grant/function/view/storage matrix.
- Cross-tenant/role/table/QR attack suite.
- Pricing/payment/idempotency/concurrency suite.
- Header/CSP/CORS/CSRF/upload test.
- Backup/restore and incident exercise.
- No open Critical/High security defect.

## Current finding

`SEC-PLAN-001`: The local foundation now exists, but the full control matrix remains incomplete. Severity: Gate. Owner: Principal Architect/Security Reviewer. Resolution: complete local M1–M10 evidence, then separately authorized Staging verification.
