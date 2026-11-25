-- Desfaz 20261108000000_categories_progress_hours.sql.
-- Remove só o trigger de cálculo (seguro). As colunas novas são mantidas porque
-- apagá-las perderia dados; se quiser removê-las mesmo, descomente o bloco final.
begin;
drop trigger  if exists trg_calcular_horas_reconhecidas on public.certificates;
drop function if exists public.calcular_horas_reconhecidas();
-- alter table public.certificates drop column if exists activity_type_id, drop column if exists recognized_hours,
--   drop column if exists reviewed_by, drop column if exists reviewed_at;
-- alter table public.activity_types drop column if exists max_accumulated_hours;
-- alter table public.courses drop column if exists total_hours;
commit;
