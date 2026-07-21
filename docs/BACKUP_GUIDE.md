# Backup Guide — Planning Template

Status: Local schema restore rehearsal complete; hosted backup/Storage controls are not operational  
Last updated: 2026-07-21

## Scope

A complete backup plan covers:

- Supabase PostgreSQL database and Auth-related recoverable state.
- Supabase Storage objects and metadata consistency.
- Migration/app/config version references.
- Secret recovery/rotation procedure without exporting secrets into documents.
- Required third-party configuration where applicable.

## Planned controls

- Confirm hosted backup/PITR features, retention and cost for the selected plan.
- Separate Storage export/replication because database backup alone does not include objects.
- Encrypt backups, restrict access and log restore use.
- Record last successful backup, recovery point, version and verification owner.
- Proposed initial planning targets: RPO ≤24h, RTO ≤4h until owner approves.

## Verification

- Scheduled status monitoring/alert.
- Periodic isolated restore drill.
- Database row/constraint/RLS verification.
- Storage object count/checksum/metadata verification.
- Golden Path after restore.

## Local BUILD evidence

- A portable schema-only dump of `public`, `app_private` and local `auth` was restored into an isolated temporary local PostgreSQL database.
- The current migration-155 rehearsal verified 33 public tables, 57 public policies, 33 RLS-enabled public tables, zero public tables without RLS, 43 `SECURITY DEFINER` functions and zero definer functions without an explicit `search_path`; the temporary database was removed after verification.
- A local synthetic Storage drill uploads and downloads one branch-scoped `menu-images` object, copies it to a backup key, restores/downloads the copy, byte-compares it and removes both objects.
- A `public`-only dump is insufficient because the app-owned RLS helper schema is `app_private`; the portable rehearsal omits owner and privilege statements so it does not depend on protected Supabase role membership.
- This remains local synthetic evidence. It does not verify hosted PITR, encrypted backup retention, complete hosted Storage/Auth data recovery, approved RPO/RTO or a production Golden Path.

Exact commands/provider settings must be added only after environment selection and tested in authorized Staging.
