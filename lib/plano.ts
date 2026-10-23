import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Quem pode usar o quê. Pro: proposta rápida. Premium: também a proposta completa.
// Período experimental: tudo incluído. Sem plano: os orçamentos continuam abertos, mas a IA para.
export type PlanoId = 'pro' | 'premium';
export type Acesso = {
  plano: PlanoId | null;
  via: 'subscricao' | 'experimental' | 'isento' | 'nenhum';
  diasExperimental: number;
  estado: string;
  periodoFim: string | null;
  cancelaNoFim: boolean;
  cliente: boolean;
};

// estados do Stripe em que a subscrição ainda dá acesso (past_due: o Stripe está a tentar cobrar de novo)
export const ESTADOS_ATIVOS = ['active', 'trialing', 'past_due'];

// Contas com acesso total sem pagar (o dono do produto, parceiros). Emails separados por vírgulas.
const isento = (email: string) =>
  !!email && (process.env.CONTAS_ISENTAS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

export async function lerAcesso(sb: SupabaseClient, userId: string, email: string): Promise<Acesso> {
  const base = { estado: '', periodoFim: null, cancelaNoFim: false, cliente: false, diasExperimental: 0 };
  if (isento(email)) return { ...base, plano: 'premium', via: 'isento' };
  const { data, error } = await sb.from('assinaturas').select('*').eq('user_id', userId).maybeSingle();
  // base de dados ainda sem a migração 0004: não bloqueia ninguém
  if (error && /assinaturas|schema cache|does not exist/i.test(error.message)) return { ...base, plano: 'premium', via: 'isento' };
  const r = data || {};
  const info = { estado: String(r.estado || ''), periodoFim: r.periodo_fim || null, cancelaNoFim: !!r.cancela_no_fim, cliente: !!r.stripe_customer };
  const dias = r.experimental_ate ? Math.ceil((new Date(r.experimental_ate).getTime() - Date.now()) / 86400000) : 0;
  if (r.plano && ESTADOS_ATIVOS.includes(info.estado)) return { ...info, plano: r.plano as PlanoId, via: 'subscricao', diasExperimental: Math.max(0, dias) };
  if (dias > 0) return { ...info, plano: 'premium', via: 'experimental', diasExperimental: dias };
  return { ...info, plano: null, via: 'nenhum', diasExperimental: 0 };
}
