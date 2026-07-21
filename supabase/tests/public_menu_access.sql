begin;
select plan(4);
select ok(has_table_privilege('anon', 'public.restaurants', 'SELECT'), 'anon can read public restaurant entry metadata');
select ok(has_table_privilege('anon', 'public.branches', 'SELECT'), 'anon can read public branch entry metadata');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurants' and policyname = 'restaurants_public_select'), 'restaurant public policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'branches_public_select'), 'branch public policy exists');
select * from finish();
rollback;
