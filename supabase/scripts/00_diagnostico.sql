-- =============================================================================
-- 00_diagnostico.sql — Cert Manager IFET
-- SOMENTE LEITURA. Não altera nada e não lê dados pessoais (só estrutura e contagens).
-- Cole no Supabase → SQL Editor → Run. O resultado é uma única célula JSON.
-- =============================================================================
select jsonb_pretty(jsonb_build_object(

  -- 1) Colunas de cada tabela do schema public
  'colunas', (
    select jsonb_object_agg(table_name, cols)
    from (
      select table_name,
             jsonb_agg(column_name || ' ' || data_type
                       || case when is_nullable = 'NO' then ' not null' else '' end
                       || coalesce(' default ' || column_default, '')
                       order by ordinal_position) as cols
      from information_schema.columns
      where table_schema = 'public'
      group by table_name
    ) t
  ),

  -- 2) RLS ligada/desligada por tabela (public e storage)
  'rls', (
    select jsonb_object_agg(n.nspname || '.' || c.relname,
             jsonb_build_object('rls', c.relrowsecurity, 'force', c.relforcerowsecurity))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage') and c.relkind = 'r'
  ),

  -- 3) Todas as policies (public e storage)
  'policies', (
    select jsonb_agg(jsonb_build_object(
             'tabela', schemaname || '.' || tablename, 'nome', policyname,
             'comando', cmd, 'papeis', roles, 'permissiva', permissive,
             'using', qual, 'with_check', with_check)
           order by schemaname, tablename, policyname)
    from pg_policies
    where schemaname in ('public', 'storage')
  ),

  -- 4) Permissões diretas dos papéis anon/authenticated nas tabelas
  'grants', (
    select jsonb_object_agg(tabela, privs)
    from (
      select table_name || ' → ' || grantee as tabela,
             jsonb_agg(privilege_type order by privilege_type) as privs
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
      group by table_name, grantee
    ) g
  ),

  -- 5) Constraints (PK, FK, check, unique)
  'constraints', (
    select jsonb_agg(jsonb_build_object(
             'tabela', conrelid::regclass::text, 'nome', conname,
             'definicao', pg_get_constraintdef(oid))
           order by conrelid::regclass::text, conname)
    from pg_constraint
    where connamespace = 'public'::regnamespace
  ),

  -- 6) Triggers em public e auth (ex.: criação automática de profile)
  'triggers', (
    select jsonb_agg(jsonb_build_object(
             'tabela', tgrelid::regclass::text, 'nome', tgname,
             'definicao', pg_get_triggerdef(t.oid))
           order by tgrelid::regclass::text, tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal
      and c.relnamespace in ('public'::regnamespace, 'auth'::regnamespace)
  ),

  -- 7) Funções do schema public (código completo)
  'funcoes', (
    select jsonb_agg(jsonb_build_object(
             'nome', p.proname, 'security_definer', p.prosecdef,
             'codigo', pg_get_functiondef(p.oid))
           order by p.proname)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  ),

  -- 8) Views
  'views', (
    select jsonb_agg(jsonb_build_object('nome', viewname, 'definicao', definition))
    from pg_views where schemaname = 'public'
  ),

  -- 9) Índices
  'indices', (
    select jsonb_agg(indexdef order by tablename, indexname)
    from pg_indexes where schemaname = 'public'
  ),

  -- 10) Buckets do Storage
  'buckets', (
    select jsonb_agg(jsonb_build_object(
             'id', id, 'publico', public,
             'limite_bytes', file_size_limit, 'mime_permitidos', allowed_mime_types))
    from storage.buckets
  ),

  -- 11) Contagens (sem nomes, e-mails nem arquivos)
  'contagens', jsonb_build_object(
    'usuarios_auth',   (select count(*) from auth.users),
    'profiles_papel',  (select jsonb_object_agg(coalesce(role, '(nulo)'), n)
                          from (select role, count(*) n from public.profiles group by role) x),
    'certificados_status', (select jsonb_object_agg(coalesce(status, '(nulo)'), n)
                          from (select status, count(*) n from public.certificates group by status) x),
    'arquivos_documents', (select count(*) from storage.objects where bucket_id = 'documents')
  )
)) as diagnostico;
