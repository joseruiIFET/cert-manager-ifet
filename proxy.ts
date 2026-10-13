import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Gate de rota no servidor (arch.md §3, performance.md §1) — substitui os layout.js com useEffect.
 * Renova a sessão em cookie e decide o destino por papel.
 *
 * ⚠️ Isto é UX/rota. A autorização real é a RLS no banco (arch.md §2).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    const redirectResponse = NextResponse.redirect(url);
    // Preserva cookies de sessão renovados.
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  };

  const isDashboard = pathname.startsWith('/dashboard');
  const isLogin = pathname === '/login';

  if (isDashboard && !user) return redirect('/login');

  if (user && (isDashboard || isLogin)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const isCoordinator = profile?.role === 'coordinator';
    const home = isCoordinator ? '/dashboard/coordinator' : '/dashboard/student';

    if (isLogin) return redirect(home);
    if (pathname.startsWith('/dashboard/coordinator') && !isCoordinator) {
      return redirect('/dashboard/student');
    }
    if (pathname.startsWith('/dashboard/student') && isCoordinator) {
      return redirect('/dashboard/coordinator');
    }
  }

  return response;
}

export const config = {
  matcher: ['/login', '/dashboard/:path*'],
};
