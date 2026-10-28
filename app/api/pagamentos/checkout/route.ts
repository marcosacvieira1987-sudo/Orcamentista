import { NextResponse } from 'next/server';
import { origemDoPedido, redirecionar } from '@/lib/redirecionar';
import { ESTADOS_ATIVOS } from '@/lib/plano';
import { ehBeta, ehPeriodo, ehPlano, lancamentoAberto } from '@/lib/planos';
import { idPreco, stripe, stripeConfigurado, taxaIva } from '@/lib/stripe';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Abre a página de pagamento do Stripe para subscrever um plano (mensal ou anual).
export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const form = await req.formData();
  const plano = form.get('plano'), periodo = form.get('periodo') || 'mensal';
  if (!ehPlano(plano) || !ehPeriodo(periodo)) return redirecionar('/planos');
  if (!stripeConfigurado()) return redirecionar('/planos?erro=config');

  const admin = supabaseAdmin();
  const [{ data: ass }, { data: emp }] = await Promise.all([
    admin.from('assinaturas').select('stripe_customer, stripe_subscription, estado, experimental_ate').eq('user_id', u.id).maybeSingle(),
    u.sb.from('empresas').select('nome').maybeSingle(),
  ]);
  // já tem subscrição: mudar de plano faz-se no app, sem pagar duas vezes
  if (ass?.stripe_customer && ESTADOS_ATIVOS.includes(String(ass.estado))) return redirecionar('/planos?erro=ja-subscrito');

  // preço de lançamento: dentro das datas, ou para a beta na primeira adesão (com o 1.º mês grátis)
  const beta = ehBeta(u.email) && !ass?.stripe_subscription;
  const tarifa = lancamentoAberto() || beta ? 'lancamento' : 'normal';
  // Quem subscreve durante os 14 dias grátis mantém os dias que faltam: a primeira cobrança é no fim.
  // (O Stripe pede pelo menos 48 h; com menos, cobra já.) A beta tem o 1.º mês grátis.
  const fimExp = ass?.experimental_ate ? Math.floor(new Date(ass.experimental_ate).getTime() / 1000) : 0;
  const gratis = beta ? { trial_period_days: 30 } : fimExp > Math.floor(Date.now() / 1000) + 49 * 3600 ? { trial_end: fimExp } : {};

  try {
    const [preco, taxa] = await Promise.all([idPreco(plano, periodo, tarifa), taxaIva()]);
    if (!preco) return redirecionar('/planos?erro=config');
    let customer = ass?.stripe_customer || '';
    if (!customer) {
      const c = await stripe().customers.create({ email: u.email, name: emp?.nome || undefined, preferred_locales: ['pt'], metadata: { user_id: u.id } });
      customer = c.id;
      const { error } = await admin.from('assinaturas').upsert({ user_id: u.id, stripe_customer: customer }, { onConflict: 'user_id' });
      if (error) throw error;
    }
    const origem = origemDoPedido(req);
    const sessao = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: u.id,
      line_items: [{ price: preco, quantity: 1, ...(taxa ? { tax_rates: [taxa] } : {}) }],
      subscription_data: { metadata: { user_id: u.id, plano }, ...gratis },
      // fatura em nome da empresa, com NIF e morada
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      ...(process.env.STRIPE_IVA_AUTOMATICO === '1' ? { automatic_tax: { enabled: true } } : {}),
      allow_promotion_codes: true,
      locale: 'pt',
      success_url: `${origem}/planos?sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origem}/planos`,
    });
    if (!sessao.url) throw new Error('sessão sem url');
    return NextResponse.redirect(sessao.url, 303);
  } catch (e) {
    console.error('stripe checkout', e);
    return redirecionar('/planos?erro=stripe');
  }
}
