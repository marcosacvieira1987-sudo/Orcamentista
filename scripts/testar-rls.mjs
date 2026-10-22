// Testa o isolamento entre contas (RLS) contra um Supabase local: `supabase start` e depois
// node scripts/testar-rls.mjs  (lê NEXT_PUBLIC_SUPABASE_URL e a chave pública de .env.local)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas++; };

async function conta(nome) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `${nome}-${Date.now()}@teste.pt`;
  const { data, error } = await sb.auth.signUp({ email, password: 'palavra-passe-1', options: { data: { empresa: nome.toUpperCase() + ' Obras' } } });
  if (error) throw error;
  return { sb, id: data.user.id };
}

const A = await conta('ana'), B = await conta('bruno');

const { data: empA } = await A.sb.from('empresas').select('*');
ok(empA.length === 1 && empA[0].nome === 'ANA Obras', 'empresa criada no registo, com o nome indicado');
const { data: empTodas } = await B.sb.from('empresas').select('user_id');
ok(empTodas.length === 1 && empTodas[0].user_id === B.id, 'B só vê a sua empresa');

const { data: orcA } = await A.sb.from('orcamentos').insert({ dados: { v: 1 }, dono: 'Cliente da Ana' }).select('id').single();
ok(!!orcA?.id, 'A cria um orçamento');
const { data: verB } = await B.sb.from('orcamentos').select('*').eq('id', orcA.id);
ok(verB.length === 0, 'B não lê o orçamento de A');
const { data: updB } = await B.sb.from('orcamentos').update({ dono: 'pirata' }).eq('id', orcA.id).select();
ok(!updB || updB.length === 0, 'B não altera o orçamento de A');
const { data: delB } = await B.sb.from('orcamentos').delete().eq('id', orcA.id).select();
ok(!delB || delB.length === 0, 'B não apaga o orçamento de A');
const { error: insB } = await B.sb.from('orcamentos').insert({ user_id: A.id, dados: {} });
ok(!!insB, 'B não cria orçamentos em nome de A');
const { data: empUpdB } = await B.sb.from('empresas').update({ nome: 'pirata' }).eq('user_id', A.id).select();
ok(!empUpdB || empUpdB.length === 0, 'B não altera a empresa de A');

const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
const { error: upA } = await A.sb.storage.from('fotos').upload(`${A.id}/${orcA.id}/f1.jpg`, jpeg, { contentType: 'image/jpeg' });
ok(!upA, 'A carrega uma foto na sua pasta');
const { error: upB } = await B.sb.storage.from('fotos').upload(`${A.id}/${orcA.id}/intruso.jpg`, jpeg, { contentType: 'image/jpeg' });
ok(!!upB, 'B não carrega fotos na pasta de A');
const { data: dlB } = await B.sb.storage.from('fotos').download(`${A.id}/${orcA.id}/f1.jpg`);
ok(!dlB, 'B não descarrega fotos de A');
const { data: signB } = await B.sb.storage.from('fotos').createSignedUrl(`${A.id}/${orcA.id}/f1.jpg`, 60);
ok(!signB?.signedUrl, 'B não cria links para fotos de A');
const { data: rmB } = await B.sb.storage.from('fotos').remove([`${A.id}/${orcA.id}/f1.jpg`]);
ok(!rmB || rmB.length === 0, 'B não apaga fotos de A');
const { data: dlA } = await A.sb.storage.from('fotos').download(`${A.id}/${orcA.id}/f1.jpg`);
ok(!!dlA, 'a foto de A continua lá e A consegue lê-la');

await A.sb.from('uso_ia').insert({ acao: 'teste' });
const { data: usoDel } = await A.sb.from('uso_ia').delete().eq('user_id', A.id).select();
ok(!usoDel || usoDel.length === 0, 'A não consegue apagar o seu registo de uso (limite diário não se contorna)');
const { data: usoB } = await B.sb.from('uso_ia').select('*');
ok(usoB.length === 0, 'B não vê o uso de A');

const anon = createClient(URL, KEY, { auth: { persistSession: false } });
const { data: anonO } = await anon.from('orcamentos').select('*');
ok(anonO.length === 0, 'sem sessão não se lê nada');

// numeração sequencial por empresa (migração 0002)
const n1 = (await A.sb.rpc('proximo_numero_proposta')).data, n2 = (await A.sb.rpc('proximo_numero_proposta')).data;
const nb = (await B.sb.rpc('proximo_numero_proposta')).data;
ok(/^ANA-\d{4}-001$/.test(n1) && /^ANA-\d{4}-002$/.test(n2), `numeração de A em sequência (${n1}, ${n2})`);
ok(/^BRUNO-\d{4}-001$/.test(nb), `B tem a sua própria sequência (${nb})`);
await A.sb.from('empresas').update({ prefixo: 'MMGS' }).eq('user_id', A.id);
const n3 = (await A.sb.rpc('proximo_numero_proposta')).data;
ok(/^MMGS-\d{4}-003$/.test(n3), `prefixo configurado e sequência mantida (${n3})`);
const { error: usoErr } = await A.sb.from('uso_ia').insert({ acao: 'teste', orcamento_id: orcA.id, tokens_in: 1000, tokens_out: 500, custo_usd: 0.014 });
ok(!usoErr, 'regista o custo da IA ligado ao orçamento');

// PDFs enviados por link (migração 0003)
const pdfBlob = new Blob(['%PDF-1.4 teste'], { type: 'application/pdf' });
const { error: upP } = await A.sb.storage.from('propostas').upload(`${A.id}/${orcA.id}/proposta.pdf`, pdfBlob, { contentType: 'application/pdf', upsert: true });
ok(!upP, 'A guarda o PDF da proposta na sua pasta');
const { data: lnkB } = await B.sb.storage.from('propostas').createSignedUrl(`${A.id}/${orcA.id}/proposta.pdf`, 60);
ok(!lnkB?.signedUrl, 'B não cria links para o PDF de A');
const { data: lnkA } = await A.sb.storage.from('propostas').createSignedUrl(`${A.id}/${orcA.id}/proposta.pdf`, 60);
const r = lnkA?.signedUrl ? await fetch(lnkA.signedUrl) : null;
ok(!!r && r.ok, 'o link assinado de A abre o PDF sem sessão (é o que o cliente recebe)');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo isolado.');
process.exit(falhas ? 1 : 0);
