import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { sincronizarSubscricao, stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// Avisos do Stripe (pagamentos, renovações, mudanças de plano, cancelamentos).
// A assinatura do pedido é verificada: só o Stripe consegue alterar o plano de uma conta.
export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  const assinatura = req.headers.get('stripe-signature');
  if (!segredo || !assinatura) return NextResponse.json({ erro: 'sem assinatura' }, { status: 400 });
  let ev: Stripe.Event;
  try {
    ev = stripe().webhooks.constructEvent(await req.text(), assinatura, segredo);
  } catch {
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 400 });
  }
  try {
    switch (ev.type) {
      case 'checkout.session.completed': {
        const s = ev.data.object;
        if (s.mode === 'subscription' && s.subscription) await sincronizarSubscricao(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await sincronizarSubscricao(ev.data.object.id);
        break;
    }
  } catch (e) {
    // erro 500: o Stripe volta a tentar mais tarde
    console.error('stripe webhook', ev.type, e);
    return NextResponse.json({ erro: 'falhou' }, { status: 500 });
  }
  return NextResponse.json({ recebido: true });
}
