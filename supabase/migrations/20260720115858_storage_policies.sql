begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy menu_image_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and app_private.has_branch_permission((storage.foldername(name))[2]::uuid, 'menu.manage')
);

create policy menu_image_staff_select on storage.objects
for select to authenticated
using (
  bucket_id = 'menu-images'
  and app_private.has_branch_permission((storage.foldername(name))[2]::uuid, 'menu.manage')
);

create policy menu_image_staff_update on storage.objects
for update to authenticated
using (
  bucket_id = 'menu-images'
  and app_private.has_branch_permission((storage.foldername(name))[2]::uuid, 'menu.manage')
)
with check (
  bucket_id = 'menu-images'
  and app_private.has_branch_permission((storage.foldername(name))[2]::uuid, 'menu.manage')
);

create policy menu_image_staff_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'menu-images'
  and app_private.has_branch_permission((storage.foldername(name))[2]::uuid, 'menu.manage')
);

commit;
