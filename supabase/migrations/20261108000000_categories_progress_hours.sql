-- =============================================================================
-- 20261108000000_categories_progress_hours.sql — Cert Manager IFET
--
-- Categorias por FK, horas reconhecidas, auditoria e cotas acumuladas.
--
-- Revisada em 2026-11-24 ANTES de ser aplicada (o diagnóstico mostrou que a
-- versão original nunca rodou em produção). Mudanças em relação à original:
--   * recognized_hours passa a ser SEMPRE calculado no banco. O valor enviado
--     pelo navegador é ignorado (antes o aluno escolhia as próprias horas).
--   * o teto por certificado (max_hours) também é aplicado no banco.
--   * trava por aluno+atividade (pg_advisory_xact_lock): dois envios
--     simultâneos não estouram mais a cota acumulada.
--
-- Idempotente (pode rodar de novo sem erro). Roda dentro de uma transação:
-- se algo falhar, nada é aplicado.
-- =============================================================================
begin;

-- 1. Teto acumulado por tipo de atividade (PPC)
alter table public.activity_types
  add column if not exists max_accumulated_hours integer
    check (max_accumulated_hours is null or max_accumulated_hours > 0);

-- 2. Carga horária exigida por curso
alter table public.courses
  add column if not exists total_hours integer not null default 120
    check (total_hours > 0);

-- 3. FK de tipo, horas reconhecidas e auditoria da decisão
alter table public.certificates
  add column if not exists activity_type_id uuid references public.activity_types (id),
  add column if not exists recognized_hours integer check (recognized_hours is null or recognized_hours >= 0),
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz;

-- 4. Backfill: liga certificados antigos ao tipo pela descrição (sem apagar nada).
--    Os que não casarem continuam com activity_type_id nulo e usam `category`.
update public.certificates c
   set activity_type_id = a.id
  from public.activity_types a
 where lower(trim(a.description)) = lower(trim(c.category))
   and c.activity_type_id is null;

-- 5. Aprovados antigos: horas reconhecidas = horas declaradas (preserva o histórico)
update public.certificates
   set recognized_hours = hours
 where status = 'approved'
   and recognized_hours is null;

-- 6. Índices (Postgres não indexa FK sozinho)
create index if not exists certificates_student_status_idx  on public.certificates (student_id, status);
create index if not exists certificates_activity_type_id_idx on public.certificates (activity_type_id);
create index if not exists certificates_pending_created_idx  on public.certificates (created_at) where status = 'pending';
create index if not exists activity_types_course_id_idx      on public.activity_types (course_id);
create index if not exists activity_types_eixo_idx           on public.activity_types (eixo);

-- 7. Cálculo das horas reconhecidas — fonte única da regra no servidor.
--    reconhecidas = menor(declaradas, teto por certificado, saldo do teto acumulado)
--    O saldo conta aprovados + pendentes do mesmo aluno na mesma atividade.
drop trigger  if exists trg_check_certificate_reservation on public.certificates;
drop function if exists public.check_certificate_reservation();

create or replace function public.calcular_horas_reconhecidas()
returns trigger
language plpgsql
security definer          -- precisa somar certificados do aluno independentemente de quem decide
set search_path = ''
as $$
declare
  v_rule  public.activity_types%rowtype;
  v_used  integer;
  v_saldo integer;
begin
  -- Rejeitado não reserva horas: nada a calcular.
  if new.status = 'rejected' then
    return new;
  end if;

  -- Sem tipo de atividade (registro legado): sem regra para aplicar.
  if new.activity_type_id is null then
    new.recognized_hours := new.hours;
    return new;
  end if;

  select * into v_rule from public.activity_types where id = new.activity_type_id;
  if not found then
    new.recognized_hours := new.hours;
    return new;
  end if;

  -- Teto por certificado
  new.recognized_hours := least(new.hours, v_rule.max_hours);

  if v_rule.max_accumulated_hours is not null then
    -- Serializa envios do mesmo aluno na mesma atividade até o fim da transação.
    perform pg_advisory_xact_lock(
      hashtextextended(new.student_id::text || ':' || new.activity_type_id::text, 0));

    select coalesce(sum(coalesce(c.recognized_hours, c.hours)), 0)
      into v_used
      from public.certificates c
     where c.student_id = new.student_id
       and c.activity_type_id = new.activity_type_id
       and c.status in ('approved', 'pending')
       and c.id is distinct from new.id;

    v_saldo := greatest(0, v_rule.max_accumulated_hours - v_used);

    if v_saldo = 0 and new.status = 'pending' then
      raise exception 'O limite acumulado desta atividade (% h) já foi totalmente atingido.',
        v_rule.max_accumulated_hours
        using errcode = 'P0001';
    end if;

    new.recognized_hours := least(new.recognized_hours, v_saldo);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_calcular_horas_reconhecidas on public.certificates;
create trigger trg_calcular_horas_reconhecidas
  before insert or update of hours, activity_type_id, status, recognized_hours
  on public.certificates
  for each row
  execute function public.calcular_horas_reconhecidas();

commit;
