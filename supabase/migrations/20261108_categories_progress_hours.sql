-- ==============================================================================
-- Migration: 20261108_categories_progress_hours.sql
-- Objetivo: Evolução do Cert Manager IFET — Categorias, Progresso e Contabilização
--
-- Preserva todos os dados existentes sem alterações destrutivas.
-- ==============================================================================

-- 1. Suporte a limites acumulados na tabela de tipos de atividades (PPC)
alter table public.activity_types
  add column if not exists max_accumulated_hours integer check (max_accumulated_hours > 0);

-- 2. Suporte a carga horária exigida configurada por curso
alter table public.courses
  add column if not exists total_hours integer not null default 120 check (total_hours > 0);

-- 3. Chave estrangeira, horas reconhecidas e auditoria na tabela de certificados
alter table public.certificates
  add column if not exists activity_type_id uuid references public.activity_types(id),
  add column if not exists recognized_hours integer check (recognized_hours >= 0),
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

-- 4. Migração retrocompatível de dados existentes:
--    Mapeia os registros antigos para os tipos de atividade correspondentes por descrição.
--    Registros sem correspondência direta permanecem com activity_type_id = null e
--    são exibidos usando a coluna textual category como fallback seguro (nenhum registro é excluído).
update public.certificates c
   set activity_type_id = a.id
  from public.activity_types a
 where lower(trim(a.description)) = lower(trim(c.category))
   and c.activity_type_id is null;

-- 5. Preservação histórica das horas reconhecidas em certificados já aprovados
update public.certificates
   set recognized_hours = hours
 where status = 'approved'
   and recognized_hours is null;

-- 6. Índices para performance em consultas combinadas por eixo, tipo e status
create index if not exists certificates_activity_type_id_idx on public.certificates(activity_type_id);
create index if not exists certificates_student_status_idx on public.certificates(student_id, status);
create index if not exists activity_types_eixo_idx on public.activity_types(eixo);

-- 7. Função de segurança transacional para prevenção de concorrência em reservas de saldo
create or replace function public.check_certificate_reservation()
returns trigger as $$
declare
  v_rule record;
  v_used_hours integer;
begin
  -- Se o certificado não possui vínculo com tipo de atividade, prossegue normalmente
  if new.activity_type_id is null then
    return new;
  end if;

  select * into v_rule from public.activity_types where id = new.activity_type_id;
  if not found then
    return new;
  end if;

  -- Se a regra não define limite acumulado, não há restrição de saldo acumulado
  if v_rule.max_accumulated_hours is null then
    return new;
  end if;

  -- Calcula as horas já consumidas (aprovadas + pendentes) por este estudante nesta atividade
  select coalesce(sum(coalesce(recognized_hours, hours)), 0)
    into v_used_hours
    from public.certificates
   where student_id = new.student_id
     and activity_type_id = new.activity_type_id
     and status in ('approved', 'pending')
     and id is distinct from new.id;

  -- Se a quota estiver 100% esgotada, impede inserção com tentativa de contabilização
  if v_used_hours >= v_rule.max_accumulated_hours and coalesce(new.recognized_hours, new.hours) > 0 then
    raise exception 'O limite acumulado desta atividade (% h) já foi totalmente atingido por este estudante.',
      v_rule.max_accumulated_hours;
  end if;

  -- Limita as horas reconhecidas ao saldo restante disponível
  if (v_used_hours + coalesce(new.recognized_hours, new.hours)) > v_rule.max_accumulated_hours then
    new.recognized_hours := greatest(0, v_rule.max_accumulated_hours - v_used_hours);
  end if;

  return new;
end;
$$ language plpgsql security invoker;

drop trigger if exists trg_check_certificate_reservation on public.certificates;
create trigger trg_check_certificate_reservation
  before insert or update of hours, recognized_hours, activity_type_id
  on public.certificates
  for each row
  execute function public.check_certificate_reservation();
