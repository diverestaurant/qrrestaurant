begin;
select plan(7);

select is((select public from storage.buckets where id = 'menu-images'), false, 'menu image bucket is private');
select is((select file_size_limit from storage.buckets where id = 'menu-images'), 5242880::bigint, 'menu image bucket has a 5 MiB object limit');
select ok((select array['image/jpeg', 'image/png', 'image/webp']::text[] <@ allowed_mime_types from storage.buckets where id = 'menu-images'), 'menu image bucket allows only approved raster MIME types');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'menu_image_staff_insert' and with_check like '%bucket_id = ''menu-images''%' and with_check like '%has_branch_permission%'), 'menu image insert policy is branch permission scoped');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'menu_image_staff_select' and qual like '%bucket_id = ''menu-images''%' and qual like '%has_branch_permission%'), 'menu image select policy is branch permission scoped');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'menu_image_staff_update' and qual like '%bucket_id = ''menu-images''%' and with_check like '%has_branch_permission%'), 'menu image update policy is branch permission scoped');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'menu_image_staff_delete' and qual like '%bucket_id = ''menu-images''%' and qual like '%has_branch_permission%'), 'menu image delete policy is branch permission scoped');

select * from finish();
rollback;
