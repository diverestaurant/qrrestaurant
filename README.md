# DIVE Restaurant Autopilot

Next.js and Supabase foundation for the DIVE Restaurant V1 build. The repository follows the governing V3 prompt; local engineering and the named Staging Supabase schema/RLS are verified, while Vercel Staging deployment is separately authorized but currently blocked by target-team access.

## Local development

```bash
npm install
cp .env.example .env.local
npm run db:start
# Copy local ANON_KEY/SERVICE_ROLE_KEY into .env.local first.
npm run db:reset
npm run dev
```

The app is available at <http://localhost:3000>. The local Supabase workflow requires Docker Desktop:

After `npm run db:start`, run `SUPABASE_TELEMETRY_DISABLED=1 npx supabase status -o env` and copy the local `ANON_KEY` into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the local `SERVICE_ROLE_KEY` into `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. These are synthetic local values only. Then run:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
SKIP_WEBSERVER=1 npm run test:e2e
```

The current evidence and remaining gates are recorded in [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) and [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md). The default local workflow does not connect to a remote project; remote actions require the named environment authorization recorded in the docs.
