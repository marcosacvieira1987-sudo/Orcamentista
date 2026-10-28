import { redirecionar } from '@/lib/redirecionar';
import { lerAcesso } from '@/lib/plano';
import { sincronizarSubscricao, stripe, stripeConfigurado } from '@/lib/stripe';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// "Começar já": quem subscreveu durante os dias grátis acaba-os agora, paga nesse momento e passa a ter o plano todo.
// error_if_incomplete: se o banco recusar ou pedir confirmação, a subscrição fica como estava
// (grátis até ao fim da experiência, com a cobrança nesse dia), em vez de ficar com um pagamento em atraso.
export async function POST() {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  if (!stripeConfigurado()) return redirecionar('/planos?erro=config');
  const acesso = await lerAcesso(u.sb, u.id, u.email);
  if (!acesso.ateAoPagamento) return redirecionar('/planos');
  const { data: ass } = await u.sb.from('assinaturas').select('stripe_subscription').eq('user_id', u.id).maybeSingle();
  if (!ass?.stripe_subscription) return redirecionar('/planos');
  try {
    await stripe().subscriptions.update(ass.stripe_subscription, { trial_end: 'now', payment_behavior: 'error_if_incomplete' });
  } catch (e) {
    console.error('stripe começar já', e);
    const recusado = (e as { statusCode?: number; type?: string }).statusCode === 402 || (e as { type?: string }).type === 'StripeCardError';
    return redirecionar(recusado ? '/planos?erro=cobranca' : '/planos?erro=stripe');
  }
  try { await sincronizarSubscricao(ass.stripe_subscription); } catch (e) { console.error('sincronizar depois de começar já', e); }
  return redirecionar('/planos?comecou=1');
}
