import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_KEY, SUPABASE_URL } from './lib/supabase/env';

const PUBLICAS = ['/entrar', '/registar', '/recuperar', '/auth', '/privacidade'];

// Renova a sessão em cada pedido e manda para /entrar quem não tem sessão.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers || {}).forEach(([k, v]) => response.headers.set(k, v));
      }
    }
  });
  const { data } = await sb.auth.getClaims();
  const path = request.nextUrl.pathname;
  const publica = path === '/' || PUBLICAS.some((p) => path === p || path.startsWith(p + '/'));
  if (!data?.claims && !publica && !path.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)']
};
