import { NextResponse } from 'next/server';
import { origemDoPedido, redirecionar } from '@/lib/redirecionar';
import { stripe, stripeConfigurado } from '@/lib/stripe';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Portal do cliente do Stripe: mudar de plano, cartão, faturas, cancelar.
export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const { data } = await u.sb.from('assinaturas').select('stripe_customer').eq('user_id', u.id).maybeSingle();
  if (!stripeConfigurado() || !data?.stripe_customer) return redirecionar('/planos');
  try {
    const s = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer, return_url: `${origemDoPedido(req)}/planos`, locale: 'pt' });
    return NextResponse.redirect(s.url, 303);
  } catch (e) {
    console.error('stripe portal', e);
    return redirecionar('/planos?erro=stripe');
  }
}
