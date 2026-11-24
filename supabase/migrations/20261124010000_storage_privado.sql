-- =============================================================================
-- 20261124010000_storage_privado.sql — Cert Manager IFET
--
-- Corrige as falhas do Storage encontradas no diagnóstico de 2026-11-24:
--   F6  bucket 'documents' público: qualquer pessoa com o link abria comprovantes
--   F7  policy de leitura liberava TODOS os arquivos para qualquer um (até sem login)
--   F8  qualquer logado subia arquivo em qualquer pasta (inclusive na de outro aluno)
--   F9  sem limite de tamanho nem de tipo no servidor (só no navegador)
--   F10 aluno podia apagar/substituir o arquivo de um certificado já aprovado
--
-- Regras novas (caminho do arquivo = '<id do aluno>/<timestamp>.<ext>'):
--   * aluno: envia só na própria pasta e lê só a própria pasta
--   * coordenação: lê todos os arquivos
--   * ninguém altera nem apaga pela API (comprovante é evidência)
--   * bucket privado, até 5 MB, apenas PDF/PNG/JPG
--
-- Depois de aplicar, os links passam a ser URLs assinadas (o app já gera).
-- Pré-requisito: 20261124000000_seguranca_rls.sql (função is_coordinator).
-- =============================================================================
begin;

update storage.buckets
   set public = false,
       file_size_limit = 5242880,  -- 5 MB, igual a MAX_FILE_BYTES no app
       allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
 where id = 'documents';

drop policy if exists "Permitir leitura de arquivos"           on storage.objects;
drop policy if exists "Permitir upload para usuarios logados"  on storage.objects;
drop policy if exists "Permitir alteracao do proprio arquivo"  on storage.objects;
drop policy if exists "Permitir exclusao do proprio arquivo"   on storage.objects;
drop policy if exists documents_select_own_or_coord on storage.objects;
drop policy if exists documents_insert_own_folder  on storage.objects;

create policy documents_select_own_or_coord on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_coordinator())
    )
  );

create policy documents_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
