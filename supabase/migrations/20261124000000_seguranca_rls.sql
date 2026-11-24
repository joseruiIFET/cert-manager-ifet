-- =============================================================================
-- 20261124000000_seguranca_rls.sql — Cert Manager IFET
--
-- Corrige as falhas de RLS encontradas no diagnóstico de 2026-11-24:
--   F1  aluno podia INSERIR certificado já com status 'approved'
--   F2  aluno podia ATUALIZAR o próprio certificado para 'approved'
--       (e apagar o histórico de rejeição em `feedback`)
--   F3  qualquer pessoa, mesmo sem login, lia nome e e-mail de todos em `profiles`
--   F4  anon/authenticated tinham TRUNCATE, TRIGGER e REFERENCES nas tabelas
--   F5  status e role aceitavam qualquer texto (sem check)
--
-- Regras novas:
--   * aluno: lê os seus; cria só como 'pending'; corrige só quando 'rejected'
--     (volta para 'pending'); não mexe em feedback, revisor nem dono.
--   * coordenação: lê tudo; decide só o que está 'pending'; não altera o
--     conteúdo enviado pelo aluno; revisor e data são gravados pelo banco.
--   * profiles: cada um lê o seu; coordenação lê todos; ninguém altera `role`
--     pela API (só pelo SQL Editor).
--
-- Pré-requisito: 20261108000000_categories_progress_hours.sql (colunas reviewed_*).
-- Idempotente. Roda numa transação: se algo falhar, nada é aplicado.
-- =============================================================================
begin;

-- 0. Função auxiliar: o usuário logado é coordenação?
--    security definer evita recursão de RLS ao consultar profiles dentro de policies.
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and role = 'coordinator'
  );
$$;
revoke all on function public.is_coordinator() from public;
grant execute on function public.is_coordinator() to authenticated;

-- 1. Domínios fechados (F5)
update public.profiles set role = 'student' where role is null;
update public.certificates set status = 'pending' where status is null;

alter table public.profiles
  alter column role set not null,
  drop constraint if exists profiles_role_check,
  add  constraint profiles_role_check check (role in ('student', 'coordinator'));

alter table public.certificates
  alter column status set not null,
  drop constraint if exists certificates_status_check,
  add  constraint certificates_status_check check (status in ('pending', 'approved', 'rejected')),
  drop constraint if exists certificates_hours_check,
  add  constraint certificates_hours_check check (hours > 0);

-- 2. Privilégios de tabela (F4). RLS não se aplica a TRUNCATE: tira de todos.
revoke all on public.profiles, public.courses, public.activity_types, public.certificates from anon;
revoke truncate, references, trigger
    on public.profiles, public.courses, public.activity_types, public.certificates
  from authenticated;
revoke insert, update, delete on public.profiles from authenticated;
revoke delete on public.certificates from authenticated;

-- 3. profiles (F3)
drop policy if exists "Read profiles"            on public.profiles;
drop policy if exists profiles_select_own_or_coord on public.profiles;
create policy profiles_select_own_or_coord on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_coordinator()));

-- 4. courses e activity_types: leitura para logados; escrita só coordenação
drop policy if exists "Read courses"         on public.courses;
drop policy if exists "Coord manage courses" on public.courses;
drop policy if exists courses_select          on public.courses;
drop policy if exists courses_write_coord     on public.courses;
create policy courses_select on public.courses
  for select to authenticated using (true);
create policy courses_write_coord on public.courses
  for all to authenticated
  using ((select public.is_coordinator()))
  with check ((select public.is_coordinator()));

drop policy if exists "Read activities"         on public.activity_types;
drop policy if exists "Coord manage activities" on public.activity_types;
drop policy if exists activity_types_select      on public.activity_types;
drop policy if exists activity_types_write_coord on public.activity_types;
create policy activity_types_select on public.activity_types
  for select to authenticated using (true);
create policy activity_types_write_coord on public.activity_types
  for all to authenticated
  using ((select public.is_coordinator()))
  with check ((select public.is_coordinator()));

-- 5. certificates (F1, F2)
drop policy if exists "Read certs"   on public.certificates;
drop policy if exists "Insert certs" on public.certificates;
drop policy if exists "Update certs" on public.certificates;
drop policy if exists certificates_select              on public.certificates;
drop policy if exists certificates_insert_student      on public.certificates;
drop policy if exists certificates_update_student      on public.certificates;
drop policy if exists certificates_update_coordinator  on public.certificates;

create policy certificates_select on public.certificates
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_coordinator()));

create policy certificates_insert_student on public.certificates
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and feedback is null
    and reviewed_by is null
    and reviewed_at is null
  );

-- Aluno: só corrige o que foi rejeitado, e a correção volta para análise.
create policy certificates_update_student on public.certificates
  for update to authenticated
  using (student_id = (select auth.uid()) and status = 'rejected')
  with check (student_id = (select auth.uid()) and status = 'pending');

-- Coordenação: só decide o que está pendente.
create policy certificates_update_coordinator on public.certificates
  for update to authenticated
  using ((select public.is_coordinator()) and status = 'pending')
  with check ((select public.is_coordinator()) and status in ('approved', 'rejected'));

-- 6. Guarda de colunas: RLS filtra LINHAS; este trigger protege CAMPOS.
create or replace function public.proteger_campos_certificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Sem usuário (SQL Editor, service role): manutenção administrativa, sem guarda.
  if v_uid is null then
    return new;
  end if;

  -- Ninguém muda o dono nem a data de envio.
  if new.student_id is distinct from old.student_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Não é permitido alterar o dono ou a data de envio do certificado.'
      using errcode = '42501';
  end if;

  if public.is_coordinator() then
    -- Coordenação decide, mas não reescreve o que o aluno enviou.
    if new.title            is distinct from old.title
       or new.category      is distinct from old.category
       or new.hours         is distinct from old.hours
       or new.file_url      is distinct from old.file_url
       or new.activity_type_id is distinct from old.activity_type_id then
      raise exception 'A coordenação não pode alterar os dados enviados pelo aluno.'
        using errcode = '42501';
    end if;
    -- Auditoria gravada pelo banco, não pelo navegador.
    if new.status is distinct from old.status then
      new.reviewed_by := v_uid;
      new.reviewed_at := now();
    end if;
  else
    -- Aluno não mexe no histórico de rejeição nem na auditoria.
    if new.feedback       is distinct from old.feedback
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Não é permitido alterar a avaliação da coordenação.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_certificado on public.certificates;
create trigger trg_proteger_campos_certificado
  before update on public.certificates
  for each row
  execute function public.proteger_campos_certificado();

commit;
