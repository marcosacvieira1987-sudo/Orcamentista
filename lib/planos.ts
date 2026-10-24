// Catálogo dos planos: preços, limites e regras do lançamento num só sítio (ver docs/decisoes.md).
// Usado no servidor e no browser; as datas do lançamento e a lista da beta só se leem no servidor.

export type PlanoId = 'essencial' | 'pro' | 'premium';
export type Periodo = 'mensal' | 'anual';
export type Tarifa = 'normal' | 'lancamento';

type Def = {
  nome: string;
  completa: boolean;          // proposta completa (capas, carta, fases, adjudicação)
  marca: boolean;             // espaço personalizado: marca no app, página da proposta para o cliente, textos pela IA
  limite: number;             // orçamentos com IA por mês de calendário
  textosIA: number;           // vezes por mês que a IA refaz os textos da marca (espaço personalizado, fase 3)
  precos: Record<Tarifa, Record<Periodo, number>>; // euros sem IVA
};

export const PLANOS: Record<PlanoId, Def> = {
  essencial: { nome: 'Essencial', completa: false, marca: false, limite: 6, textosIA: 0, precos: { normal: { mensal: 29, anual: 290 }, lancamento: { mensal: 19, anual: 190 } } },
  pro: { nome: 'Pro', completa: false, marca: true, limite: 12, textosIA: 3, precos: { normal: { mensal: 59, anual: 590 }, lancamento: { mensal: 39, anual: 390 } } },
  premium: { nome: 'Premium', completa: true, marca: true, limite: 36, textosIA: 10, precos: { normal: { mensal: 180, anual: 1800 }, lancamento: { mensal: 119, anual: 1190 } } },
};
export const ORDEM: PlanoId[] = ['essencial', 'pro', 'premium'];

// 14 dias grátis: funções do Premium com 2 orçamentos com IA para o período todo (decisão de 24 out 2026).
// Chega para experimentar e usar numa obra a sério; custo máximo de cerca de 0,74 € de IA por conta.
export const LIMITE_EXPERIMENTAL = 2;
export const LIMITE_TEXTOS_EXPERIMENTAL = PLANOS.pro.textosIA;

export const ehPlano = (v: unknown): v is PlanoId => v === 'essencial' || v === 'pro' || v === 'premium';
export const ehPeriodo = (v: unknown): v is Periodo => v === 'mensal' || v === 'anual';

// Chave de pesquisa ("lookup key") de cada preço no Stripe, ex.: prumo_pro_anual_lancamento
export const chavePreco = (p: PlanoId, per: Periodo, t: Tarifa) => `prumo_${p}_${per}_${t}`;
export function lerChavePreco(chave?: string | null): { plano: PlanoId; periodo: Periodo; tarifa: Tarifa } | null {
  const m = /^prumo_(essencial|pro|premium)_(mensal|anual)_(normal|lancamento)$/.exec(chave || '');
  return m ? { plano: m[1] as PlanoId, periodo: m[2] as Periodo, tarifa: m[3] as Tarifa } : null;
}

// 1800 → "1.800 €" (o formato pt-PT do browser não separa os milhares em números de 4 algarismos)
export const fmtPreco = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';

// ---------- lançamento (só no servidor) ----------

// 27 a 30 nov 2026, hora de Lisboa (UTC+0 nessa altura). Pode mudar-se por variáveis de ambiente.
export function janelaLancamento() {
  const inicio = new Date(process.env.LANCAMENTO_INICIO || '2026-11-27T00:00:00Z');
  const fim = new Date(process.env.LANCAMENTO_FIM || '2026-11-30T23:59:59Z');
  return { inicio, fim };
}
export function lancamentoAberto(agora = new Date()) {
  const { inicio, fim } = janelaLancamento();
  return agora >= inicio && agora <= fim;
}

// Colegas da beta: preço de lançamento sem prazo e 1.º mês grátis, na primeira adesão.
const listaEmails = (v?: string) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const ehBeta = (email: string) => !!email && listaEmails(process.env.BETA_EMAILS).includes(email.toLowerCase());
export const ehAdmin = (email: string) => !!email && listaEmails(process.env.CONTAS_ADMIN).includes(email.toLowerCase());
export const ehIsento = (email: string) => !!email && listaEmails(process.env.CONTAS_ISENTAS).includes(email.toLowerCase());

// ---------- mês de calendário em Lisboa ----------

function desvioLisboa(d: Date) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Lisbon', timeZoneName: 'shortOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value || 'GMT';
  const m = /GMT([+-]\d+)?(?::(\d+))?/.exec(s);
  return m?.[1] ? Number(m[1]) * 60 + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) : 0) : 0;
}
// Início do mês corrente em Lisboa e do seguinte (instantes UTC).
export function mesLisboa(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(agora).map((x) => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month);
  const inicioDe = (ano: number, mes: number) => { const utc = Date.UTC(ano, mes - 1, 1); return new Date(utc - desvioLisboa(new Date(utc)) * 60000); };
  return { inicio: inicioDe(y, m), seguinte: m === 12 ? inicioDe(y + 1, 1) : inicioDe(y, m + 1) };
}

// dd.mm.aaaa na hora de Lisboa (o servidor corre em UTC)
export const fmtDataLisboa = (d: Date) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d).replace(/\//g, '.');
