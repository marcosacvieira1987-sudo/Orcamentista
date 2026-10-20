import type { NextRequest } from 'next/server';
import { redirecionar } from '@/lib/redirecionar';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

// Destino dos links enviados por email (confirmação de registo e recuperação da palavra-passe).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next');
  const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : '/orcamentos';
  const sb = await supabaseServer();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('sem código') };
  return redirecionar(error ? '/entrar?erro=link' : destino);
}
