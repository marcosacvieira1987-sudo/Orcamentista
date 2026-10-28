// Fase 3: marca (cores do logótipo, modelos, textos pela IA), página da proposta e "Aceitar proposta".
import { chromium, devices } from 'playwright-core';
import { execSync } from 'node:child_process';
const SP = process.argv[2] || 'tests/e2e/saida', IMG = new URL('./fixtures', import.meta.url).pathname, B = process.env.BASE_URL || 'http://127.0.0.1:3000';
const sql = (q) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
const visivel = (l) => l.waitFor({ timeout: 10000 }).then(() => true, () => false);
const shot = (p, n, full = true) => p.screenshot({ path: `${SP}/m-${n}.png`, fullPage: full });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const erros = [];
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }));
const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
p.on('dialog', (d) => d.accept());
const email = `marca-${Date.now()}@teste.pt`;
await p.goto(B + '/registar');
await p.getByLabel('Nome da empresa').fill('Bronze Obras'); await p.getByLabel('Email').fill(email); await p.getByLabel('Palavra-passe').fill('palavra-passe-1');
await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL('**/configuracao');
const uid = sql(`select id from auth.users where email='${email}'`);

// ---- 1. a sua marca ----
await p.getByLabel('Telefone', { exact: true }).fill('912 000 111');
await p.getByLabel('Garantia', { exact: true }).fill('3 anos');
await p.locator('input[type=file]').setInputFiles(`${IMG}/logo.png`);
await p.getByText('Cores tiradas do logótipo').waitFor();
const chips = await p.locator('.pal-chip').count();
ok(chips >= 2, `paleta tirada do logótipo (${chips} cores)`);
const corP = await p.locator('.cor-tile input[type=color]').inputValue();
ok(corP.toLowerCase() !== '#1f3f8f', `cor principal sugerida a partir do logótipo (${corP})`);
await p.getByRole('radio', { name: /Moderno/ }).click();
await p.getByRole('button', { name: 'Usar os textos do modelo Moderno' }).click();
ok((await p.getByLabel('Sobre a empresa').inputValue()).startsWith('Remodelações'), 'textos do modelo Moderno aplicados');
await p.getByText('Questionário para os textos').click();
await p.getByLabel('Onde trabalha?').fill('Lisboa');
await p.getByLabel('Há quanto tempo trabalha na área?').fill('15');
await p.getByRole('button', { name: 'Escrever os textos com a IA' }).click();
await p.getByText('Textos escritos pela IA').waitFor();
ok((await p.getByLabel('Sobre a empresa').inputValue()).includes('há 15 anos'), 'IA escreveu a apresentação');
ok((await p.locator('.questionario').innerText()).includes('1 de 3 este mês'), 'contador de textos: 1 de 3');
await p.getByRole('button', { name: 'Guardar', exact: true }).click();
await p.getByText('Configuração guardada.').waitFor();
ok(sql(`select estilo||'|'||(apresentacao like 'Fazemos%')||'|'||(questionario->>'zona')||'|'||(cor2<>'') from empresas where user_id='${uid}'`) === 'moderno|true|Lisboa|true', 'guardado: estilo, textos, questionário e cor secundária');
await shot(p, 'empresa');
for (let i = 0; i < 2; i++) sql(`insert into uso_ia (user_id, acao, tokens_in) values ('${uid}', 'textos', 100)`);
const r3 = await p.evaluate(async () => (await fetch('/api/textos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"questionario":{}}' })).json());
ok(r3.code === 'limite_textos', 'textos pela IA: limite mensal (3 na experiência)');

// ---- 2. marca no app ----
await p.goto(B + '/orcamentos');
ok(await p.locator('header.top img').count() === 1, 'logótipo no topo do app');
const accent = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
ok(accent && accent.toUpperCase() !== '#1F3F8F', `cor da marca no app (${accent})`);

