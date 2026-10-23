import { redirecionar } from '@/lib/redirecionar';
import { ESTADOS_ATIVOS } from '@/lib/plano';
import { ehPeriodo, ehPlano, lerChavePreco } from '@/lib/planos';
import { idPreco, sincronizarSubscricao, stripe, stripeConfigurado } from '@/lib/stripe';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Muda o plano ou o período de uma subscrição ativa, mantendo a tarifa (quem tem preço de lançamento continua com ele).
// O acerto é proporcional e cobrado (ou creditado) logo.
export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const form = await req.formData();
  const plano = form.get('plano'), periodoPedido = form.get('periodo');
  if (!ehPlano(plano) || !stripeConfigurado()) return redirecionar('/planos');
  const { data: ass } = await u.sb.from('assinaturas').select('stripe_subscription, estado').eq('user_id', u.id).maybeSingle();
  if (!ass?.stripe_subscription || !ESTADOS_ATIVOS.includes(String(ass.estado))) return redirecionar('/planos');
  try {
    const sub = await stripe().subscriptions.retrieve(ass.stripe_subscription);
    const item = sub.items.data[0];
    const atual = lerChavePreco(item?.price?.lookup_key);
    if (!item || !atual) return redirecionar('/planos?erro=stripe');
    const periodo = ehPeriodo(periodoPedido) ? periodoPedido : atual.periodo;
    if (plano === atual.plano && periodo === atual.periodo) return redirecionar('/planos');
    const preco = await idPreco(plano, periodo, atual.tarifa);
    if (!preco) return redirecionar('/planos?erro=config');
    await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, price: preco }],
      proration_behavior: 'always_invoice',
      metadata: { ...sub.metadata, plano },
    });
    await sincronizarSubscricao(sub.id);
    return redirecionar('/planos?mudou=1');
  } catch (e) {
    console.error('stripe mudar', e);
    return redirecionar('/planos?erro=stripe');
  }
}
