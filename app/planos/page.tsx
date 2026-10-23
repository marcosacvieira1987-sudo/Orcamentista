import Topo from '@/components/Topo';
import { lerAcesso, type Acesso } from '@/lib/plano';
import { SITE } from '@/lib/site';
import { sincronizarSubscricao, stripe, stripeConfigurado } from '@/lib/stripe';
import { exigirUtilizador } from '@/lib/supabase/server';
import { fmtData } from '@/lib/util';

export const dynamic = 'force-dynamic';

const ERROS: Record<string, string> = {
  config: 'Os pagamentos ainda não estão ativos. Tente mais tarde ou fale connosco.',
  stripe: 'Não foi possível abrir a página de pagamento. Tente de novo dentro de momentos.',
  'ja-subscrito': 'Já tem uma subscrição ativa. Para mudar de plano, use "Gerir subscrição".',
};

function situacao(a: Acesso): { titulo: string; texto: string; tom: '' | 'warn' | 'crit' } {
  const nome = a.plano === 'premium' ? 'Premium' : 'Pro';
  const fim = a.periodoFim ? fmtData(new Date(a.periodoFim)) : '';
  if (a.via === 'isento') return { titulo: 'Acesso total', texto: 'Esta conta tem todas as funções incluídas.', tom: '' };
  if (a.via === 'subscricao' && a.estado === 'past_due') return { titulo: `Plano ${nome}: pagamento em atraso`, texto: 'A última cobrança falhou. Atualize o cartão em "Gerir subscrição" para não perder o acesso.', tom: 'crit' };
  if (a.via === 'subscricao') return { titulo: `Plano ${nome} ativo`, texto: a.cancelaNoFim ? `Termina a ${fim}. Até lá mantém todas as funções do plano.` : fim ? `Renova a ${fim}.` : '', tom: '' };
  if (a.via === 'experimental') return { titulo: `Período experimental: ${a.diasExperimental === 1 ? 'falta 1 dia' : `faltam ${a.diasExperimental} dias`}`, texto: 'Tem tudo incluído, como no Premium. Escolha um plano para continuar depois disso.', tom: a.diasExperimental <= 5 ? 'warn' : '' };
  return { titulo: 'Sem plano ativo', texto: 'Os seus orçamentos e PDF continuam disponíveis, mas a IA está em pausa. Escolha um plano para continuar.', tom: 'crit' };
}

export default async function Planos({ searchParams }: { searchParams: Promise<{ sessao?: string; erro?: string }> }) {
  const { sb, id, email } = await exigirUtilizador();
  const { sessao, erro } = await searchParams;

  // regresso do pagamento: ativa já o plano, sem esperar pelo aviso do Stripe
  let pago = false;
  if (sessao && /^cs_[A-Za-z0-9_]+$/.test(sessao) && stripeConfigurado()) {
    try {
      const s = await stripe().checkout.sessions.retrieve(sessao);
      if (s.client_reference_id === id && s.subscription) {
        await sincronizarSubscricao(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        pago = s.status === 'complete';
      }
    } catch (e) { console.error('regresso do checkout', e); }
  }

  const [{ data: emp }, acesso] = await Promise.all([sb.from('empresas').select('nome').maybeSingle(), lerAcesso(sb, id, email)]);
  const sit = situacao(acesso);
  const subscrito = acesso.via === 'subscricao';

  return (
    <div className="wrap wrap-planos">
      <Topo empresa={emp?.nome} atual="planos" />
      <main>
        <section className="intro"><span className="eyebrow">Subscrição</span><h1>O seu plano</h1></section>
        {pago ? <p className="callout ok-box" role="status"><strong>Pagamento recebido. Obrigado!</strong> O plano já está ativo.</p> : null}
        {erro && ERROS[erro] ? <p className="callout crit" role="alert">{ERROS[erro]}</p> : null}

        <section className={'callout plano-sit' + (sit.tom ? ' ' + sit.tom : '')}>
          <strong>{sit.titulo}</strong>
          {sit.texto ? <p className="small">{sit.texto}</p> : null}
          {acesso.cliente ? (
            <form action="/api/pagamentos/portal" method="post"><button className="btn sm">{subscrito ? 'Gerir subscrição, cartão e faturas' : 'Ver faturas anteriores'}</button></form>
          ) : null}
        </section>

        <div className="planos-app">
          {SITE.planos.map((p) => {
            const atual = subscrito && acesso.plano === p.id;
            return (
              <article key={p.id} className={'plano-app' + (p.destaque ? ' destaque' : '') + (atual ? ' atual' : '')}>
                <div className="row-between"><h2>{p.nome}</h2>{atual ? <span className="estado enviado">O seu plano</span> : p.destaque ? <span className="estado aprovado">{p.destaque}</span> : null}</div>
                <p className="small muted">{p.para}</p>
                <p className="plano-preco"><strong className="num">{p.preco} €</strong><span className="muted"> /mês + IVA</span></p>
                <ul>{p.inclui.map((x) => <li key={x}>{x}</li>)}</ul>
                {atual ? null : subscrito ? (
                  <form action="/api/pagamentos/portal" method="post"><button className="btn wide">Mudar para o {p.nome}</button></form>
                ) : (
                  <form action="/api/pagamentos/checkout" method="post"><input type="hidden" name="plano" value={p.id} /><button className={'btn wide lg' + (p.destaque ? ' primary' : ' ink')}>Subscrever o {p.nome}</button></form>
                )}
                <a className="small" href={p.exemplo.href} target="_blank" rel="noopener">{p.exemplo.rotulo}</a>
              </article>
            );
          })}
        </div>
        <p className="small muted">Pagamento seguro pelo Stripe, com cartão ou débito direto. Indique o NIF da empresa no pagamento para a fatura. Pode mudar de plano ou cancelar a qualquer momento; o cancelamento tem efeito no fim do mês já pago.</p>
      </main>
    </div>
  );
}
