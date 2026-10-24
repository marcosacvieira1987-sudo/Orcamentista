// Imitação da API do Stripe para testes locais (produtos, preços por chave, IVA, portal, webhook, checkout, subscrições).
import http from 'node:http';
const db = { produtos: [], precos: [], taxas: [], portais: [], ganchos: [], sessoes: {}, subs: {} };
const log = [];
let n = Date.now();
const novoId = (p) => `${p}_${++n}`;
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const corpo = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(Object.fromEntries(new URLSearchParams(b)))); });
const lista = (data) => ({ object: 'list', data, has_more: false });
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, b = await corpo(req), q = u.searchParams, M = req.method;
  log.push(`${M} ${p}`);
  if (p === '/teste/log') return json(res, 200, log);
  if (p === '/teste/sub') { const s = db.subs[q.get('id')]; if (!s) return json(res, 404, {}); if (q.get('status')) s.status = q.get('status'); return json(res, 200, s); }
  if (p === '/v1/products') {
    if (M === 'GET') return json(res, 200, lista(db.produtos));
    const x = { id: novoId('prod'), object: 'product', name: b.name, active: true, metadata: { prumo_plano: b['metadata[prumo_plano]'] } }; db.produtos.push(x); return json(res, 200, x);
  }
  if (p === '/v1/prices') {
    if (M === 'GET') { const ks = [...q.entries()].filter(([k]) => k.startsWith('lookup_keys')).map(([, v]) => v); return json(res, 200, lista(db.precos.filter((x) => x.active && ks.includes(x.lookup_key)))); }
    if (b.transfer_lookup_key === 'true') db.precos.forEach((x) => { if (x.lookup_key === b.lookup_key) x.lookup_key = null; });
    const x = { id: novoId('price'), object: 'price', active: true, product: b.product, unit_amount: Number(b.unit_amount), currency: b.currency, lookup_key: b.lookup_key, recurring: { interval: b['recurring[interval]'] } };
    db.precos.push(x); return json(res, 200, x);
  }
  if (p === '/v1/tax_rates') {
    if (M === 'GET') return json(res, 200, lista(db.taxas));
    const x = { id: novoId('txr'), object: 'tax_rate', active: true, percentage: Number(b.percentage), metadata: { prumo: b['metadata[prumo]'] } }; db.taxas.push(x); return json(res, 200, x);
  }
  if (p === '/v1/billing_portal/configurations') {
    if (M === 'GET') return json(res, 200, lista(db.portais));
    const x = { id: novoId('bpc'), object: 'billing_portal.configuration', active: true, metadata: { prumo: b['metadata[prumo]'] } }; db.portais.push(x); return json(res, 200, x);
  }
  if (p === '/v1/webhook_endpoints') {
    if (M === 'GET') return json(res, 200, lista(db.ganchos));
    const x = { id: novoId('we'), object: 'webhook_endpoint', url: b.url, status: 'enabled', secret: 'whsec_teste' }; db.ganchos.push(x); return json(res, 200, x);
  }
  if (M === 'POST' && p === '/v1/customers') return json(res, 200, { id: novoId('cus'), object: 'customer', email: b.email, metadata: { user_id: b['metadata[user_id]'] } });
  if (M === 'POST' && p === '/v1/checkout/sessions') {
    const id = novoId('cs_test');
    db.sessoes[id] = { id, object: 'checkout.session', mode: 'subscription', status: 'open', customer: b.customer, client_reference_id: b.client_reference_id, url: `http://127.0.0.1:12111/pagar/${id}`, subscription: null, _b: b };
    return json(res, 200, db.sessoes[id]);
  }
  if (p.startsWith('/pagar/')) {
    const s = db.sessoes[p.split('/')[2]], sid = novoId('sub');
    const preco = db.precos.find((x) => x.id === s._b['line_items[0][price]']);
    const trial = Number(s._b['subscription_data[trial_period_days]'] || 0);
    db.subs[sid] = { id: sid, object: 'subscription', status: trial ? 'trialing' : 'active', customer: s.customer, cancel_at_period_end: false, cancel_at: null, start_date: Math.floor(Date.now() / 1000),
      metadata: { user_id: s._b['subscription_data[metadata][user_id]'] }, _taxa: s._b['line_items[0][tax_rates][0]'], _trial: trial,
      items: { data: [{ id: novoId('si'), price: preco, current_period_end: Math.floor(Date.now() / 1000) + (trial || 30) * 86400 }] } };
    s.status = 'complete'; s.subscription = sid;
    res.writeHead(303, { location: s._b.success_url.replace('{CHECKOUT_SESSION_ID}', s.id) }); return res.end();
  }
  if (M === 'GET' && p.startsWith('/v1/checkout/sessions/')) return json(res, 200, db.sessoes[p.split('/')[4]]);
  if (p.startsWith('/v1/subscriptions/')) {
    const s = db.subs[p.split('/')[3]]; if (!s) return json(res, 404, { error: { message: 'no such subscription', type: 'invalid_request_error' } });
    if (M === 'DELETE') s.status = 'canceled';
    if (M === 'POST' && b['items[0][price]']) { s.items.data[0].price = db.precos.find((x) => x.id === b['items[0][price]']); s._proration = b.proration_behavior; }
    return json(res, 200, s);
  }
  if (M === 'POST' && p === '/v1/billing_portal/sessions') return json(res, 200, { id: 'bps_1', object: 'billing_portal.session', url: 'http://127.0.0.1:12111/portal?c=' + b.customer + '&conf=' + (b.configuration || '') });
  if (p === '/portal') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Portal Stripe</h1>'); }
  json(res, 404, { error: { message: 'mock: ' + M + ' ' + p, type: 'invalid_request_error' } });
}).listen(12111, '127.0.0.1', () => console.log('mock stripe 12111'));
