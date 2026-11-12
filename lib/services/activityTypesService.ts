import type { SupabaseClient } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import type { ActivityType, ActivityTypeInput, Axis, Course } from '@/lib/types';

interface ActivityTypeRow {
  id: string;
  course_id: string;
  eixo: Axis;
  description: string;
  min_hours: number;
  max_hours: number;
  max_accumulated_hours?: number | null;
  proof_type: string;
  is_active: boolean;
}

interface CourseRow {
  id: string;
  name: string;
  total_hours?: number;
}

const FULL_COLUMNS =
  'id, course_id, eixo, description, min_hours, max_hours, max_accumulated_hours, proof_type, is_active';
const BASE_COLUMNS =
  'id, course_id, eixo, description, min_hours, max_hours, proof_type, is_active';

function _mapActivityType(row: ActivityTypeRow): ActivityType {
  return {
    id: row.id,
    courseId: row.course_id,
    axis: row.eixo,
    description: row.description,
    minHours: Number(row.min_hours),
    maxHours: Number(row.max_hours),
    maxAccumulatedHours:
      typeof row.max_accumulated_hours === 'number' ? Number(row.max_accumulated_hours) : null,
    proofType: row.proof_type,
    isActive: row.is_active,
  };
}

function _toRow(input: ActivityTypeInput) {
  const row: Record<string, unknown> = {
    eixo: input.axis,
    description: input.description,
    min_hours: input.minHours,
    max_hours: input.maxHours,
    proof_type: input.proofType,
    is_active: input.isActive,
  };
  if (typeof input.maxAccumulatedHours === 'number') {
    row.max_accumulated_hours = input.maxAccumulatedHours;
  }
  return row;
}

export function createActivityTypesService(db: SupabaseClient) {
  return {
    /** Regras ativas (formulário do aluno). */
    async listActive(): Promise<ActivityType[]> {
      let data: unknown[] | null = null;
      const res = await db
        .from('activity_types')
        .select(FULL_COLUMNS)
        .eq('is_active', true)
        .order('description', { ascending: true });

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
        const fallback = await db
          .from('activity_types')
          .select(BASE_COLUMNS)
          .eq('is_active', true)
          .order('description', { ascending: true });
        if (fallback.error) throw toAppError(fallback.error, 'Não foi possível carregar os tipos de atividade.');
        data = fallback.data as unknown[];
      } else if (res.error) {
        throw toAppError(res.error, 'Não foi possível carregar os tipos de atividade.');
      } else {
        data = res.data as unknown[];
      }

      return ((data ?? []) as ActivityTypeRow[]).map(_mapActivityType);
    },

    /** Todas as regras (a coordenação precisa delas para exibir a regra oficial). */
    async listAll(): Promise<ActivityType[]> {
      let data: unknown[] | null = null;
      const res = await db
        .from('activity_types')
        .select(FULL_COLUMNS)
        .order('description', { ascending: true });

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
        const fallback = await db
          .from('activity_types')
          .select(BASE_COLUMNS)
          .order('description', { ascending: true });
        if (fallback.error) throw toAppError(fallback.error, 'Não foi possível carregar as regras.');
        data = fallback.data as unknown[];
      } else if (res.error) {
        throw toAppError(res.error, 'Não foi possível carregar as regras.');
      } else {
        data = res.data as unknown[];
      }

      return ((data ?? []) as ActivityTypeRow[]).map(_mapActivityType);
    },

    async listByCourse(courseId: string): Promise<ActivityType[]> {
      let data: unknown[] | null = null;
      const res = await db
        .from('activity_types')
        .select(FULL_COLUMNS)
        .eq('course_id', courseId)
        .order('eixo', { ascending: true })
        .order('description', { ascending: true });

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
        const fallback = await db
          .from('activity_types')
          .select(BASE_COLUMNS)
          .eq('course_id', courseId)
          .order('eixo', { ascending: true })
          .order('description', { ascending: true });
        if (fallback.error) throw toAppError(fallback.error, 'Não foi possível carregar as regras do curso.');
        data = fallback.data as unknown[];
      } else if (res.error) {
        throw toAppError(res.error, 'Não foi possível carregar as regras do curso.');
      } else {
        data = res.data as unknown[];
      }

      return ((data ?? []) as ActivityTypeRow[]).map(_mapActivityType);
    },

    async create(courseId: string, input: ActivityTypeInput): Promise<void> {
      const payload: Record<string, unknown> = { ..._toRow(input), course_id: courseId };
      let { error } = await db.from('activity_types').insert([payload]);

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        delete payload.max_accumulated_hours;
        const res = await db.from('activity_types').insert([payload]);
        error = res.error;
      }

      if (error) throw toAppError(error, 'Não foi possível salvar a regra.');
    },

    async update(id: string, input: ActivityTypeInput): Promise<void> {
      const payload: Record<string, unknown> = _toRow(input);
      let { error } = await db.from('activity_types').update(payload).eq('id', id);

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        delete payload.max_accumulated_hours;
        const res = await db.from('activity_types').update(payload).eq('id', id);
        error = res.error;
      }

      if (error) throw toAppError(error, 'Não foi possível salvar a regra.');
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('activity_types').delete().eq('id', id);
      if (error) {
        throw toAppError(
          error,
          'Não foi possível excluir. Se houver certificados vinculados, inative a regra.'
        );
      }
    },
  };
}

export function createCoursesService(db: SupabaseClient) {
  return {
    async list(): Promise<Course[]> {
      let data: unknown[] | null = null;
      const res = await db.from('courses').select('id, name, total_hours').order('name');
      if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
        const fallback = await db.from('courses').select('id, name').order('name');
        if (fallback.error) throw toAppError(fallback.error, 'Não foi possível carregar os cursos.');
        data = fallback.data as unknown[];
      } else if (res.error) {
        throw toAppError(res.error, 'Não foi possível carregar os cursos.');
      } else {
        data = res.data as unknown[];
      }

      return ((data ?? []) as CourseRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        totalHours: typeof r.total_hours === 'number' ? r.total_hours : undefined,
      }));
    },

    async create(name: string, totalHours = 120): Promise<Course> {
      const payload: Record<string, unknown> = { name, total_hours: totalHours };
      let { data, error } = await db
        .from('courses')
        .insert([payload])
        .select('id, name')
        .single();

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        delete payload.total_hours;
        const res = await db.from('courses').insert([payload]).select('id, name').single();
        data = res.data;
        error = res.error;
      }

      if (error) throw toAppError(error, 'Não foi possível criar o curso.');
      const row = data as unknown as CourseRow;
      return { id: row.id, name: row.name, totalHours };
    },
  };
}

export type ActivityTypesService = ReturnType<typeof createActivityTypesService>;
export type CoursesService = ReturnType<typeof createCoursesService>;
