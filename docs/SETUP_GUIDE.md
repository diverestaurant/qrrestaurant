# Setup Guide — Planning Template

Status: Not operational; no application exists  
Last updated: 2026-07-20

This document defines the eventual setup guide structure. Commands, screenshots and environment values must be added and verified only after BUILD.

## Intended audience

Developers and authorized technical operators setting up Development, Test, Staging or Production.

## Required future sections

1. Supported OS/runtime/package manager versions and prerequisite checks.
2. Repository clone/branch/lockfile verification.
3. Environment variable names, validation and secret-store process.
4. Local Supabase startup, migration and synthetic initialization.
5. Next.js development/build/test commands.
6. Role test identities created through secure initialization, never shared passwords.
7. Storage bucket/policy setup.
8. CI/local quality checks.
9. Common setup failures and safe cleanup.
10. Confirmation that no local/Preview config points to Production.

## Environment-specific boundary

- Local setup requires BUILD.
- Remote Test/Staging requires named authorization.
- Production setup requires RELEASE.

## Acceptance for final guide

- A new authorized developer follows it from a clean machine/environment.
- All commands match the pinned versions and repository scripts.
- No secret appears in the guide.
- Empty-database migration and synthetic Golden Path pass.

Current status: outline only; do not execute guessed commands from this file.
