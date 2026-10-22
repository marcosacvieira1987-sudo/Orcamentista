import Link from 'next/link';
import Topo from '@/components/Topo';
import { descObra } from '@/lib/orc';
import { exigirUtilizador } from '@/lib/supabase/server';
import { fmtData, fmtEUR, maiuscula } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function Orcamentos() {
  const { sb } = await exigirUtilizador();
  const [{ data: emp }, { data: lista }, { data: usos }] = await Promise.all([
    sb.from('empresas').select('nome, precos').maybeSingle(),
    sb.from('orcamentos').select('id, estado, numero, tipo, localidade, dono, total, atualizado_em, titulo:dados->orc->>titulo').order('atualizado_em', { ascending: false }).limit(200),
    sb.from('uso_ia').select('orcamento_id, custo_usd').not('orcamento_id', 'is', null)
  ]);
  // custo de IA por orçamento (vazio enquanto a migração 0002 não estiver aplicada)
  const custo = new Map<string, number>();
  for (const x of usos || []) custo.set(x.orcamento_id, (custo.get(x.orcamento_id) || 0) + Number(x.custo_usd || 0));
  const semConfig = !emp?.nome || !Array.isArray(emp?.precos) || emp.precos.length === 0;
  return (
    <div className="wrap">
      <Topo empresa={emp?.nome} atual="orcamentos" />
      <main>
        <section className="intro intro-row">
          <div className="intro-t"><span className="eyebrow">Os seus orçamentos</span><h1>Orçamentos</h1></div>
          <form action="/orcamentos/novo" method="post"><button className="btn primary lg">Novo orçamento</button></form>
        </section>
        {semConfig ? (
          <section className="callout">
            <strong>Configure a empresa primeiro</strong>
            <p className="small muted">Nome, logótipo, contactos e o seu preçário entram em todas as propostas. Com o preçário, a IA usa os seus preços em vez de estimar.</p>
            <div><Link className="btn" href="/configuracao">Configurar empresa</Link></div>
          </section>
        ) : null}
        <section className="sheet lista" aria-label="Lista de orçamentos">
          {(lista || []).length === 0 ? <p className="vazio">Ainda não tem orçamentos. Carregue em “Novo orçamento”.</p> : null}
          {(lista || []).map((o) => (
            <Link key={o.id} href={`/orcamentos/${o.id}`} className="item">
              <span className="t1">{o.titulo || maiuscula(descObra(o.tipo))}{o.dono ? ` · ${o.dono}` : ''}</span>
              <span className="t2">{[o.numero ? 'N.º ' + o.numero : '', o.localidade, fmtData(new Date(o.atualizado_em)), custo.get(o.id) ? `IA ${custo.get(o.id)!.toFixed(2).replace('.', ',')} US$` : ''].filter(Boolean).join(' · ')}</span>
              <span className="val">
                <span className={'estado ' + o.estado}>{o.estado === 'aprovado' ? 'Aprovado' : 'Rascunho'}</span>
                {o.total !== null ? <strong className="num">{fmtEUR(Number(o.total))}</strong> : null}
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
