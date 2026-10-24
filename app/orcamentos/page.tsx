import Link from 'next/link';
import Topo from '@/components/Topo';
import { descObra } from '@/lib/orc';
import { marcaDaConta } from '@/lib/marca-app';
import { lerAcesso, usoMensal } from '@/lib/plano';
import { fmtDataLisboa } from '@/lib/planos';
import { exigirUtilizador } from '@/lib/supabase/server';
import { fmtData, fmtEUR, maiuscula } from '@/lib/util';

export const dynamic = 'force-dynamic';

const MAIS = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

type Pub = { orcamento_id: string; vistas: number; aceite_em: string | null; aceite_nome: string | null };

// Rascunho → Aprovado → Enviado → Vista → Aceite (envio em dados.meta.enviado; vista e aceite na página da proposta).
function estadoDe(o: { estado: string; enviado: string | null; exemplo?: string | null }, p?: Pub) {
  if (o.exemplo === 'true') return { cls: 'rascunho', txt: 'Exemplo' };
  if (p?.aceite_em) return { cls: 'aceite', txt: 'Aceite' };
  if (p?.vistas) return { cls: 'enviado', txt: 'Vista pelo cliente' };
  if (o.enviado) return { cls: 'enviado', txt: 'Enviado' };
  return o.estado === 'aprovado' ? { cls: 'aprovado', txt: 'Aprovado' } : { cls: 'rascunho', txt: 'Rascunho' };
}

export default async function Orcamentos() {
  const { sb, id, email } = await exigirUtilizador();
  const [{ data: emp }, { data: lista }, { data: usos }, acesso, mes, { data: pubs }] = await Promise.all([
    sb.from('empresas').select('nome, precos, logo_path, telefone, email, cor').maybeSingle(),
    sb.from('orcamentos').select('id, estado, numero, tipo, localidade, dono, total, atualizado_em, titulo:dados->orc->>titulo, enviado:dados->meta->>enviado, exemplo:dados->>exemplo').order('atualizado_em', { ascending: false }).limit(200),
    sb.from('uso_ia').select('orcamento_id, custo_usd').not('orcamento_id', 'is', null),
    lerAcesso(sb, id, email),
    usoMensal(sb),
    // página da proposta (migração 0006); sem a tabela, fica vazio
    sb.from('propostas').select('orcamento_id, vistas, aceite_em, aceite_nome')
  ]);
  const marca = await marcaDaConta(sb, acesso, emp);
  const pub = new Map<string, Pub>(((pubs || []) as Pub[]).map((p) => [p.orcamento_id, p]));
  const aceitesRecentes = ((pubs || []) as Pub[]).filter((p) => p.aceite_em && Date.now() - new Date(p.aceite_em).getTime() < 14 * 86400000);
  // custo de IA por orçamento (vazio enquanto a migração 0002 não estiver aplicada)
  const custo = new Map<string, number>();
  for (const x of usos || []) custo.set(x.orcamento_id, (custo.get(x.orcamento_id) || 0) + Number(x.custo_usd || 0));
  const orcs = lista || [];
  // o orçamento de exemplo não conta nos primeiros passos nem no resumo
  const reais = orcs.filter((o) => o.exemplo !== 'true');

  // primeiros passos: desaparecem quando estiverem todos feitos
  const passos = [
    { ok: !!emp?.nome && !!(emp?.telefone || emp?.email), txt: 'Nome e contactos da empresa', href: '/configuracao' },
    { ok: !!emp?.logo_path, txt: 'Logótipo e cor da marca', href: '/configuracao' },
    { ok: Array.isArray(emp?.precos) && emp.precos.length > 0, txt: 'O seu preçário', href: '/configuracao#precario' },
    { ok: reais.length > 0, txt: 'O primeiro orçamento', href: '' },
  ];
  const feitos = passos.filter((p) => p.ok).length;

  // resumo dos últimos 30 dias
  const desde = Date.now() - 30 * 24 * 3600 * 1000;
  const recentes = reais.filter((o) => new Date(o.atualizado_em).getTime() >= desde);
  const enviados = recentes.filter((o) => o.enviado);
  const valorEnviado = enviados.reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div className="wrap wrap-lista">
      <Topo empresa={emp?.nome} atual="orcamentos" marca={marca} />
      <main>
        <section className="intro intro-row">
          <div className="intro-t"><span className="eyebrow">Os seus orçamentos</span><h1>Orçamentos</h1></div>
          <form action="/orcamentos/novo" method="post"><button className="btn primary lg btn-novo">{MAIS}Novo orçamento</button></form>
        </section>

        {aceitesRecentes.length ? (
          <section className="callout ok-box aceites" aria-label="Propostas aceites">
            {aceitesRecentes.map((p) => {
              const o = (lista || []).find((x) => x.id === p.orcamento_id);
              return <Link key={p.orcamento_id} href={`/orcamentos/${p.orcamento_id}`}><strong>{p.aceite_nome} aceitou a proposta{o?.numero ? ` n.º ${o.numero}` : ''}</strong><span className="small">{o?.titulo || 'Orçamento'} · {fmtData(new Date(p.aceite_em!))}</span></Link>;
            })}
          </section>
        ) : null}

        {acesso.via === 'nenhum' ? (
          <section className="callout crit"><strong>Sem plano ativo</strong><p className="small">Os seus orçamentos continuam disponíveis, mas a IA está em pausa.</p><div><Link className="btn primary sm" href="/planos">Escolher um plano</Link></div></section>
        ) : acesso.via === 'experimental' && acesso.diasExperimental <= 5 ? (
          <section className="callout warn"><strong>{acesso.diasExperimental === 1 ? 'Falta 1 dia' : `Faltam ${acesso.diasExperimental} dias`} do período experimental</strong><p className="small">Escolha um plano para continuar a usar a IA sem interrupções.</p><div><Link className="btn sm" href="/planos">Ver planos</Link></div></section>
        ) : acesso.plano && mes.usados >= acesso.limite ? (
          <section className="callout warn"><strong>Usou os {acesso.limite} orçamentos com IA deste mês</strong><p className="small">A IA volta a {fmtDataLisboa(mes.renova)}. Os orçamentos já começados continuam a funcionar. Para continuar já com orçamentos novos, suba de plano.</p><div><Link className="btn sm" href="/planos">Ver planos</Link></div></section>
        ) : acesso.via === 'subscricao' && acesso.estado === 'past_due' ? (
          <section className="callout crit"><strong>O último pagamento falhou</strong><p className="small">Atualize o cartão para não perder o acesso.</p><div><Link className="btn sm" href="/planos">Resolver</Link></div></section>
        ) : null}

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

        {reais.length ? (
          <section className="resumo-30" aria-label="Últimos 30 dias">
            {acesso.plano ? <div className="r-ia"><strong className="num">{mes.usados}{Number.isFinite(acesso.limite) ? <small> de {acesso.limite}</small> : null}</strong><span>orçamentos com IA este mês</span>{Number.isFinite(acesso.limite) ? <i className="r-barra" aria-hidden="true"><b style={{ width: `${Math.min(100, (mes.usados / acesso.limite) * 100)}%` }} /></i> : null}</div> : null}
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
            <form action="/orcamentos/exemplo" method="post"><button className="link">Ou veja primeiro um orçamento de exemplo, sem gastar nada</button></form>
          </section>
        ) : (
          <section className="cartoes" aria-label="Lista de orçamentos">
            {orcs.map((o) => {
              const e = estadoDe(o, pub.get(o.id));
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