// ---- 3. orçamento e envio pela página da proposta ----
await p.getByRole('button', { name: 'Novo orçamento', exact: true }).click(); await p.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/);
const orcId = p.url().split('/').pop();
await p.getByRole('radio', { name: 'Remodelação geral' }).click();
await p.getByLabel('Localidade').fill('Lisboa'); await p.getByLabel('Dono de obra').fill('Maria Fernandes');
await p.locator('input[type=file]').setInputFiles([1, 2, 3].map((i) => `${IMG}/foto-${i}.jpg`));
await p.locator('.thumb img').nth(2).waitFor();
await p.getByRole('button', { name: /Ler as fotos/ }).click(); await p.getByRole('heading', { name: 'O que a IA vê' }).waitFor();
await p.getByRole('button', { name: /Está certo, continuar/ }).click(); await p.getByRole('heading', { name: 'Só o que falta' }).waitFor();
await p.getByRole('button', { name: /Continuar para as medidas/ }).click(); await p.getByRole('heading', { name: 'Medidas' }).waitFor();
await p.getByRole('button', { name: /Montar orçamento/ }).click(); await p.getByRole('heading', { name: 'Apresentação ao cliente' }).waitFor();
while (await p.locator('.pc').count()) await p.getByRole('button', { name: /^Confirmar / }).first().click();
await p.getByLabel('Revi quantidades e preços').check();
await p.getByRole('button', { name: 'Aprovar e gerar PDF' }).click(); await p.getByRole('heading', { name: 'Proposta pronta' }).waitFor();
await p.getByLabel('Telemóvel', { exact: true }).fill('912 345 678');
const [pop] = await Promise.all([p.waitForEvent('popup'), p.getByRole('button', { name: /Enviar por WhatsApp/ }).click()]);
await pop.waitForURL(/wa\.me/, { timeout: 30000 }); const wa = pop.url(); await pop.close();
const txt = decodeURIComponent((wa.split('text=')[1] || '').replace(/\+/g, ' '));
const link = (txt.match(/https?:\/\/\S+/) || [])[0] || '';
ok(/\/p\/[0-9a-f]{48}$/.test(link) && txt.includes('aceitá-la aqui'), 'WhatsApp leva o link da página da proposta');
await p.getByText('Ainda não foi aberta pelo cliente.').waitFor();
ok(true, 'editor: página publicada, ainda não aberta');
await p.goto(link); // o próprio profissional não conta como visita
await p.waitForTimeout(2500);
ok(sql(`select vistas from propostas where orcamento_id='${orcId}'`) === '0', 'visita do profissional não conta');

// ---- 4. o cliente abre e aceita ----
const cli = await (await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' })).newPage();
cli.on('pageerror', (e) => erros.push('cliente: ' + e.message));
await cli.goto(link);
ok(await cli.locator('.pc.pc-moderno').count() === 1, 'página com o estilo Moderno');
ok(await cli.locator('.pc-marca img').count() === 1, 'página com o logótipo da empresa');
ok((await cli.locator('.pc-sobre').innerText()).includes('há 15 anos'), 'página com "Sobre a empresa"');
const pdfHref = await cli.locator('a', { hasText: 'Descarregar PDF' }).getAttribute('href');
const rp = await fetch(pdfHref); const buf = Buffer.from(await rp.arrayBuffer());
ok(rp.ok && buf.slice(0, 5).toString() === '%PDF-', 'PDF descarrega a partir da página');
await cli.waitForTimeout(2500);
ok(sql(`select vistas from propostas where orcamento_id='${orcId}'`) === '1', 'visita do cliente registada (no browser)');
const tokV = link.split('/').pop();
await fetch(link, { headers: { 'user-agent': 'WhatsApp/2.24.1 A' } });
await fetch(`${B}/p/${tokV}/vista`, { method: 'POST', headers: { 'user-agent': 'facebookexternalhit/1.1' } });
ok(sql(`select vistas from propostas where orcamento_id='${orcId}'`) === '1', 'pré-visualização do WhatsApp e robôs não contam como visita');
const og = await (await fetch(link)).text();
ok(/property="og:title" content="Proposta/.test(og) && !/€/.test((og.match(/og:description" content="([^"]*)"/) || [])[1] || ''), 'pré-visualização do link com título e sem valores');
await shot(cli, 'cliente');
await cli.getByRole('link', { name: 'Aceitar proposta' }).click();
await cli.getByLabel('O seu nome completo').fill('Maria Fernandes');
await cli.getByLabel('Nota para a empresa (opcional)').fill('Podemos começar em janeiro.');
await cli.getByRole('button', { name: 'Aceitar proposta' }).click(); // sem confirmar: o browser não deixa enviar
ok(sql(`select aceite_em is null from propostas where orcamento_id='${orcId}'`) === 't', 'sem a confirmação não aceita');
await cli.getByRole('checkbox').check();
await cli.getByRole('button', { name: 'Aceitar proposta' }).click();
await cli.getByText('Obrigado! A proposta foi aceite.').waitFor();
ok(sql(`select aceite_nome||'|'||aceite_nota from propostas where orcamento_id='${orcId}'`) === 'Maria Fernandes|Podemos começar em janeiro.', 'aceitação registada com nome e nota');
await shot(cli, 'aceite');
const tok = link.split('/').pop();
const r2 = await fetch(`${B}/p/${tok}/aceitar`, { method: 'POST', body: new URLSearchParams({ nome: 'Outra Pessoa', confirmo: '1' }), redirect: 'manual' });
ok(r2.status === 303 && sql(`select aceite_nome from propostas where orcamento_id='${orcId}'`) === 'Maria Fernandes', 'segunda aceitação não altera a primeira');

