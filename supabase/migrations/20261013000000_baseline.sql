-- =============================================================================
-- 20261013000000_baseline.sql — Cert Manager IFET
--
-- RETRATO do banco de produção como estava em 2026-11-24 (levantado com
-- supabase/scripts/00_diagnostico.sql). JÁ EXISTE EM PRODUÇÃO: NÃO EXECUTAR lá.
--
-- Serve para: (1) versionar o ponto de partida; (2) recriar o banco do zero num
-- projeto de teste, rodando este arquivo e depois as migrations seguintes em ordem.
-- As policies abaixo são as ORIGINAIS (com as falhas que as migrations de
-- 20261124 corrigem). Não "conserte" este arquivo: ele é histórico.
-- =============================================================================

create extension if not exists "uuid-ossp" with schema extensions;

-- Tabelas -------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  role       text default 'student',
  created_at timestamptz default now()
);

create table public.courses (
  id         uuid primary key default extensions.uuid_generate_v4(),
  name       text not null,
  created_at timestamptz default now()
);

create table public.activity_types (
  id          uuid primary key default extensions.uuid_generate_v4(),
  course_id   uuid not null references public.courses (id),
  eixo        text not null,
  description text not null,
  min_hours   integer not null,
  max_hours   integer not null,
  proof_type  text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

create table public.certificates (
  id         uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.profiles (id),
  title      text not null,
  category   text not null,
  hours      integer not null,
  file_url   text,
  status     text default 'pending',
  feedback   text,
  created_at timestamptz default now()
);

-- Perfil criado automaticamente no cadastro ----------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS (originais) -------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.courses        enable row level security;
alter table public.activity_types enable row level security;
alter table public.certificates   enable row level security;

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

-- Storage (originais) ---------------------------------------------------------
-- Bucket 'documents' criado pelo painel, PÚBLICO, sem limite de tamanho nem de MIME.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "Permitir leitura de arquivos" on storage.objects
  for select using (bucket_id = 'documents');
create policy "Permitir upload para usuarios logados" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
create policy "Permitir alteracao do proprio arquivo" on storage.objects
  for update to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
create policy "Permitir exclusao do proprio arquivo" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
