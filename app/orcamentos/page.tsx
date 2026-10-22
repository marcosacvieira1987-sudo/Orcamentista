import Link from 'next/link';
import Topo from '@/components/Topo';
import { descObra } from '@/lib/orc';
import { exigirUtilizador } from '@/lib/supabase/server';
import { fmtData, fmtEUR, maiuscula } from '@/lib/util';

export const dynamic = 'force-dynamic';

const MAIS = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

// Rascunho → Aprovado → Enviado (o envio fica registado em dados.meta.enviado).
function estadoDe(o: { estado: string; enviado: string | null }) {
  if (o.enviado) return { cls: 'enviado', txt: 'Enviado' };
  return o.estado === 'aprovado' ? { cls: 'aprovado', txt: 'Aprovado' } : { cls: 'rascunho', txt: 'Rascunho' };
}

export default async function Orcamentos() {
  const { sb } = await exigirUtilizador();
  const [{ data: emp }, { data: lista }, { data: usos }] = await Promise.all([
    sb.from('empresas').select('nome, precos, logo_path, telefone, email').maybeSingle(),
    sb.from('orcamentos').select('id, estado, numero, tipo, localidade, dono, total, atualizado_em, titulo:dados->orc->>titulo, enviado:dados->meta->>enviado').order('atualizado_em', { ascending: false }).limit(200),
    sb.from('uso_ia').select('orcamento_id, custo_usd').not('orcamento_id', 'is', null)
  ]);
  // custo de IA por orçamento (vazio enquanto a migração 0002 não estiver aplicada)
  const custo = new Map<string, number>();
  for (const x of usos || []) custo.set(x.orcamento_id, (custo.get(x.orcamento_id) || 0) + Number(x.custo_usd || 0));
  const orcs = lista || [];

  // primeiros passos: desaparecem quando estiverem todos feitos
  const passos = [
    { ok: !!emp?.nome && !!(emp?.telefone || emp?.email), txt: 'Nome e contactos da empresa', href: '/configuracao' },
    { ok: !!emp?.logo_path, txt: 'Logótipo e cor da marca', href: '/configuracao' },
    { ok: Array.isArray(emp?.precos) && emp.precos.length > 0, txt: 'O seu preçário', href: '/configuracao#precario' },
    { ok: orcs.length > 0, txt: 'O primeiro orçamento', href: '' },
  ];
  const feitos = passos.filter((p) => p.ok).length;

  // resumo dos últimos 30 dias
  const desde = Date.now() - 30 * 24 * 3600 * 1000;
  const recentes = orcs.filter((o) => new Date(o.atualizado_em).getTime() >= desde);
  const enviados = recentes.filter((o) => o.enviado);
  const valorEnviado = enviados.reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div className="wrap wrap-lista">
      <Topo empresa={emp?.nome} atual="orcamentos" />
      <main>
        <section className="intro intro-row">
          <div className="intro-t"><span className="eyebrow">Os seus orçamentos</span><h1>Orçamentos</h1></div>
          <form action="/orcamentos/novo" method="post"><button className="btn primary lg btn-novo">{MAIS}Novo orçamento</button></form>
        </section>

        {feitos < passos.length ? (
          <section className="passos-ini" aria-labelledby="ini-t">
            <div className="row-between">
              <h2 id="ini-t">Primeiros passos</h2>
              <span className="mono small muted">{feitos} de {passos.length}</span>
            </div>
            <div className="ini-barra" aria-hidden="true"><i style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
            <ol>
              {passos.map((p) => (
                <li key={p.txt} className={p.ok ? 'ok' : ''}>
                  <span className="ini-marca" aria-hidden="true">{p.ok ? '✓' : ''}</span>
                  {p.ok || !p.href ? <span>{p.txt}{p.ok ? <span className="sr-only"> (feito)</span> : null}</span> : <Link href={p.href}>{p.txt}</Link>}
                </li>
              ))}
            </ol>
            <p className="small muted">Com o preçário, a IA usa os seus preços em vez de estimar. A marca e os contactos entram em todas as propostas.</p>
          </section>
        ) : null}

        {orcs.length ? (
          <section className="resumo-30" aria-label="Últimos 30 dias">
            <div><strong className="num">{recentes.length}</strong><span>orçamentos em 30 dias</span></div>
            <div><strong className="num">{enviados.length}</strong><span>enviados ao cliente</span></div>
            <div><strong className="num">{fmtEUR(valorEnviado).replace(/,\d\d €$/, ' €')}</strong><span>em propostas enviadas</span></div>
          </section>
        ) : null}

        {orcs.length === 0 ? (
          <section className="vazio-grande">
            <p className="vg-t">Ainda não tem orçamentos.</p>
            <p className="muted">Comece pelas fotografias da obra: a IA trata do resto.</p>
            <form action="/orcamentos/novo" method="post"><button className="btn primary lg btn-novo">{MAIS}Criar o primeiro orçamento</button></form>
          </section>
        ) : (
          <section className="cartoes" aria-label="Lista de orçamentos">
            {orcs.map((o) => {
              const e = estadoDe(o);
              const c = custo.get(o.id);
              return (
                <Link key={o.id} href={`/orcamentos/${o.id}`} className={'cartao ' + e.cls}>
                  <span className="c-topo"><span className={'estado ' + e.cls}>{e.txt}</span>{o.numero ? <span className="c-num">N.º {o.numero}</span> : null}</span>
                  <span className="c-tit">{o.titulo || maiuscula(descObra(o.tipo))}</span>
                  <span className="c-sub">{[o.dono, o.localidade].filter(Boolean).join(' · ') || ' '}</span>
                  <span className="c-pe">
                    <span className="c-data">{fmtData(new Date(o.atualizado_em))}{c ? ` · IA ${c.toFixed(2).replace('.', ',')} US$` : ''}</span>
                    {o.total !== null ? <strong className="num c-val">{fmtEUR(Number(o.total))}</strong> : null}
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </main>
      {orcs.length > 3 ? <form action="/orcamentos/novo" method="post" className="fab-form"><button className="fab" aria-label="Novo orçamento (atalho)">{MAIS}</button></form> : null}
    </div>
  );
}
