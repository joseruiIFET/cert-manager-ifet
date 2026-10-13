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
  proof_type: string;
  is_active: boolean;
}

interface CourseRow {
  id: string;
  name: string;
}

const COLUMNS = 'id, course_id, eixo, description, min_hours, max_hours, proof_type, is_active';

function _mapActivityType(row: ActivityTypeRow): ActivityType {
  return {
    id: row.id,
    courseId: row.course_id,
    axis: row.eixo,
    description: row.description,
    minHours: Number(row.min_hours),
    maxHours: Number(row.max_hours),
    proofType: row.proof_type,
    isActive: row.is_active,
  };
}

function _toRow(input: ActivityTypeInput) {
  return {
    eixo: input.axis,
    description: input.description,
    min_hours: input.minHours,
    max_hours: input.maxHours,
    proof_type: input.proofType,
    is_active: input.isActive,
  };
}

export function createActivityTypesService(db: SupabaseClient) {
  return {
    /** Regras ativas (formulário do aluno). */
    async listActive(): Promise<ActivityType[]> {
      const { data, error } = await db
        .from('activity_types')
        .select(COLUMNS)
        .eq('is_active', true)
        .order('description', { ascending: true });
      if (error) throw toAppError(error, 'Não foi possível carregar os tipos de atividade.');
      return (data as ActivityTypeRow[]).map(_mapActivityType);
    },

    /** Todas as regras (a coordenação precisa delas para exibir a regra oficial). */
    async listAll(): Promise<ActivityType[]> {
      const { data, error } = await db
        .from('activity_types')
        .select(COLUMNS)
        .order('description', { ascending: true });
      if (error) throw toAppError(error, 'Não foi possível carregar as regras.');
      return (data as ActivityTypeRow[]).map(_mapActivityType);
    },

    async listByCourse(courseId: string): Promise<ActivityType[]> {
      const { data, error } = await db
        .from('activity_types')
        .select(COLUMNS)
        .eq('course_id', courseId)
        .order('eixo', { ascending: true })
        .order('description', { ascending: true });
      if (error) throw toAppError(error, 'Não foi possível carregar as regras do curso.');
      return (data as ActivityTypeRow[]).map(_mapActivityType);
    },

    async create(courseId: string, input: ActivityTypeInput): Promise<void> {
      const { error } = await db
        .from('activity_types')
        .insert([{ ..._toRow(input), course_id: courseId }]);
      if (error) throw toAppError(error, 'Não foi possível salvar a regra.');
    },

    async update(id: string, input: ActivityTypeInput): Promise<void> {
      const { error } = await db.from('activity_types').update(_toRow(input)).eq('id', id);
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
      const { data, error } = await db.from('courses').select('id, name').order('name');
      if (error) throw toAppError(error, 'Não foi possível carregar os cursos.');
      return (data as CourseRow[]).map((r) => ({ id: r.id, name: r.name }));
    },

    async create(name: string): Promise<Course> {
      const { data, error } = await db
        .from('courses')
        .insert([{ name }])
        .select('id, name')
        .single();
      if (error) throw toAppError(error, 'Não foi possível criar o curso.');
      const row = data as CourseRow;
      return { id: row.id, name: row.name };
    },
  };
}

export type ActivityTypesService = ReturnType<typeof createActivityTypesService>;
export type CoursesService = ReturnType<typeof createCoursesService>;
