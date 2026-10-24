// Orçamento de exemplo (sem IA, não se envia, não conta nos primeiros passos) e dados estruturados do site.
import { chromium, devices } from 'playwright-core';
const SP = process.argv[2] || 'tests/e2e/saida', B = process.env.BASE_URL || 'http://127.0.0.1:3000';
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT', acceptDownloads: true });
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));

const html = await (await fetch(B + '/')).text();
const ld = JSON.parse((html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/) || [])[1] || '{}');
ok(ld['@type'] === 'SoftwareApplication' && ld.offers?.map((o) => o.price).join('|') === '29|59|180', 'dados estruturados com os 3 planos e preços normais');

await p.goto(B + '/registar');
await p.getByLabel('Nome da empresa').fill('Exemplo Obras'); await p.getByLabel('Email').fill(`exemplo-${Date.now()}@teste.pt`); await p.getByLabel('Palavra-passe').fill('palavra-passe-1');
await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL('**/configuracao');
await p.goto(B + '/orcamentos');
await p.getByRole('button', { name: /orçamento de exemplo/ }).click();
await p.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/); const url = p.url();
await p.getByText('Este é um orçamento de exemplo').waitFor();
ok(await p.getByRole('button', { name: /Enviar por WhatsApp/ }).count() === 0, 'exemplo: sem envio ao cliente');
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Descarregar PDF/ }).click()]);
ok(/Exemplo|EXEMPLO/.test(dl.suggestedFilename()), `exemplo: PDF gerado sem IA (${dl.suggestedFilename()})`);
await p.goto(B + '/orcamentos');
ok((await p.locator('.cartao .estado').first().innerText()).toLowerCase() === 'exemplo', 'lista: cartão marcado como Exemplo');
ok(await p.locator('.passos-ini li.ok', { hasText: 'O primeiro orçamento' }).count() === 0, 'exemplo não conta como primeiro orçamento');
ok(await p.locator('.resumo-30').count() === 0, 'exemplo não entra no resumo de 30 dias');
await p.evaluate(() => { const f = document.createElement('form'); f.method = 'post'; f.action = '/orcamentos/exemplo'; document.body.appendChild(f); f.submit(); });
await p.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/);
ok(p.url() === url, 'um só exemplo por conta (abre o mesmo)');
console.log(erros.length ? erros : 'Sem erros nas páginas.'); console.log(falhas ? `${falhas} falha(s)` : 'Tudo certo.');
await browser.close();
