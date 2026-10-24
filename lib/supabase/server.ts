import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

// Cliente com a sessão do utilizador: todas as consultas passam pelas regras RLS.
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try { lista.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* chamado a partir de um Server Component: o proxy renova a sessão */ }
      }
    }
  });
}

// Utilizador verificado (assinatura do JWT validada), ou null.
export async function utilizadorAtual() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { sb, id: String(id), email: String(data.claims.email || '') } : null;
}

export async function exigirUtilizador() {
  const u = await utilizadorAtual();
  if (!u) redirect('/entrar');
  return u;
}

// Cliente administrativo: apagar a conta (RGPD), gravar subscrições do Stripe e reservar o limite diário da IA. Ignora RLS — usar com cuidado.
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('Falta SUPABASE_SECRET_KEY');
  return createClient(SUPABASE_URL, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
