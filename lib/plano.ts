import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ehIsento, LIMITE_EXPERIMENTAL, LIMITE_TEXTOS_EXPERIMENTAL, mesLisboa, PLANOS, type Periodo, type PlanoId } from './planos';

export type { PlanoId } from './planos';

// Quem pode usar o quê (catálogo em lib/planos.ts). Essencial e Pro: proposta rápida. Premium: também a completa.
// Período experimental: funções do Premium com LIMITE_EXPERIMENTAL orçamentos com IA. Sem plano: os orçamentos ficam, a IA para.
export type Acesso = {
  plano: PlanoId | null;
  via: 'subscricao' | 'experimental' | 'isento' | 'nenhum';
  completa: boolean;
  marca: boolean;               // espaço personalizado (Pro, Premium, experiência)
  limite: number;               // orçamentos com IA por mês (Infinity: sem limite)
  limiteTextos: number;         // vezes por mês que a IA escreve os textos da marca
  diasExperimental: number;
  estado: string;
  periodo: Periodo | null;
  lancamento: boolean;
  periodoFim: string | null;
  cancelaNoFim: boolean;
  primeiraCompra: string | null;
  jaSubscreveu: boolean;        // já teve uma subscrição (a beta e a garantia só valem na primeira)
  cliente: boolean;
};

// estados do Stripe em que a subscrição ainda dá acesso (past_due: o Stripe está a tentar cobrar de novo)
export const ESTADOS_ATIVOS = ['active', 'trialing', 'past_due'];

// Montagens completas do mesmo orçamento por mês: um orçamento não serve de "caixa" para vários.
export const MONTAGENS_POR_ORCAMENTO = 5;

export async function lerAcesso(sb: SupabaseClient, userId: string, email: string): Promise<Acesso> {
  const base = { estado: '', periodo: null, lancamento: false, periodoFim: null, cancelaNoFim: false, primeiraCompra: null, jaSubscreveu: false, cliente: false, diasExperimental: 0 };
  const total: Acesso = { ...base, plano: 'premium', via: 'isento', completa: true, marca: true, limite: Infinity, limiteTextos: Infinity };
  if (ehIsento(email)) return total;
  const { data, error } = await sb.from('assinaturas').select('*').eq('user_id', userId).maybeSingle();
  // base de dados ainda sem a migração 0004: não bloqueia ninguém
  if (error && /assinaturas|schema cache|does not exist/i.test(error.message)) return total;
  const r = data || {};
  const info = {
    estado: String(r.estado || ''), periodo: (r.periodo || null) as Periodo | null, lancamento: !!r.lancamento,
    periodoFim: r.periodo_fim || null, cancelaNoFim: !!r.cancela_no_fim, primeiraCompra: r.primeira_compra || null,
    jaSubscreveu: !!r.stripe_subscription, cliente: !!r.stripe_customer,
  };
  const dias = r.experimental_ate ? Math.max(0, Math.ceil((new Date(r.experimental_ate).getTime() - Date.now()) / 86400000)) : 0;
  const plano = r.plano as PlanoId | null;
  if (plano && PLANOS[plano] && ESTADOS_ATIVOS.includes(info.estado)) return { ...info, plano, via: 'subscricao', completa: PLANOS[plano].completa, marca: PLANOS[plano].marca, limite: PLANOS[plano].limite, limiteTextos: PLANOS[plano].textosIA, diasExperimental: dias };
  if (dias > 0) return { ...info, plano: 'premium', via: 'experimental', completa: true, marca: true, limite: LIMITE_EXPERIMENTAL, limiteTextos: LIMITE_TEXTOS_EXPERIMENTAL, diasExperimental: dias };
  return { ...info, plano: null, via: 'nenhum', completa: false, marca: false, limite: 0, limiteTextos: 0, diasExperimental: 0 };
}

// Orçamentos em que a IA já trabalhou desde uma data (sem data: desde sempre). Ajustes ao mesmo orçamento não contam outra vez.
// Só contam pedidos em que a IA respondeu (tokens > 0): uma falha não gasta o limite.
async function contarUso(sb: SupabaseClient, desde: Date | null) {
  let q = sb.from('uso_ia').select('orcamento_id, acao').gt('tokens_in', 0).not('orcamento_id', 'is', null);
  if (desde) q = q.gte('criado_em', desde.toISOString());
  const { data } = await q.limit(5000);
  const ids = new Set<string>();
  const montagens = new Map<string, number>();
  for (const x of data || []) {
    const id = String(x.orcamento_id);
    ids.add(id);
    if (x.acao === 'orcamento') montagens.set(id, (montagens.get(id) || 0) + 1);
  }
  return { usados: ids.size, ids, montagens };
}

// Planos: o limite conta por mês de calendário (Lisboa) e volta a zero no dia 1.
export async function usoMensal(sb: SupabaseClient) {
  const { inicio, seguinte } = mesLisboa();
  return { ...(await contarUso(sb, inicio)), renova: seguinte };
}

// Período experimental: o limite vale para os 14 dias todos e não volta a zero no dia 1.
// A conta só está em experiência nos primeiros dias desde que foi criada, por isso conta-se tudo.
export async function usoExperimental(sb: SupabaseClient) {
  return contarUso(sb, null);
}

// Vezes que a IA escreveu os textos da marca este mês (só contam respostas com tokens).
export async function textosNoMes(sb: SupabaseClient) {
  const { inicio } = mesLisboa();
  const { count } = await sb.from('uso_ia').select('id', { count: 'exact', head: true }).eq('acao', 'textos').gte('criado_em', inicio.toISOString()).gt('tokens_in', 0);
  return count || 0;
}
