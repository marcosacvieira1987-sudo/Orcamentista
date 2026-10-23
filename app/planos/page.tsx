import Link from 'next/link';
import AdminStripe from '@/components/AdminStripe';
import Topo from '@/components/Topo';
import { marcaDaConta } from '@/lib/marca-app';
import { lerAcesso, usoMensal, type Acesso } from '@/lib/plano';
import { ehAdmin, ehBeta, fmtDataLisboa as fmtData, fmtPreco, janelaLancamento, lancamentoAberto, ORDEM, PLANOS, type Periodo, type Tarifa } from '@/lib/planos';
import { SITE } from '@/lib/site';
import { sincronizarSubscricao, stripe, stripeConfigurado } from '@/lib/stripe';
import { exigirUtilizador } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ERROS: Record<string, string> = {
  config: 'Os pagamentos ainda não estão ativos. Tente mais tarde ou fale connosco.',
  stripe: 'Não foi possível falar com o serviço de pagamentos. Tente de novo dentro de momentos.',
  'ja-subscrito': 'Já tem uma subscrição ativa. Para mudar de plano, use os botões abaixo.',
};

function situacao(a: Acesso): { titulo: string; texto: string; tom: '' | 'warn' | 'crit' } {
  const nome = a.plano ? PLANOS[a.plano].nome : '';
  const fim = a.periodoFim ? fmtData(new Date(a.periodoFim)) : '';
  const tarifa = a.lancamento ? ' Tem o preço de lançamento enquanto não cancelar.' : '';
  if (a.via === 'isento') return { titulo: 'Acesso total', texto: 'Esta conta tem todas as funções incluídas, sem limite.', tom: '' };
  if (a.via === 'subscricao' && a.estado === 'past_due') return { titulo: `Plano ${nome}: pagamento em atraso`, texto: 'A última cobrança falhou. Atualize o cartão em "Pagamento e faturas" para não perder o acesso.', tom: 'crit' };
  if (a.via === 'subscricao' && a.estado === 'trialing') return { titulo: `Plano ${nome}: 1.º mês grátis`, texto: `A primeira cobrança é a ${fim}.${tarifa}`, tom: '' };
  if (a.via === 'subscricao') return { titulo: `Plano ${nome} ${a.periodo === 'anual' ? 'anual' : 'mensal'} ativo`, texto: (a.cancelaNoFim ? `Termina a ${fim}. Até lá mantém todas as funções do plano.` : fim ? `Renova a ${fim}.` : '') + tarifa, tom: '' };
  if (a.via === 'experimental') return { titulo: `Período experimental: ${a.diasExperimental === 1 ? 'falta 1 dia' : `faltam ${a.diasExperimental} dias`}`, texto: `Tem as funções do Premium, até ${a.limite} orçamentos com IA. Escolha um plano para continuar depois disso.`, tom: a.diasExperimental <= 5 ? 'warn' : '' };
  return { titulo: 'Sem plano ativo', texto: 'Os seus orçamentos e PDF continuam disponíveis, mas a IA está em pausa. Escolha um plano para continuar.', tom: 'crit' };
}

