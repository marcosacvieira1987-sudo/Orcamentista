// Planos, limites mensais, lançamento/beta e administração do Stripe (contra a imitação do Stripe).
import { chromium, devices } from 'playwright-core';
import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';
const SP = process.argv[2] || 'tests/e2e/saida', B = process.env.BASE_URL || 'http://127.0.0.1:3000', M = 'http://127.0.0.1:12111';
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "${q}"`).toString().trim();
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
const visivel = (l) => l.waitFor({ timeout: 10000 }).then(() => true, () => false);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const erros = [];
sql(`delete from auth.users where email in ('admin@prumo.teste','beta@prumo.teste')`);

async function conta(email, nome) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(B + '/registar');
  await p.getByLabel('Nome da empresa').fill(nome); await p.getByLabel('Email').fill(email); await p.getByLabel('Palavra-passe').fill('palavra-passe-1');
  await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL('**/configuracao');
  return { p, uid: sql(`select id from auth.users where email='${email}'`) };
}
const ia = (p, corpo) => p.evaluate(async (c) => { const r = await fetch('/api/ia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) }); return [r.status, (await r.json()).code]; }, corpo);
const ctxIA = { pedido: { tipo: 'wc', descricao: 'casa de banho', localidade: 'Lisboa', dono: '', notas: '' }, leitura: null, respostas: {}, medidas: [] };
const novoOrc = (uid) => sql(`insert into orcamentos (user_id, dados) values ('${uid}', '{}') returning id`).split('\n')[0];
const shot = (p, n) => p.screenshot({ path: `${SP}/pl-${n}.png`, fullPage: true });

// ---------- A. administração do Stripe ----------
const A = await conta('admin@prumo.teste', 'Prumo Admin');
await A.p.goto(B + '/planos');
await A.p.getByText('Administração do Stripe').waitFor();
await A.p.getByText(/Preços: 0 de 12/).waitFor();
ok(true, 'admin vê a administração do Stripe (0 de 12 preços)');
await A.p.getByRole('button', { name: 'Criar o que falta no Stripe' }).click();
await A.p.getByText('Webhook criado').waitFor();
ok((await A.p.locator('.segredo').innerText()) === 'whsec_teste', 'segredo do webhook mostrado uma vez');
ok(await visivel(A.p.getByText('Preços: 12 de 12')), '12 preços criados com as chaves');
ok((await A.p.locator('.admin-stripe li').allInnerTexts()).every((t) => t.startsWith('✓')), 'IVA, portal e webhook criados');
await A.p.reload(); await A.p.getByText('Preços: 12 de 12').waitFor();
ok(await A.p.getByRole('button', { name: 'Criar o que falta no Stripe' }).count() === 0, 'com tudo feito, o botão desaparece');
const r403 = await (await fetch(B + '/api/pagamentos/configurar')).status;
ok(r403 === 403, 'sem sessão de admin: proibido');
await shot(A.p, 'admin');

// ---------- B. experiência e limite mensal ----------
const U = await conta(`plano-${Date.now()}@teste.pt`, 'Obras Silva');
await U.p.goto(B + '/planos');
ok((await U.p.locator('.plano-sit').innerText()).includes('até 6 orçamentos com IA'), 'experiência: funções Premium com limite 6');
ok((await U.p.locator('.plano-app').count()) === 3, 'três planos na página');
ok((await U.p.locator('.plano-app.destaque h2').innerText()) === 'Pro' && (await U.p.locator('.plano-app.destaque .estado').innerText()).toLowerCase().includes('mais popular'), 'selo "Mais popular" no Pro');
const precosM = await U.p.locator('.plano-preco strong').allInnerTexts();
ok(precosM.join('|') === '29 €|59 €|180 €', `preços normais mensais (${precosM.join(', ')})`);
await U.p.goto(B + '/planos?periodo=anual');
const precosA = await U.p.locator('.plano-preco strong').allInnerTexts();
ok(precosA.join('|') === '290 €|590 €|1.800 €', `preços normais anuais (${precosA.join(', ')})`);
await shot(U.p, 'experimental-anual');

const usados = Array.from({ length: 6 }, () => novoOrc(U.uid));
for (const o of usados) sql(`insert into uso_ia (user_id, acao, orcamento_id, tokens_in, tokens_out, custo_usd) values ('${U.uid}', 'orcamento', '${o}', 1000, 500, 0.05)`);
// pedido que falhou (tokens 0) não conta
const falhado = novoOrc(U.uid); sql(`insert into uso_ia (user_id, acao, orcamento_id, tokens_in) values ('${U.uid}', 'orcamento', '${falhado}', 0)`);
await U.p.goto(B + '/orcamentos');
ok(await visivel(U.p.getByText('Usou os 6 orçamentos com IA deste mês')), 'lista: aviso de limite atingido');
ok((await U.p.locator('.r-ia strong').innerText()).replace(/\s+/g, ' ') === '6 de 6', 'lista: contador 6 de 6');
await shot(U.p, 'limite');
const novo = novoOrc(U.uid);
ok((await ia(U.p, { acao: 'perguntas', ctx: ctxIA, orcamentoId: novo }))[1] === 'limite_mensal', 'orçamento novo bloqueado (limite_mensal)');
ok((await ia(U.p, { acao: 'perguntas', ctx: ctxIA, orcamentoId: usados[0] }))[0] === 200, 'orçamento já contado continua a funcionar');
ok((await ia(U.p, { acao: 'perguntas', ctx: ctxIA }))[0] === 400, 'pedido sem orçamento recusado');
const alheio = novoOrc(A.uid);
ok((await ia(U.p, { acao: 'perguntas', ctx: ctxIA, orcamentoId: alheio }))[0] === 400, 'orçamento de outra conta recusado');

// ---------- C. subscrever Essencial anual ----------
sql(`update assinaturas set experimental_ate = now() - interval '1 day' where user_id='${U.uid}'`);
await U.p.goto(B + '/planos?periodo=anual');
await U.p.getByRole('button', { name: 'Subscrever o Essencial' }).click();
await U.p.waitForURL('**/planos?sessao=*');
ok((await U.p.locator('.plano-sit strong').first().innerText()) === 'Plano Essencial anual ativo', 'Essencial anual ativo');
ok(sql(`select plano||'/'||periodo||'/'||lancamento||'/'||(primeira_compra is not null) from assinaturas where user_id='${U.uid}'`) === 'essencial/anual/false/true', 'BD: essencial/anual/normal, primeira compra registada');
ok((await U.p.locator('.plano-sit').innerText()).includes('6 de 6'), 'contador do mês mantém-se ao subscrever');
ok((await U.p.locator('.plano-sit').innerText()).includes('Garantia de 30 dias até'), 'garantia de 30 dias visível');
ok((await ia(U.p, { acao: 'orcamento', ctx: ctxIA, orcamentoId: usados[1], modelo: 'completo' }))[1] === 'so_premium', 'Essencial: proposta completa recusada');
const log1 = await (await fetch(M + '/teste/log')).json();
ok(log1.some((l) => l === 'POST /v1/checkout/sessions'), 'checkout criado com preço por chave');

// ---------- D. mudar para Premium ----------
await U.p.getByRole('button', { name: 'Mudar para o Premium' }).click();
await U.p.waitForURL('**/planos?mudou=1');
ok(sql(`select plano||'/'||periodo from assinaturas where user_id='${U.uid}'`) === 'premium/anual', 'mudou para Premium anual');
ok((await U.p.locator('.plano-sit').innerText()).includes('6 de 36'), 'contador passa a 6 de 36');
ok((await ia(U.p, { acao: 'perguntas', ctx: ctxIA, orcamentoId: novo }))[0] === 200, 'Premium: orçamento novo volta a funcionar');
await shot(U.p, 'premium');

// ---------- E. beta: lançamento + 1.º mês grátis, tarifa mantém-se ao mudar ----------
const Bt = await conta('beta@prumo.teste', 'Beta Obras');
await Bt.p.goto(B + '/planos');
ok(await visivel(Bt.p.getByText('Preço de lançamento para colegas da beta')), 'beta: aviso de preço de lançamento');
const precosB = await Bt.p.locator('.plano-preco strong').allInnerTexts();
ok(precosB.join('|') === '19 €|39 €|119 €', `beta: preços de lançamento (${precosB.join(', ')})`);
ok((await Bt.p.locator('.plano-nota').nth(1).innerText()).includes('Preço normal: 59 €'), 'mostra o preço normal como referência');
await shot(Bt.p, 'beta');
await Bt.p.getByRole('button', { name: 'Começar o Pro com 1 mês grátis' }).click();
await Bt.p.waitForURL('**/planos?sessao=*');
ok((await Bt.p.locator('.plano-sit strong').first().innerText()) === 'Plano Pro mensal ativo' && (await Bt.p.locator('.plano-sit').innerText()).includes('Grátis até'), 'beta: Pro com 1.º mês grátis (trialing)');
ok(sql(`select plano||'/'||lancamento||'/'||estado from assinaturas where user_id='${Bt.uid}'`) === 'pro/true/trialing', 'BD: pro, lançamento, trialing');
await Bt.p.getByRole('button', { name: 'Mudar para o Premium' }).click();
await Bt.p.waitForURL('**/planos?mudou=1');
const sub = sql(`select stripe_subscription from assinaturas where user_id='${Bt.uid}'`);
const s = await (await fetch(`${M}/teste/sub?id=${sub}`)).json();
ok(s.items.data[0].price.lookup_key === 'prumo_premium_mensal_lancamento', 'ao mudar de plano mantém o preço de lançamento');
ok(s._proration === 'always_invoice', 'diferença acertada na hora');

// ---------- F. landing e webhook ----------
const ctxL = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const L = await ctxL.newPage();
await L.goto(B + '/#planos');
ok((await L.locator('.lp-plano').count()) === 3 && (await L.locator('.lp-plano-top h3').innerText()) === 'Pro', 'landing: 3 planos, Pro em destaque');
ok((await L.locator('.lp-preco strong').allInnerTexts()).join('|') === '29 €|59 €|180 €', 'landing: preços normais fora do lançamento');
await L.locator('#planos').screenshot({ path: `${SP}/pl-landing.png` });
const corpo = JSON.stringify({ id: 'evt_1', object: 'event', type: 'customer.subscription.updated', data: { object: { id: sub } } });
const t = Math.floor(Date.now() / 1000), sig = createHmac('sha256', 'whsec_teste').update(`${t}.${corpo}`).digest('hex');
ok((await fetch(B + '/api/pagamentos/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body: corpo })).status === 200, 'webhook assinado aceite');

console.log(erros.length ? erros : 'Sem erros nas páginas.'); console.log(falhas ? `${falhas} falha(s)` : 'Tudo certo.');
await browser.close();
