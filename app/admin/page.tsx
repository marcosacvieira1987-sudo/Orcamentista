import type { Metadata } from 'next';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Topo from '@/components/Topo';
import { MINUTOS_ANTES, TEMPO_ANTES, type Tempo } from '@/lib/orc';
import { ehAdmin, ehBeta, mesLisboa } from '@/lib/planos';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Métricas · Prumo', robots: { index: false, follow: false } };

const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const min = (s: number | null) => (s === null ? '—' : s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

type Orc = { id: string; user_id: string; estado: string; criado_em: string; tempo: Tempo | null };

// Números agregados do produto, para administradores (CONTAS_ADMIN). Sem dados de clientes.
export default async function Metricas() {
  const u = await utilizadorAtual();
  if (!u || !ehAdmin(u.email)) notFound();
  const admin = supabaseAdmin();
  const [{ data: lista }, { data: orcs }, { data: usos }, { data: pubs }, { data: ass }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('orcamentos').select('id, user_id, estado, criado_em, tempo:dados->tempo').or('dados->>exemplo.is.null,dados->>exemplo.neq.true').limit(10000),
    admin.from('uso_ia').select('user_id, orcamento_id, custo_usd, criado_em').limit(50000),
    admin.from('propostas').select('user_id, vistas, aceite_em').limit(10000),
    admin.from('assinaturas').select('user_id, plano, estado, experimental_ate, lancamento, periodo').limit(10000),
  ]);
  const users = lista?.users || [];
  const beta = new Set(users.filter((x) => ehBeta(x.email || '')).map((x) => x.id));
  const { inicio } = mesLisboa();

  const grupo = (filtro: (uid: string) => boolean) => {
    const os = ((orcs || []) as Orc[]).filter((o) => filtro(o.user_id));
    const aprov = os.filter((o) => o.tempo?.aprovado_s);
    const comAntes = os.filter((o) => o.tempo?.antes && o.tempo?.aprovado_s);
    const custoPorOrc = new Map<string, number>();
    for (const x of usos || []) if (x.orcamento_id && filtro(x.user_id)) custoPorOrc.set(x.orcamento_id, (custoPorOrc.get(x.orcamento_id) || 0) + Number(x.custo_usd || 0));
    const custos = [...custoPorOrc.values()].filter((c) => c > 0);
    const ps = (pubs || []).filter((p) => filtro(p.user_id));
    const ativos30 = new Set((usos || []).filter((x) => filtro(x.user_id) && Date.now() - new Date(x.criado_em).getTime() < 30 * 86400000).map((x) => x.user_id));
    const antesMin = comAntes.map((o) => MINUTOS_ANTES[o.tempo!.antes!] || 0).filter(Boolean);
    const depoisMin = comAntes.map((o) => o.tempo!.aprovado_s! / 60);
    return {
      contas: users.filter((x) => filtro(x.id)).length,
      ativas30: ativos30.size,
      orcamentos: os.length,
      orcMes: os.filter((o) => new Date(o.criado_em) >= inicio).length,
      aprovados: aprov.length,
      tempoAprov: mediana(aprov.map((o) => o.tempo!.aprovado_s!)),
      antes: TEMPO_ANTES.map((a) => [a, os.filter((o) => o.tempo?.antes === a).length] as const),
      comparacao: comAntes.length ? { n: comAntes.length, antes: mediana(antesMin), depois: mediana(depoisMin) } : null,
      custoMediano: mediana(custos),
      custoTotalMes: (usos || []).filter((x) => filtro(x.user_id) && new Date(x.criado_em) >= inicio).reduce((s, x) => s + Number(x.custo_usd || 0), 0),
      enviadas: ps.length, vistas: ps.filter((p) => p.vistas > 0).length, aceites: ps.filter((p) => p.aceite_em).length,
    };
  };
  const todos = grupo(() => true), daBeta = grupo((id) => beta.has(id));
  const planos = new Map<string, number>();
  for (const a of ass || []) {
    const k = ['active', 'trialing', 'past_due'].includes(a.estado) && a.plano ? `${a.plano} ${a.periodo || ''}${a.lancamento ? ' (lançamento)' : ''}` : new Date(a.experimental_ate) > new Date() ? 'experiência' : 'sem plano';
    planos.set(k, (planos.get(k) || 0) + 1);
  }

  const Bloco = ({ t, g }: { t: string; g: ReturnType<typeof grupo> }) => (
    <section className="sheet">
      <div className="sh-h"><h2>{t}</h2><span className="lab">{g.contas} contas</span></div>
      <dl className="metricas">
        <dt>Contas ativas (30 dias)</dt><dd>{g.ativas30}</dd>
        <dt>Orçamentos (total / este mês)</dt><dd>{g.orcamentos} / {g.orcMes}</dd>
        <dt>Aprovados (com tempo medido)</dt><dd>{g.aprovados}</dd>
        <dt>Tempo ativo até aprovar (mediana)</dt><dd>{min(g.tempoAprov)}</dd>
        <dt>Antes vs. com o Prumo (mediana)</dt><dd>{g.comparacao ? `${Math.round(g.comparacao.antes!)} min → ${Math.round(g.comparacao.depois!)} min (${g.comparacao.n} orçamentos)` : '—'}</dd>
        <dt>"Sem o Prumo levaria…"</dt><dd>{g.antes.map(([a, n]) => `${a}: ${n}`).join(' · ')}</dd>
        <dt>Custo de IA por orçamento (mediana)</dt><dd>{g.custoMediano === null ? '—' : `${g.custoMediano.toFixed(2).replace('.', ',')} US$`}</dd>
        <dt>Custo de IA este mês</dt><dd>{g.custoTotalMes.toFixed(2).replace('.', ',')} US$</dd>
        <dt>Propostas enviadas por página / vistas / aceites</dt><dd>{g.enviadas} / {g.vistas} ({pct(g.vistas, g.enviadas)}) / {g.aceites} ({pct(g.aceites, g.enviadas)})</dd>
      </dl>
    </section>
  );

  return (
    <div className="wrap wrap-planos">
      <Topo />
      <main>
        <section className="intro"><span className="eyebrow">Administração</span><h1>Métricas</h1><p className="lead">Números agregados, sem dados de clientes. O tempo conta só com o editor aberto e em uso. Use no site só números verdadeiros e com amostra suficiente.</p></section>
        <Bloco t="Beta" g={daBeta} />
        <Bloco t="Todas as contas" g={todos} />
        <section className="sheet"><div className="sh-h"><h2>Planos</h2></div><dl className="metricas">{[...planos.entries()].map(([k, n]) => <Fragment key={k}><dt>{k}</dt><dd>{n}</dd></Fragment>)}</dl></section>
      </main>
    </div>
  );
}
