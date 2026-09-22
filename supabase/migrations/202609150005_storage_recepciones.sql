begin;

-- Create the bucket in Dashboard > Storage first with this exact name and keep
-- it private. These policies allow only signed-in staff with an application
-- role to upload and read receipt evidence.
drop policy if exists recepcion_files_insert on storage.objects;
drop policy if exists recepcion_files_select on storage.objects;
create policy recepcion_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-recepcion' and public.app_rol() is not null);
create policy recepcion_files_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos-recepcion' and public.app_rol() is not null);

commit;
