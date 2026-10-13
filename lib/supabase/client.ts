import { createBrowserClient } from '@supabase/ssr';

/** Cliente de browser (sessão em cookies). Só os serviços devem importar isto. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
