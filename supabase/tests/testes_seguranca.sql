-- =============================================================================
-- testes_seguranca.sql — Cert Manager IFET
-- Testes de ataque contra RLS, guardas de campo, cálculo de horas e Storage.
-- Rodar SOMENTE num banco de teste (cria usuários e dados fictícios).
-- Cada teste roda e é desfeito; o resultado é PASSOU/FALHOU por linha.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Usuários fictícios: A e B alunos, C coordenação
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aluno.a@teste', '{"full_name":"Aluno A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aluno.b@teste', '{"full_name":"Aluno B"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'coord@teste',   '{"full_name":"Coordenação"}');
update public.profiles set role = 'coordinator' where id = 'cccccccc-0000-0000-0000-000000000003';

insert into public.courses (id, name) values ('11111111-0000-0000-0000-000000000000', 'TSI');
insert into public.activity_types (id, course_id, eixo, description, min_hours, max_hours, proof_type, max_accumulated_hours) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000000', 'Tecnológico', 'Curso livre', 4, 40, 'Certificado', null),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000', 'Integrador',  'Monitoria',   10, 30, 'Declaração', 40);

insert into public.certificates (id, student_id, title, category, activity_type_id, hours, status, feedback) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'A pendente',  'Curso livre', '22222222-0000-0000-0000-000000000001', 20, 'pending',  null),
  ('a2000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'A rejeitado', 'Curso livre', '22222222-0000-0000-0000-000000000001', 10, 'rejected', '[01/11/2026] ilegível'),
  ('a3000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'A aprovado',  'Curso livre', '22222222-0000-0000-0000-000000000001', 15, 'approved', null),
  ('b1000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002', 'B pendente',  'Curso livre', '22222222-0000-0000-0000-000000000001', 20, 'pending',  null);

insert into storage.objects (bucket_id, name, owner) values
  ('documents', 'aaaaaaaa-0000-0000-0000-000000000001/1.pdf', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('documents', 'bbbbbbbb-0000-0000-0000-000000000002/1.pdf', 'bbbbbbbb-0000-0000-0000-000000000002');

-- Executa `p_sql` como `p_role`/`p_uid`, desfaz tudo e devolve 'linhas:N' ou 'erro'.
create or replace function pg_temp.tentar(p_role text, p_uid text, p_sql text)
returns text language plpgsql as $$
declare n bigint; r text;
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
    execute format('set local role %I', p_role);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception 'DESFAZER:%', n;
  exception
    when raise_exception then
      if sqlerrm like 'DESFAZER:%' then r := 'linhas:' || split_part(sqlerrm, ':', 2);
      else r := 'erro'; end if;
    when others then r := 'erro';
  end;
  reset role;
  return r;
end $$;

-- Executa e devolve o valor de uma coluna (para conferir o que o banco gravou), desfazendo depois.
create or replace function pg_temp.valor(p_role text, p_uid text, p_sql text)
returns text language plpgsql as $$
declare v text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
    execute format('set local role %I', p_role);
    execute p_sql into v;
    raise exception 'DESFAZER:%', coalesce(v, '(nulo)');
  exception when raise_exception then
    v := case when sqlerrm like 'DESFAZER:%' then substr(sqlerrm, 10) else 'erro' end;
  when others then v := 'erro';
  end;
  reset role;
  return v;
end $$;

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

with t(id, descricao, esperado, obtido) as (values
  -- Sem login
  ('T01', 'Visitante sem login lê profiles',                 'erro',     pg_temp.tentar('anon', null, 'select * from public.profiles')),
  ('T02', 'Visitante sem login lê certificates',             'erro',     pg_temp.tentar('anon', null, 'select * from public.certificates')),
  ('T03', 'Visitante sem login lista arquivos',              'linhas:0', pg_temp.tentar('anon', null, 'select * from storage.objects')),
  -- Aluno A atacando
  ('T04', 'Aluno lê só o próprio perfil',                    'linhas:1', pg_temp.tentar('authenticated', :A, 'select * from public.profiles')),
  ('T05', 'Aluno se promove a coordenação',                  'erro',     pg_temp.tentar('authenticated', :A, $q$update public.profiles set role='coordinator' where id=auth.uid()$q$)),
  ('T06', 'Aluno cria certificado já aprovado',              'erro',     pg_temp.tentar('authenticated', :A, $q$insert into public.certificates(student_id,title,category,hours,status) values(auth.uid(),'x','Curso livre',10,'approved')$q$)),
  ('T07', 'Aluno cria certificado em nome de outro aluno',   'erro',     pg_temp.tentar('authenticated', :A, $q$insert into public.certificates(student_id,title,category,hours) values('bbbbbbbb-0000-0000-0000-000000000002','x','Curso livre',10)$q$)),
  ('T08', 'Aluno aprova o próprio pendente',                 'linhas:0', pg_temp.tentar('authenticated', :A, $q$update public.certificates set status='approved' where id='a1000000-0000-0000-0000-000000000000'$q$)),
  ('T09', 'Aluno aprova o próprio rejeitado',                'erro',     pg_temp.tentar('authenticated', :A, $q$update public.certificates set status='approved' where id='a2000000-0000-0000-0000-000000000000'$q$)),
  ('T10', 'Aluno edita certificado já aprovado',             'linhas:0', pg_temp.tentar('authenticated', :A, $q$update public.certificates set hours=999 where id='a3000000-0000-0000-0000-000000000000'$q$)),
  ('T11', 'Aluno apaga o motivo da rejeição ao corrigir',    'erro',     pg_temp.tentar('authenticated', :A, $q$update public.certificates set status='pending', feedback=null where id='a2000000-0000-0000-0000-000000000000'$q$)),
  ('T12', 'Aluno lê certificados de outro aluno',            'linhas:0', pg_temp.tentar('authenticated', :A, $q$select * from public.certificates where student_id='bbbbbbbb-0000-0000-0000-000000000002'$q$)),
  ('T13', 'Aluno altera certificado de outro aluno',         'linhas:0', pg_temp.tentar('authenticated', :A, $q$update public.certificates set title='hack' where id='b1000000-0000-0000-0000-000000000000'$q$)),
  ('T14', 'Aluno apaga certificado',                         'erro',     pg_temp.tentar('authenticated', :A, $q$delete from public.certificates where id='a1000000-0000-0000-0000-000000000000'$q$)),
  ('T15', 'Aluno esvazia a tabela (TRUNCATE)',               'erro',     pg_temp.tentar('authenticated', :A, 'truncate public.certificates')),
  ('T16', 'Aluno cria regra de atividade',                   'erro',     pg_temp.tentar('authenticated', :A, $q$insert into public.activity_types(course_id,eixo,description,min_hours,max_hours) values('11111111-0000-0000-0000-000000000000','Básico','x',1,999)$q$)),
  ('T17', 'Aluno lê arquivo de outro aluno',                 'linhas:0', pg_temp.tentar('authenticated', :A, $q$select * from storage.objects where name like 'bbbbbbbb%'$q$)),
  ('T18', 'Aluno envia arquivo na pasta de outro aluno',     'erro',     pg_temp.tentar('authenticated', :A, $q$insert into storage.objects(bucket_id,name,owner) values('documents','bbbbbbbb-0000-0000-0000-000000000002/x.pdf',auth.uid())$q$)),
  ('T19', 'Aluno apaga o próprio comprovante',               'linhas:0', pg_temp.tentar('authenticated', :A, $q$delete from storage.objects where name like 'aaaaaaaa%'$q$)),
  -- Uso legítimo do aluno (tem que funcionar)
  ('T20', 'Aluno envia certificado pendente',                'linhas:1', pg_temp.tentar('authenticated', :A, $q$insert into public.certificates(student_id,title,category,activity_type_id,hours) values(auth.uid(),'ok','Curso livre','22222222-0000-0000-0000-000000000001',10)$q$)),
  ('T21', 'Aluno corrige rejeitado (volta a pendente)',      'linhas:1', pg_temp.tentar('authenticated', :A, $q$update public.certificates set status='pending', title='corrigido' where id='a2000000-0000-0000-0000-000000000000'$q$)),
  ('T22', 'Aluno lê o próprio arquivo',                      'linhas:1', pg_temp.tentar('authenticated', :A, 'select * from storage.objects')),
  ('T23', 'Aluno envia arquivo na própria pasta',            'linhas:1', pg_temp.tentar('authenticated', :A, $q$insert into storage.objects(bucket_id,name,owner) values('documents','aaaaaaaa-0000-0000-0000-000000000001/2.pdf',auth.uid())$q$)),
  -- Horas calculadas no banco
  ('T24', 'Aluno declara 30 h e manda reconhecidas=999',     '30',       pg_temp.valor('authenticated', :A, $q$insert into public.certificates(student_id,title,category,activity_type_id,hours,recognized_hours) values(auth.uid(),'x','Curso livre','22222222-0000-0000-0000-000000000001',30,999) returning recognized_hours$q$)),
  ('T25', 'Teto por certificado (40 h) aplicado no banco',   '40',       pg_temp.valor('authenticated', :A, $q$insert into public.certificates(student_id,title,category,activity_type_id,hours) values(auth.uid(),'x','Curso livre','22222222-0000-0000-0000-000000000001',100) returning recognized_hours$q$)),
  -- Coordenação
  ('T26', 'Coordenação lê todos os certificados',            'linhas:4', pg_temp.tentar('authenticated', :C, 'select * from public.certificates')),
  ('T27', 'Coordenação lê todos os perfis',                  'linhas:3', pg_temp.tentar('authenticated', :C, 'select * from public.profiles')),
  ('T28', 'Coordenação aprova pendente',                     'linhas:1', pg_temp.tentar('authenticated', :C, $q$update public.certificates set status='approved' where id='a1000000-0000-0000-0000-000000000000'$q$)),
  ('T29', 'Aprovação grava quem decidiu',                    'cccccccc-0000-0000-0000-000000000003',
                                                                         pg_temp.valor('authenticated', :C, $q$update public.certificates set status='approved' where id='a1000000-0000-0000-0000-000000000000' returning reviewed_by$q$)),
  ('T30', 'Coordenação muda decisão já tomada',              'linhas:0', pg_temp.tentar('authenticated', :C, $q$update public.certificates set status='rejected' where id='a3000000-0000-0000-0000-000000000000'$q$)),
  ('T31', 'Coordenação altera horas do aluno ao aprovar',    'erro',     pg_temp.tentar('authenticated', :C, $q$update public.certificates set status='approved', hours=999 where id='a1000000-0000-0000-0000-000000000000'$q$)),
  ('T32', 'Coordenação lê todos os arquivos',                'linhas:2', pg_temp.tentar('authenticated', :C, 'select * from storage.objects')),
  ('T33', 'Coordenação cria regra de atividade',             'linhas:1', pg_temp.tentar('authenticated', :C, $q$insert into public.activity_types(course_id,eixo,description,min_hours,max_hours) values('11111111-0000-0000-0000-000000000000','Básico','y',1,10)$q$))
)
select id, case when esperado = obtido then 'PASSOU' else 'FALHOU' end as resultado,
       descricao, esperado, obtido
  from t order by id;

-- Cota acumulada (40 h na Monitoria): precisa persistir entre envios, então roda de verdade.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
insert into public.certificates(student_id,title,category,activity_type_id,hours) values(auth.uid(),'m1','Monitoria','22222222-0000-0000-0000-000000000002',30);
insert into public.certificates(student_id,title,category,activity_type_id,hours) values(auth.uid(),'m2','Monitoria','22222222-0000-0000-0000-000000000002',30);
select 'T34' id,
       case when string_agg(recognized_hours::text, ',' order by title) = '30,10' then 'PASSOU' else 'FALHOU' end resultado,
       'Cota acumulada: 30 h + 30 h numa atividade com teto de 40 h' descricao, '30,10' esperado,
       string_agg(recognized_hours::text, ',' order by title) obtido
  from public.certificates where title in ('m1','m2');
\set ON_ERROR_STOP 0
\echo 'T35 Cota esgotada: o próximo envio deve dar ERRO abaixo (esperado):'
insert into public.certificates(student_id,title,category,activity_type_id,hours) values(auth.uid(),'m3','Monitoria','22222222-0000-0000-0000-000000000002',10);
reset role;
