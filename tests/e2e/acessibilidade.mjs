// Auditoria de acessibilidade (axe-core, WCAG 2 A/AA e boas práticas) nas páginas principais.
import { chromium, devices } from 'playwright-core';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const B = process.env.BASE_URL || 'http://127.0.0.1:3000';
const axe = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "${q}"`).toString().trim();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
const p = await ctx.newPage();
const resumo = {};
async function auditar(nome) {
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] }));
  resumo[nome] = r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes[0]?.target?.join(' ') + ' :: ' + (v.nodes[0]?.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 220) }));
}
for (const [n, u] of [['inicio', '/'], ['registar', '/registar'], ['termos', '/termos']]) { await p.goto(B + u); await auditar(n); }
const email = `axe-${Date.now()}@teste.pt`;
await p.goto(B + '/registar');
await p.getByLabel('Nome da empresa').fill('Axe Obras'); await p.getByLabel('Email').fill(email); await p.getByLabel('Palavra-passe').fill('palavra-passe-1');
await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL('**/configuracao');
await auditar('empresa');
await p.goto(B + '/orcamentos'); await auditar('orcamentos');
await p.goto(B + '/planos'); await auditar('planos');
await p.getByRole('button', { name: 'Novo orçamento', exact: true }).first().click().catch(async () => { await p.goto(B + '/orcamentos'); await p.getByRole('button', { name: 'Novo orçamento', exact: true }).click(); });
await p.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/); await auditar('editor-pedido');
const tok = sql(`select token from propostas where dados ? 'orc' order by publicada_em desc limit 1`);
if (tok) {
const cli = await (await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' })).newPage();
await cli.goto(`${B}/p/${tok}`); await cli.waitForLoadState('networkidle'); await cli.addScriptTag({ content: axe });
const rc = await cli.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] }));
resumo['proposta-cliente'] = rc.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes[0]?.target?.join(' ') + ' :: ' + (v.nodes[0]?.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 220) }));
}
let total = 0;
for (const [k, v] of Object.entries(resumo)) { total += v.length; console.log(`${v.length ? 'FALHA' : 'OK   '} ${k}: ${v.length} problemas`); v.forEach((x) => console.log(`   [${x.impacto}] ${x.id} (${x.n}) ${x.exemplo}`)); }
console.log(total ? `${total} falha(s)` : 'Tudo certo.');
await browser.close();
