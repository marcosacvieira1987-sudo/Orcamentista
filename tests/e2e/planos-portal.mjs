import { chromium, devices } from 'playwright-core';
import { execSync } from 'node:child_process';
const fase = process.argv[2] || 'normal', SP = process.argv[3] || 'tests/e2e/saida', B = process.env.BASE_URL || 'http://127.0.0.1:3000', M = 'http://127.0.0.1:12111';
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "${q}"`).toString().trim();
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
const visivel = (l) => l.waitFor({ timeout: 10000 }).then(() => true, () => false);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' }); const p = await ctx.newPage();
const email = `p2-${Date.now()}@teste.pt`;
await p.goto(B + '/registar');
await p.getByLabel('Nome da empresa').fill('Teste Lda'); await p.getByLabel('Email').fill(email); await p.getByLabel('Palavra-passe').fill('palavra-passe-1');
await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL('**/configuracao');
const uid = sql(`select id from auth.users where email='${email}'`);
if (fase === 'normal') {
  await p.goto(B + '/planos'); await p.getByRole('button', { name: 'Subscrever o Pro' }).click(); await p.waitForURL('**/planos?sessao=*');
  ok((await p.locator('.plano-sit strong').first().innerText()) === 'Plano Pro mensal ativo', 'Pro mensal ativo durante a experiência');
  await p.getByRole('button', { name: /Passar a anual/ }).click(); await p.waitForURL('**/planos?mudou=1');
  ok(sql(`select plano||'/'||periodo from assinaturas where user_id='${uid}'`) === 'pro/anual', 'passou a anual');
  await p.getByRole('button', { name: /Pagamento, faturas/ }).click(); await p.waitForURL(M + '/portal*');
  ok(/conf=bpc_/.test(p.url()), 'portal abre com a configuração do Prumo');
  const sub = sql(`select stripe_subscription from assinaturas where user_id='${uid}'`);
  await p.goto(B + '/configuracao'); p.on('dialog', (d) => d.accept('APAGAR'));
  await p.getByRole('button', { name: 'Apagar conta' }).click(); await p.waitForTimeout(3000);
  ok((await (await fetch(M + '/teste/log')).json()).includes(`DELETE /v1/subscriptions/${sub}`), 'apagar conta cancela a subscrição');
} else {
  await p.goto(B + '/planos');
  ok(await visivel(p.getByText('Preço de lançamento', { exact: true })), 'janela aberta: aviso de preço de lançamento');
  ok((await p.locator('.plano-preco strong').allInnerTexts()).join('|') === '19 €|39 €|119 €', 'janela aberta: preços de lançamento para todos');
  await p.getByRole('button', { name: 'Subscrever o Premium' }).click(); await p.waitForURL('**/planos?sessao=*');
  ok(sql(`select plano||'/'||lancamento||'/'||estado from assinaturas where user_id='${uid}'`) === 'premium/true/active', 'compra na janela: lançamento, sem mês grátis');
  ok((await p.locator('.plano-sit').innerText()).includes('preço de lançamento enquanto não cancelar'), 'mensagem: mantém o preço');
  const L = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await L.goto(B + '/#planos');
  ok((await L.locator('.lp-preco strong').allInnerTexts()).join('|') === '19 €|39 €|119 €' && await visivel(L.locator('.lp-lanc')), 'landing: preços de lançamento e aviso');
  await L.locator('#planos').screenshot({ path: `${SP}/pl-landing-lanc.png` });
}
console.log(falhas ? `${falhas} falha(s)` : 'Tudo certo.'); await browser.close();
