-- =============================================================================
-- 02_backup.sql — cópia dos dados ANTES das migrations (plano gratuito não tem backup).
-- CONTÉM DADOS PESSOAIS (nomes, e-mails). Salve FORA da pasta do projeto e fora do git,
-- e apague quando não precisar mais. Os arquivos do bucket não entram aqui:
-- baixe-os em Storage → documents.
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'gerado_em',      now(),
  'profiles',       (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.profiles p),
  'courses',        (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.courses c),
  'activity_types', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.activity_types a),
  'certificates',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.certificates x),
  'storage_objects',(select coalesce(jsonb_agg(jsonb_build_object('name', name, 'owner', owner, 'created_at', created_at)), '[]')
                       from storage.objects where bucket_id = 'documents')
)) as backup;
