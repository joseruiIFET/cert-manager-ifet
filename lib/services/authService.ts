import type { SupabaseClient } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import { createProfilesService } from './profilesService';
import type { Role } from '@/lib/types';

export function createAuthService(db: SupabaseClient) {
  return {
    /** Entra e devolve o papel, para o chamador decidir o destino. */
    async signIn(email: string, password: string): Promise<Role> {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw toAppError(error, 'Erro ao fazer login.');
      return createProfilesService(db).getRole(data.user.id);
    },

    async signOut(): Promise<void> {
      const { error } = await db.auth.signOut();
      if (error) throw toAppError(error, 'Não foi possível sair.');
    },

    /** Id do usuário logado (ou erro de sessão expirada). */
    async requireUserId(): Promise<string> {
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw toAppError({ message: 'not authenticated' });
      return data.user.id;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
