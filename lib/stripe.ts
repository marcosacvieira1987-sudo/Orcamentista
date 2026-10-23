import 'server-only';
import Stripe from 'stripe';
import { chavePreco, lerChavePreco, ORDEM, PLANOS, type Periodo, type PlanoId, type Tarifa } from './planos';
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

// ---------- preços, IVA e portal (procurados no Stripe e guardados 5 minutos) ----------

const cache = new Map<string, { v: string; ate: number }>();
async function emCache(k: string, f: () => Promise<string>) {
  const c = cache.get(k);
  if (c && c.ate > Date.now()) return c.v;
  const v = await f();
  if (v) cache.set(k, { v, ate: Date.now() + 5 * 60000 });
  return v;
}

// Cada preço tem uma chave de pesquisa (ex.: prumo_pro_anual_lancamento): não há IDs para copiar.
export const idPreco = (p: PlanoId, per: Periodo, t: Tarifa) => emCache('preco:' + chavePreco(p, per, t), async () => {
  const r = await stripe().prices.list({ lookup_keys: [chavePreco(p, per, t)], active: true, limit: 1 });
  return r.data[0]?.id || '';
});

// IVA a 23 %: STRIPE_TAXA_IVA, ou a taxa criada pela configuração automática.
export const taxaIva = () => emCache('iva', async () => {
  if (process.env.STRIPE_TAXA_IVA) return process.env.STRIPE_TAXA_IVA;
  const r = await stripe().taxRates.list({ active: true, limit: 100 });
  return r.data.find((t) => t.metadata?.prumo === 'iva')?.id || '';
});

export const configuracaoPortal = () => emCache('portal', async () => {
  const r = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  return r.data.find((c) => c.metadata?.prumo === 'portal')?.id || '';
});

// ---------- sincronização ----------

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
  const { data: atual } = await admin.from('assinaturas').select('stripe_subscription, primeira_compra').eq('user_id', userId).maybeSingle();
  const terminou = ['canceled', 'incomplete_expired'].includes(sub.status);
  if (terminou && atual?.stripe_subscription && atual.stripe_subscription !== sub.id) return;

  const item = sub.items.data[0];
  const preco = lerChavePreco(item?.price?.lookup_key);
  const ativa = ['active', 'trialing', 'past_due'].includes(sub.status);
  const { error } = await admin.from('assinaturas').upsert({
    user_id: userId,
    plano: preco?.plano || null,
    periodo: preco?.periodo || null,
    lancamento: preco?.tarifa === 'lancamento',
    estado: sub.status,
    periodo_fim: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancela_no_fim: !!(sub.cancel_at_period_end || sub.cancel_at),
    stripe_customer: customer,
    stripe_subscription: sub.id,
    // garantia de 30 dias: conta a partir da primeira compra da conta, e só dessa
    primeira_compra: atual?.primeira_compra || (ativa ? new Date((sub.start_date || Date.now() / 1000) * 1000).toISOString() : null),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ---------- configuração automática (botão na página Plano, só para administradores) ----------

const EVENTOS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed',
];

export type Verificacao = { modo: 'teste' | 'real'; precos: { chave: string; ok: boolean }[]; iva: boolean; portal: boolean; webhook: boolean };

export async function verificarStripe(origem: string): Promise<Verificacao> {
  const s = stripe();
  const chaves = ORDEM.flatMap((p) => (['mensal', 'anual'] as const).flatMap((per) => (['normal', 'lancamento'] as const).map((t) => chavePreco(p, per, t))));
  const encontrados = new Set<string>();
  for (let i = 0; i < chaves.length; i += 10) {
    const r = await s.prices.list({ lookup_keys: chaves.slice(i, i + 10), active: true, limit: 10 });
    r.data.forEach((x) => x.lookup_key && encontrados.add(x.lookup_key));
  }
  const ganchos = await s.webhookEndpoints.list({ limit: 100 });
  cache.clear();
  return {
    modo: (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'real' : 'teste',
    precos: chaves.map((chave) => ({ chave, ok: encontrados.has(chave) })),
    iva: !!(await taxaIva()),
    portal: !!(await configuracaoPortal()),
    webhook: ganchos.data.some((w) => w.url === `${origem}/api/pagamentos/webhook` && w.status === 'enabled'),
  };
}

// Cria o que faltar: 3 produtos, 12 preços (mensal/anual, normal/lançamento), IVA 23 %, portal e webhook.
// Pode correr várias vezes. Devolve o segredo do webhook quando o cria (só aparece nessa altura).
export async function configurarStripe(origem: string) {
  const s = stripe();
  const produtos = (await s.products.list({ active: true, limit: 100 })).data;
  for (const p of ORDEM) {
    const def = PLANOS[p];
    let prod = produtos.find((x) => x.metadata?.prumo_plano === p);
    if (!prod) prod = await s.products.create({ name: `Prumo ${def.nome}`, metadata: { prumo_plano: p } });
    for (const per of ['mensal', 'anual'] as const) {
      for (const t of ['normal', 'lancamento'] as const) {
        const chave = chavePreco(p, per, t);
        const valor = Math.round(def.precos[t][per] * 100);
        const atual = (await s.prices.list({ lookup_keys: [chave], active: true, limit: 1 })).data[0];
        if (atual && atual.unit_amount === valor && atual.product === prod.id) continue;
        // preço novo com a mesma chave: quem já subscreveu mantém o preço antigo
        await s.prices.create({
          product: prod.id, currency: 'eur', unit_amount: valor, tax_behavior: 'exclusive',
          recurring: { interval: per === 'anual' ? 'year' : 'month' },
          lookup_key: chave, transfer_lookup_key: true,
          nickname: `${def.nome} · ${per} · ${t === 'lancamento' ? 'lançamento' : 'normal'}`,
        });
      }
    }
  }
  if (!process.env.STRIPE_TAXA_IVA && !(await taxaIva())) {
    await s.taxRates.create({ display_name: 'IVA', description: 'IVA Portugal 23 %', percentage: 23, inclusive: false, country: 'PT', jurisdiction: 'PT', tax_type: 'vat', metadata: { prumo: 'iva' } });
  }
  if (!(await configuracaoPortal())) {
    await s.billingPortal.configurations.create({
      business_profile: { privacy_policy_url: `${origem}/privacidade`, terms_of_service_url: `${origem}/termos` },
      features: {
        customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address', 'tax_id'] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        // mudar de plano faz-se no app, para manter o preço de lançamento
        subscription_update: { enabled: false },
      },
      metadata: { prumo: 'portal' },
    });
  }
  let segredoWebhook = '';
  const url = `${origem}/api/pagamentos/webhook`;
  const ganchos = await s.webhookEndpoints.list({ limit: 100 });
  if (!ganchos.data.some((w) => w.url === url)) {
    const w = await s.webhookEndpoints.create({ url, enabled_events: EVENTOS, description: 'Prumo Orçamentista' });
    segredoWebhook = w.secret || '';
  }
  cache.clear();
  return { segredoWebhook };
}
