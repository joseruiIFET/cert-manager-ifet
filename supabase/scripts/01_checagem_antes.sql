-- =============================================================================
-- 01_checagem_antes.sql — rodar ANTES das migrations. Somente leitura, sem dados pessoais.
-- Confirma que os dados atuais passam nas novas regras (senão a migration falharia).
-- Todos os números de "problema" devem ser 0.
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'problema_certificados_status_invalido',
     (select count(*) from public.certificates where status is null or status not in ('pending','approved','rejected')),
  'problema_certificados_horas_zero_ou_negativas',
     (select count(*) from public.certificates where hours <= 0),
  'problema_perfis_papel_invalido',
     (select count(*) from public.profiles where role is not null and role not in ('student','coordinator')),
  'aviso_arquivos_fora_da_pasta_do_aluno',
     (select count(*) from storage.objects o
       where o.bucket_id = 'documents'
         and not exists (select 1 from public.profiles p where p.id::text = split_part(o.name, '/', 1))),
  'info_certificados_que_vao_ligar_ao_tipo',
     (select count(*) from public.certificates c
       where exists (select 1 from public.activity_types a where lower(trim(a.description)) = lower(trim(c.category)))),
  'info_certificados_sem_tipo_correspondente',
     (select count(*) from public.certificates c
       where not exists (select 1 from public.activity_types a where lower(trim(a.description)) = lower(trim(c.category))))
)) as checagem;