// ---- 5. o profissional vê o aviso ----
await p.goto(B + '/orcamentos');
ok(await visivel(p.getByText('Maria Fernandes aceitou a proposta')), 'lista: aviso de proposta aceite');
ok((await p.locator('.cartao.aceite .estado').innerText()).toLowerCase() === 'aceite', 'cartão com estado Aceite');
await shot(p, 'lista-aceite');
await p.goto(`${B}/orcamentos/${orcId}`); await p.getByText(/Aceite por Maria Fernandes/).waitFor();
ok(await p.getByRole('button', { name: 'Atualizar com esta versão' }).count() === 0, 'editor: aceite, sem atualizar a página');

// ---- 6. expirada e Essencial ----
const tokExp = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
const orc2 = sql(`insert into orcamentos (user_id, dados) values ('${uid}', '{}') returning id`).split('\n')[0];
sql(`insert into propostas (token, user_id, orcamento_id, dados) select '${tokExp}', user_id, '${orc2}', jsonb_set(dados, '{meta,data}', '"2020-01-01"') from propostas where orcamento_id='${orcId}'`);
await cli.goto(`${B}/p/${tokExp}`);
ok(await visivel(cli.getByText('Esta proposta expirou')) && await cli.locator('.pc-form').count() === 0, 'proposta expirada: sem formulário');
ok((await fetch(`${B}/p/${'0'.repeat(48)}`)).status === 404, 'token desconhecido: 404');
// uma conta que copia caminhos de ficheiros de outra para a sua cópia não obtém links para eles
const outro = sql(`select id from auth.users where id <> '${uid}' order by created_at desc limit 1`);
const orc3 = sql(`insert into orcamentos (user_id, dados) values ('${outro}', '{}') returning id`).split('\n')[0];
const tokAlheio = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
sql(`insert into propostas (token, user_id, orcamento_id, dados, pdf_path) select '${tokAlheio}', '${outro}', '${orc3}', dados, pdf_path from propostas where orcamento_id='${orcId}'`);
const htmlAlheio = await (await fetch(`${B}/p/${tokAlheio}`)).text();
ok(!/Descarregar PDF/.test(htmlAlheio) && !/alt="Fotografia/.test(htmlAlheio) && !/token=/.test(htmlAlheio), 'ficheiros de outra conta nunca são assinados na página');
sql(`update assinaturas set plano='essencial', estado='active', experimental_ate=now()-interval '1 day' where user_id='${uid}'`);
const r4 = await p.evaluate(async () => (await fetch('/api/textos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"questionario":{}}' })).json());
ok(r4.code === 'so_pro', 'Essencial: textos pela IA recusados');
await p.goto(B + '/configuracao');
ok(await visivel(p.getByText('Espaço personalizado no Pro')) && await p.locator('header.top img').count() === 0, 'Essencial: sem marca no app, aviso do Pro');
console.log(erros.length ? erros : 'Sem erros nas páginas.'); console.log(falhas ? `${falhas} falha(s)` : 'Tudo certo.');
await browser.close();
