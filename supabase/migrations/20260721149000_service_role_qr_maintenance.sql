begin;

-- The server-only adapter and synthetic verification cleanup need explicit
-- privileges because service_role bypasses RLS but does not bypass SQL grants.
-- Browser roles receive no additional access from this migration.
grant select, delete on public.table_qr_tokens to service_role;

commit;
