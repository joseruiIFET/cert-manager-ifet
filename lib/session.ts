import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createProfilesService } from '@/lib/services/profilesService';
import type { Profile } from '@/lib/types';

/**
 * Perfil do usuário logado, para Server Components. O proxy.ts já barrou quem não está logado;
 * o redirect aqui é a rede de segurança.
 */
export async function requireProfile(): Promise<Profile> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login');

  const profile = await createProfilesService(db).getById(data.user.id);
  if (!profile) redirect('/login');
  return profile;
}
