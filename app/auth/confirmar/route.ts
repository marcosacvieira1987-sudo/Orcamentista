import type { NextRequest } from 'next/server';
import { redirecionar } from '@/lib/redirecionar';
import { supabaseServer } from '@/lib/supabase/server';

// Só estes destinos: um `next` livre deixava passar '/\outro-site' (o browser lê-o como '//outro-site').
const DESTINOS = new Set(['/orcamentos', '/configuracao', '/nova-password']);

// Destino dos links enviados por email (confirmação de registo e recuperação da palavra-passe).
// Só aceita o `code` PKCE (os modelos usam {{ .ConfirmationURL }}): fica ligado ao browser que pediu o email,
// por isso um link com o token de outra pessoa não abre sessão aqui.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next') || '';
  const destino = DESTINOS.has(next) ? next : '/orcamentos';
  const code = url.searchParams.get('code');
  if (!code) return redirecionar('/entrar?erro=link');
  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  return redirecionar(error ? '/entrar?erro=link' : destino);
}
