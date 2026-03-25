-- Storage buckets and policies for task attachments + avatar uploads

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('task-assets', 'task-assets', true, 10485760),
  ('avatars', 'avatars', true, 5242880)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "task_assets_select" on storage.objects;
drop policy if exists "task_assets_insert" on storage.objects;
drop policy if exists "task_assets_update" on storage.objects;
drop policy if exists "task_assets_delete" on storage.objects;

create policy "task_assets_select"
on storage.objects
for select
using (bucket_id = 'task-assets');

create policy "task_assets_insert"
on storage.objects
for insert
with check (
  bucket_id = 'task-assets'
  and auth.role() = 'authenticated'
);

create policy "task_assets_update"
on storage.objects
for update
using (
  bucket_id = 'task-assets'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'task-assets'
  and auth.role() = 'authenticated'
);

create policy "task_assets_delete"
on storage.objects
for delete
using (
  bucket_id = 'task-assets'
  and auth.role() = 'authenticated'
);

drop policy if exists "avatars_select" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;

create policy "avatars_select"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "avatars_insert"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and name like ('profile/' || auth.uid()::text || '/%')
);

create policy "avatars_update"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and name like ('profile/' || auth.uid()::text || '/%')
)
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and name like ('profile/' || auth.uid()::text || '/%')
);

create policy "avatars_delete"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and name like ('profile/' || auth.uid()::text || '/%')
);

