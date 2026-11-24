-- Desfaz 20261124000000_seguranca_rls.sql: volta policies e permissões ao estado de 2026-11-24.
-- ATENÇÃO: reabre as falhas de segurança. Rode antes o desfazer do storage (ele usa is_coordinator).
begin;
drop trigger  if exists trg_proteger_campos_certificado on public.certificates;
drop function if exists public.proteger_campos_certificado();

drop policy if exists certificates_select             on public.certificates;
drop policy if exists certificates_insert_student     on public.certificates;
drop policy if exists certificates_update_student     on public.certificates;
drop policy if exists certificates_update_coordinator on public.certificates;
drop policy if exists courses_select                  on public.courses;
drop policy if exists courses_write_coord             on public.courses;
drop policy if exists activity_types_select           on public.activity_types;
drop policy if exists activity_types_write_coord      on public.activity_types;
drop policy if exists profiles_select_own_or_coord    on public.profiles;

create policy "Read profiles" on public.profiles for select using (true);
create policy "Read courses" on public.courses for select using (true);
create policy "Coord manage courses" on public.courses for all using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'coordinator'));
create policy "Read activities" on public.activity_types for select using (true);
create policy "Coord manage activities" on public.activity_types for all using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'coordinator'));
create policy "Read certs" on public.certificates for select using (
  auth.uid() = student_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'coordinator'));
create policy "Insert certs" on public.certificates for insert with check (auth.uid() = student_id);
create policy "Update certs" on public.certificates for update using (
  auth.uid() = student_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'coordinator'));

grant all on public.profiles, public.courses, public.activity_types, public.certificates to anon, authenticated;

alter table public.profiles     drop constraint if exists profiles_role_check, alter column role drop not null;
alter table public.certificates drop constraint if exists certificates_status_check,
                                drop constraint if exists certificates_hours_check,
                                alter column status drop not null;

drop function if exists public.is_coordinator();
commit;
