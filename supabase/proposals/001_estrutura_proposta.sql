-- PROPOSTA — NÃO APLICADA. Revisar contra o schema real (`supabase db pull`) antes de virar
-- migration em supabase/migrations/<timestamp>_*.sql. Os nomes de coluna abaixo são os
-- deduzidos do código; confirme-os.

-- 1) Índices (performance.md §3): Postgres não indexa FK sozinho.
create index if not exists certificates_student_id_idx on public.certificates (student_id);
create index if not exists certificates_status_idx on public.certificates (status);
create index if not exists certificates_pending_idx on public.certificates (created_at)
  where status = 'pending';
create index if not exists activity_types_course_id_idx on public.activity_types (course_id);

-- 2) Auditoria de decisão (arch.md §4)
alter table public.certificates
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz;

-- 3) Vínculo por FK em vez de por nome (arch.md §4) — migração em duas etapas:
--    a) adicionar a coluna e preencher por `description`; b) trocar o código; c) remover `category`.
alter table public.certificates
  add column if not exists activity_type_id uuid references public.activity_types (id);
update public.certificates c
   set activity_type_id = a.id
  from public.activity_types a
 where a.description = c.category and c.activity_type_id is null;

-- 4) Agregação no banco (performance.md §3/§9.3): resumo por aluno para a fila da coordenação.
create or replace view public.student_review_summary
with (security_invoker = true) as
select p.id as student_id,
       p.full_name,
       p.email,
       count(*) filter (where c.status = 'pending')              as pending_count,
       coalesce(sum(c.hours) filter (where c.status = 'approved'), 0) as approved_hours
  from public.profiles p
  join public.certificates c on c.student_id = p.id
 group by p.id, p.full_name, p.email;

-- 5) Bucket privado (arch.md §2): o código já usa URL assinada e aceita caminho ou URL legada.
--    update storage.buckets set public = false where id = 'documents';
--    + policies em storage.objects: aluno lê/escreve só em '<auth.uid()>/…'; coordenação lê tudo.

-- 6) RLS — levantar as policies atuais primeiro. Requisitos mínimos:
--    * aluno: select/insert/update só de certificates com student_id = (select auth.uid()),
--      e update só enquanto status in ('pending','rejected'), sem poder setar 'approved';
--    * coordenação: select de todos; update de status/feedback/reviewed_*;
--    * profiles.role não editável pelo próprio usuário;
--    * activity_types/courses: select para autenticados; escrita só coordenação.
