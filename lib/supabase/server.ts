import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente para Server Components / Server Actions (lê a sessão dos cookies). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component: o proxy já renova a sessão. Seguro ignorar.
          }
        },
      },
    }
  );
}
