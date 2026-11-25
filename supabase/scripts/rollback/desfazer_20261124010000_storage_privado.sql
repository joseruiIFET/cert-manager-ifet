-- Desfaz 20261124010000_storage_privado.sql: volta o bucket e as policies ao estado de 2026-11-24.
-- ATENÇÃO: reabre a falha de segurança. Use só se o app parar de abrir arquivos.
begin;
update storage.buckets set public = true, file_size_limit = null, allowed_mime_types = null where id = 'documents';
drop policy if exists documents_select_own_or_coord on storage.objects;
drop policy if exists documents_insert_own_folder  on storage.objects;
create policy "Permitir leitura de arquivos" on storage.objects
  for select using (bucket_id = 'documents');
create policy "Permitir upload para usuarios logados" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
create policy "Permitir alteracao do proprio arquivo" on storage.objects
  for update to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
create policy "Permitir exclusao do proprio arquivo" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
commit;
