import 'server-only';
import Stripe from 'stripe';
import type { PlanoId } from './plano';
import { supabaseAdmin } from './supabase/server';

let cliente: Stripe | null = null;
export const stripeConfigurado = () => !!process.env.STRIPE_SECRET_KEY;

export function stripe() {
  if (cliente) return cliente;
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error('Falta STRIPE_SECRET_KEY');
  // STRIPE_API_BASE: só para testes locais com um servidor de imitação
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  cliente = new Stripe(chave, {
    maxNetworkRetries: 2,
    appInfo: { name: 'Prumo Orçamentista' },
    ...(base ? { host: base.hostname, port: base.port, protocol: base.protocol.replace(':', '') as 'http' | 'https' } : {}),
  });
  return cliente;
}

// Preços criados no painel do Stripe (um produto por plano, preço mensal sem IVA).
export const precoDoPlano = (p: PlanoId) => (p === 'pro' ? process.env.STRIPE_PRECO_PRO : process.env.STRIPE_PRECO_PREMIUM) || '';
export function planoDoPreco(preco?: string | null): PlanoId | null {
  if (!preco) return null;
  if (preco === process.env.STRIPE_PRECO_PREMIUM) return 'premium';
  if (preco === process.env.STRIPE_PRECO_PRO) return 'pro';
  return null;
}

// Copia o estado atual de uma subscrição do Stripe para a tabela assinaturas.
// Lê sempre a versão mais recente, por isso não importa a ordem em que os eventos chegam.
export async function sincronizarSubscricao(id: string) {
  const sub = await stripe().subscriptions.retrieve(id);
  const admin = supabaseAdmin();
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = sub.metadata?.user_id || '';
  if (!userId) {
    const { data } = await admin.from('assinaturas').select('user_id').eq('stripe_customer', customer).maybeSingle();
    userId = data?.user_id || '';
  }
  if (!userId) { console.warn('stripe: subscrição sem utilizador', sub.id); return; }

  // uma subscrição antiga que termina não apaga uma mais recente que esteja ativa
  const { data: atual } = await admin.from('assinaturas').select('stripe_subscription, estado').eq('user_id', userId).maybeSingle();
  const terminou = ['canceled', 'incomplete_expired'].includes(sub.status);
  if (terminou && atual?.stripe_subscription && atual.stripe_subscription !== sub.id) return;

  const item = sub.items.data[0];
  const { error } = await admin.from('assinaturas').upsert({
    user_id: userId,
    plano: planoDoPreco(item?.price?.id),
    estado: sub.status,
    periodo_fim: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancela_no_fim: !!(sub.cancel_at_period_end || sub.cancel_at),
    stripe_customer: customer,
    stripe_subscription: sub.id,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
