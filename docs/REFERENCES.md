# Official References

Checked: 2026-07-20  
Purpose: version-sensitive planning sources; re-check at BUILD and RELEASE gates.

## Supabase

- Changelog: https://supabase.com/changelog.md
- Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Database Functions: https://supabase.com/docs/guides/database/functions
- Tables and secure views: https://supabase.com/docs/guides/database/tables
- Database overview/backups: https://supabase.com/docs/guides/database/overview
- 2026 Data API exposure breaking change: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

Planning implications:

- Anonymous Auth uses `authenticated` plus an `is_anonymous` JWT claim.
- Supabase recommends dynamic rendering for Next.js anonymous user data.
- Anonymous account abuse controls and cleanup are required.
- Exposed schema tables require RLS and explicit grants.
- New tables may not be automatically exposed to Data/GraphQL APIs.
- Default database functions are invoker; definer functions need fixed/empty search path and restricted execute grants.
- Database backups do not automatically include Storage objects.

## Next.js

- App Router: https://nextjs.org/docs/app
- Installation and requirements: https://nextjs.org/docs/app/getting-started/installation
- Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Authentication and authorization: https://nextjs.org/docs/app/guides/authentication
- Server Functions security: https://nextjs.org/docs/app/api-reference/directives/use-server
- Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Deployment: https://nextjs.org/docs/app/getting-started/deploying
- Official releases: https://github.com/vercel/next.js/releases

Planning implications:

- Server Actions and Route Handlers require their own authorization.
- UI/layout/proxy checks are not sufficient security.
- Server Components are default; client boundaries should stay narrow.
- Current stable patched versions must be re-verified immediately before scaffolding.
- Preview/canary releases are not selected for production.

## Standards requiring separate verification

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Web Vitals: https://web.dev/vitals/

Malaysia tax, receipt, PDPA and E-Invoice decisions require Restaurant Owner and qualified local advice; no legal conclusion was sourced or asserted in this planning pass.