export default async function Planos({ searchParams }: { searchParams: Promise<{ sessao?: string; erro?: string; mudou?: string; periodo?: string }> }) {
  const { sb, id, email } = await exigirUtilizador();
  const q = await searchParams;

  // regresso do pagamento: ativa já o plano, sem esperar pelo aviso do Stripe
  let pago = false;
  if (q.sessao && /^cs_[A-Za-z0-9_]+$/.test(q.sessao) && stripeConfigurado()) {
    try {
      const s = await stripe().checkout.sessions.retrieve(q.sessao);
      if (s.client_reference_id === id && s.subscription) {
        await sincronizarSubscricao(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        pago = s.status === 'complete';
      }
    } catch (e) { console.error('regresso do checkout', e); }
  }

  const [{ data: emp }, acesso, mes] = await Promise.all([sb.from('empresas').select('nome, cor, logo_path').maybeSingle(), lerAcesso(sb, id, email), usoMensal(sb)]);
  const sit = situacao(acesso);
  const marca = await marcaDaConta(sb, acesso, emp);
  const subscrito = acesso.via === 'subscricao';

  // preço que esta conta paga: o da sua subscrição, ou o de lançamento (datas ou beta), ou o normal
  const beta = ehBeta(email) && !acesso.jaSubscreveu;
  const tarifa: Tarifa = subscrito ? (acesso.lancamento ? 'lancamento' : 'normal') : lancamentoAberto() || beta ? 'lancamento' : 'normal';
  const periodo: Periodo = q.periodo === 'anual' || q.periodo === 'mensal' ? q.periodo : subscrito && acesso.periodo ? acesso.periodo : 'mensal';
  const fimLanc = janelaLancamento().fim;
  const garantiaAte = acesso.primeiraCompra ? new Date(new Date(acesso.primeiraCompra).getTime() + 30 * 86400000) : null;

  return (
    <div className="wrap wrap-planos">
      <Topo empresa={emp?.nome} atual="planos" marca={marca} />
      <main>
        <section className="intro"><span className="eyebrow">Subscrição</span><h1>O seu plano</h1></section>
        {pago ? <p className="callout ok-box" role="status"><strong>Pagamento recebido. Obrigado!</strong> O plano já está ativo.</p> : null}
        {q.mudou ? <p className="callout ok-box" role="status"><strong>Plano alterado.</strong> A diferença foi acertada na fatura.</p> : null}
        {q.erro && ERROS[q.erro] ? <p className="callout crit" role="alert">{ERROS[q.erro]}</p> : null}

        <section className={'callout plano-sit' + (sit.tom ? ' ' + sit.tom : '')}>
          <strong>{sit.titulo}</strong>
          {sit.texto ? <p className="small">{sit.texto}</p> : null}
          {acesso.plano && Number.isFinite(acesso.limite) ? (
            <p className="small"><strong className="num">{mes.usados} de {acesso.limite}</strong> orçamentos com IA este mês · o contador volta a zero a {fmtData(mes.renova)}</p>
          ) : null}
          {subscrito && garantiaAte && garantiaAte > new Date() ? <p className="small muted">Garantia de 30 dias até {fmtData(garantiaAte)}: se não ficar satisfeito, escreva-nos e devolvemos o valor total.</p> : null}
          {acesso.cliente ? (
            <form action="/api/pagamentos/portal" method="post"><button className="btn sm">{subscrito ? 'Pagamento, faturas e cancelamento' : 'Ver faturas anteriores'}</button></form>
          ) : null}
        </section>

        {tarifa === 'lancamento' && !subscrito ? (
          <p className="callout lanc"><strong>Preço de lançamento{beta ? ' para colegas da beta' : ''}</strong><span className="small">{beta ? 'Sem prazo para aderir, e o 1.º mês é grátis.' : `À venda até ${fmtData(fimLanc)}.`} Fica com este preço nas renovações enquanto não cancelar.</span></p>
        ) : null}

        <nav className="chips periodo" aria-label="Período de pagamento">
          <Link href="/planos?periodo=mensal" className="chip" aria-current={periodo === 'mensal' ? 'true' : undefined}>Mensal</Link>
          <Link href="/planos?periodo=anual" className="chip" aria-current={periodo === 'anual' ? 'true' : undefined}>Anual · 2 meses oferecidos</Link>
        </nav>

        <div className="planos-app">
          {ORDEM.map((pid) => {
            const def = PLANOS[pid], txt = SITE.planos.find((x) => x.id === pid)!;
            const valor = def.precos[tarifa][periodo];
            const atual = subscrito && acesso.plano === pid;
            const mesmoPeriodo = atual && acesso.periodo === periodo;
            return (
              <article key={pid} className={'plano-app' + (txt.selo ? ' destaque' : '') + (atual ? ' atual' : '')}>
                <div className="row-between"><h2>{def.nome}</h2>{atual ? <span className="estado enviado">O seu plano</span> : txt.selo ? <span className="estado aprovado">{txt.selo}</span> : null}</div>
                <p className="small muted">{txt.para}</p>
                <p className="plano-preco"><strong className="num">{fmtPreco(valor)}</strong><span className="muted"> /{periodo === 'anual' ? 'ano' : 'mês'} + IVA</span></p>
                <p className="small muted plano-nota">
                  {periodo === 'anual' ? `Equivale a ${fmtPreco(Math.round(valor / 12))}/mês. ` : ''}
                  {tarifa === 'lancamento' ? `Preço de lançamento. Preço normal: ${fmtPreco(def.precos.normal[periodo])}/${periodo === 'anual' ? 'ano' : 'mês'}.` : ''}
                </p>
                <ul>
                  {txt.inclui.map((x) => <li key={x}>{x}</li>)}
                  {(txt.emBreve || []).map((x) => <li key={x} className="muted">{x} <span className="em-breve">em breve</span></li>)}
                </ul>
                {mesmoPeriodo ? (
                  acesso.periodo === 'mensal' ? <form action="/api/pagamentos/mudar" method="post"><input type="hidden" name="plano" value={pid} /><input type="hidden" name="periodo" value="anual" /><button className="btn wide">Passar a anual · 2 meses oferecidos</button></form> : null
                ) : subscrito ? (
                  <form action="/api/pagamentos/mudar" method="post"><input type="hidden" name="plano" value={pid} /><input type="hidden" name="periodo" value={periodo} /><button className="btn wide">{atual ? `Passar a ${periodo}` : `Mudar para o ${def.nome}`}</button></form>
                ) : (
                  <form action="/api/pagamentos/checkout" method="post"><input type="hidden" name="plano" value={pid} /><input type="hidden" name="periodo" value={periodo} /><button className={'btn wide lg' + (txt.selo ? ' primary' : ' ink')}>{beta ? `Começar o ${def.nome} com 1 mês grátis` : `Subscrever o ${def.nome}`}</button></form>
                )}
                <a className="small" href={txt.exemplo.href} target="_blank" rel="noopener">{txt.exemplo.rotulo}</a>
              </article>
            );
          })}
        </div>
        <p className="small muted">Valores sem IVA (23 %). Pagamento seguro pelo Stripe, com cartão ou débito direto; indique o NIF da empresa para a fatura. Pode mudar de plano a qualquer momento (a diferença é acertada na hora) ou cancelar, com efeito no fim do período já pago. Garantia de 30 dias com reembolso total na primeira compra. Ao subscrever aceita os <Link href="/termos">termos de utilização</Link>.</p>
        {ehAdmin(email) ? <AdminStripe /> : null}
      </main>
    </div>
  );
}
