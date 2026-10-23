import { NextResponse } from 'next/server';
import { origemDoPedido, redirecionar } from '@/lib/redirecionar';
import { ESTADOS_ATIVOS, type PlanoId } from '@/lib/plano';
import { precoDoPlano, stripe, stripeConfigurado } from '@/lib/stripe';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Abre a página de pagamento do Stripe para subscrever um plano.
export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const form = await req.formData();
  const plano = form.get('plano') as PlanoId;
  if (plano !== 'pro' && plano !== 'premium') return redirecionar('/planos');
  const preco = precoDoPlano(plano);
  if (!stripeConfigurado() || !preco) return redirecionar('/planos?erro=config');

  const admin = supabaseAdmin();
  const [{ data: ass }, { data: emp }] = await Promise.all([
    admin.from('assinaturas').select('stripe_customer, estado').eq('user_id', u.id).maybeSingle(),
    u.sb.from('empresas').select('nome').maybeSingle(),
  ]);
  // já tem subscrição: mudar de plano e cancelar faz-se no portal do Stripe, sem pagar duas vezes
  if (ass?.stripe_customer && ESTADOS_ATIVOS.includes(String(ass.estado))) return redirecionar('/planos?erro=ja-subscrito');

  try {
    let customer = ass?.stripe_customer || '';
    if (!customer) {
      const c = await stripe().customers.create({ email: u.email, name: emp?.nome || undefined, preferred_locales: ['pt'], metadata: { user_id: u.id } });
      customer = c.id;
      const { error } = await admin.from('assinaturas').upsert({ user_id: u.id, stripe_customer: customer }, { onConflict: 'user_id' });
      if (error) throw error;
    }
    const origem = origemDoPedido(req);
    const taxa = process.env.STRIPE_TAXA_IVA;
    const sessao = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: u.id,
      line_items: [{ price: preco, quantity: 1, ...(taxa ? { tax_rates: [taxa] } : {}) }],
      subscription_data: { metadata: { user_id: u.id, plano } },
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
