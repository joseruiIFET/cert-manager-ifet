import type { SupabaseClient } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import type { Profile, Role, StudentSummary } from '@/lib/types';

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  matricula?: string | null;
}

function _extractMatricula(email: string | null, rowMatricula?: string | null): string {
  if (rowMatricula && rowMatricula.trim()) return rowMatricula.trim();
  if (!email) return '';
  const local = email.split('@')[0];
  return local;
}

function _mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    role: row.role === 'coordinator' ? 'coordinator' : 'student',
    matricula: _extractMatricula(row.email, row.matricula),
  };
}

export function createProfilesService(db: SupabaseClient) {
  return {
    async getById(id: string): Promise<Profile | null> {
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', id)
        .maybeSingle();
      if (error) throw toAppError(error, 'Não foi possível carregar o perfil.');
      return data ? _mapProfile(data as ProfileRow) : null;
    },

    async getRole(id: string): Promise<Role> {
      const profile = await this.getById(id);
      return profile?.role ?? 'student';
    },
  };
}

export type ProfilesService = ReturnType<typeof createProfilesService>;

/** Usado pelo resumo da coordenação (mantém o shape de perfil mínimo, com matrícula extraída). */
export function mapStudentProfile(row: ProfileRow): StudentSummary['profile'] {
  const p = _mapProfile(row);
  return { id: p.id, fullName: p.fullName, email: p.email, matricula: p.matricula };
}
