'use client';
// Assistente de orçamento em 6 passos (pedido → fotos → perguntas → medidas → revisão → PDF), herdado do protótipo.
// O estado guarda-se sozinho na base de dados; as fotos ficam no Storage privado do profissional.
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bytesDe, carregarFoto, urlsAssinadas } from '@/lib/fotos';
import { completarOrc, descObra, LEITURA_VAZIA, juntarLeituras, linhas, numeroProposta, partesMarca, textoSeguro, TIPOS_OBRA, totais, validadePadrao, type Empresa, type Estado, type Leitura, type Orc, type Passo, type Pergunta } from '@/lib/orc';
import { carregarFontes, descarregar, gerarPDF, nomeFicheiro } from '@/lib/pdf';
import { supabaseBrowser } from '@/lib/supabase/client';
import { deIso, fmtData, fmtEUR, isoHoje, maiuscula, norm, num, pad, uid, un } from '@/lib/util';
import Revisao from './editor/Revisao';
import Ditado from './editor/Ditado';
import { AreaTexto, ICON, Plano } from './editor/pecas';

const MAX_FOTOS = 40;
const FOTOS_POR_PEDIDO = 8;

const PASSOS: [Passo, string][] = [['pedido', 'Pedido'], ['leitura', 'Fotos'], ['perguntas', 'Perguntas'], ['medidas', 'Medidas'], ['revisao', 'Revisão'], ['pdf', 'PDF']];
const PASSO_TXT: Record<Passo, string> = { pedido: 'Passo 1 de 6 · Pedido', leitura: 'Passo 2 de 6 · Fotografias', perguntas: 'Passo 3 de 6 · Perguntas', medidas: 'Passo 4 de 6 · Medidas', revisao: 'Passo 5 de 6 · Revisão', pdf: 'Passo 6 de 6 · Proposta' };

const ERROS: Record<string, string> = {
  limite_diario: 'Chegou ao limite diário de pedidos à IA. Volte a tentar amanhã ou fale connosco.',
  rate_limited: 'A IA está com muitos pedidos neste momento. Espere um pouco e tente de novo.',
  session_expired: 'A sua sessão expirou. Entre de novo e tente outra vez.',
  image_rejected: 'Uma das fotos não foi aceite (formato ou tamanho). Remova-a ou use outra.',
  refused: 'A IA recusou este pedido. Reveja as notas e tente de novo.',
  prompt_too_large: 'O pedido ficou grande demais. Encurte as notas ou junte menos fotos.',
  invalid_json: 'A resposta veio num formato inesperado. Tente de novo.',
  empty_completion: 'A IA não devolveu resposta. Tente de novo.',
  unavailable: 'A IA não está disponível neste momento. Tente de novo dentro de minutos.',
  offline: 'Sem ligação à internet. Verifique a rede e tente de novo.'
};
const msgErro = (code?: string) => (code && ERROS[code]) || 'Falhou a ligação à IA. Tente de novo.';

type Ocupado = { label: string; sub: string };
type Erro = { msg: string; retry?: 'ler' | 'perguntas' | 'orcar'; back: Passo };

export default function Editor({ orcId, userId, inicial, empresa }: { orcId: string; userId: string; inicial: Estado; empresa: Empresa }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  // orçamentos antigos: modelo e campos da proposta completa com os valores da empresa
  const [S, setS] = useState<Estado>(() => ({
    ...inicial, modelo: inicial.modelo || empresa.modelo, mostrar_precos: inicial.mostrar_precos || empresa.mostrar_precos,
    orc: inicial.orc ? completarOrc(inicial.orc) : null
  }));
  const [custoIa, setCustoIa] = useState<number | null>(null);
  const [busy, setBusy] = useState<Ocupado | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aCarregar, setACarregar] = useState(0);
  const [gravacao, setGravacao] = useState<'guardado' | 'a guardar' | 'erro'>('guardado');
  const [toastMsg, setToastMsg] = useState<{ msg: string; desfazer?: () => void } | null>(null);
  const [pdfStatus, setPdfStatus] = useState('');
  const [envio, setEnvio] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upd = useCallback((fn: (d: Estado) => void) => setS((prev) => { const d = structuredClone(prev); fn(d); return d; }), []);

  /* ---------- guardar automaticamente ---------- */
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setGravacao('a guardar');
    const t = setTimeout(async () => {
      const total = S.orc && linhas(S.orc).length ? totais(S.orc, empresa).total : null;
      const { error } = await sb.from('orcamentos').update({
        dados: S, estado: S.aprovado ? 'aprovado' : 'rascunho', numero: S.meta.numero, tipo: S.pedido.tipo,
        localidade: S.pedido.localidade, dono: S.pedido.dono, total
      }).eq('id', orcId);
      setGravacao(error ? 'erro' : 'guardado');
    }, 700);
    return () => clearTimeout(t);
  }, [S, sb, orcId, empresa]);

  /* ---------- miniaturas (links assinados, 1 hora) ---------- */
  useEffect(() => {
    const falta = S.fotos.map((f) => f.path).filter((p) => !urls[p]);
    if (!falta.length) return;
    urlsAssinadas(sb, 'fotos', falta).then((u) => setUrls((x) => ({ ...x, ...u })));
  }, [S.fotos, urls, sb]);

  // A revisão alarga para duas colunas no computador (CSS do protótipo usa #app[data-step]).
  useEffect(() => { const app = document.getElementById('app'); if (app) app.dataset.step = S.step; }, [S.step]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string, desfazer?: () => void) => {
    setToastMsg({ msg, desfazer });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), desfazer ? 7000 : 4000);
  }, []);

  const go = (step: Passo) => { setErro(null); upd((d) => { d.step = step; }); window.scrollTo({ top: 0 }); };
  const disponivel = (s: Passo) => ({ pedido: true, leitura: !!S.leitura, perguntas: !!S.perguntas, medidas: !!S.medidas, revisao: !!S.orc, pdf: !!S.orc && S.aprovado })[s];

  /* ---------- chamadas à IA (rota /api/ia, no servidor) ---------- */
  async function ia<T>(corpo: object): Promise<T> {
    const c = new AbortController(); ctl.current = c;
    let r: Response;
    try { r = await fetch('/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corpo, orcamentoId: orcId }), signal: c.signal }); }
    catch (e) { throw { code: (e as Error)?.name === 'AbortError' ? 'cancelled' : 'offline' }; }
    const j = await r.json().catch(() => ({ code: 'unavailable' }));
    lerCusto();
    if (!r.ok) throw { code: j.code || 'unavailable' };
    return j as T;
  }
  // Custo de IA acumulado deste orçamento (registado pela rota /api/ia).
  const lerCusto = useCallback(async () => {
    const { data, error } = await sb.from('uso_ia').select('custo_usd').eq('orcamento_id', orcId);
    if (!error && data) setCustoIa(data.reduce((a: number, x: { custo_usd: number | string }) => a + Number(x.custo_usd || 0), 0));
  }, [sb, orcId]);
  useEffect(() => { lerCusto(); }, [lerCusto]);
  const codigo = (e: unknown) => (e as { code?: string })?.code;
  function falhou(e: unknown, retry: Erro['retry'], back: Passo) {
    setBusy(null);
    if (codigo(e) === 'cancelled') { go(back); return; }
    if (codigo(e) === 'session_expired') { router.replace('/entrar'); return; }
    setErro({ msg: msgErro(codigo(e)), retry, back });
  }
  const contexto = (s: Estado) => ({ pedido: s.pedido, leitura: s.leitura, correcao: s.correcao, perguntas: s.perguntas, respostas: s.respostas, extra: s.extra, medidas: s.medidas });

  async function lerFotos() {
    if (!S.fotos.length) return;
    upd((d) => { d.leitura = null; d.perguntas = null; d.medidas = null; d.orc = null; d.aprovado = false; d.step = 'leitura'; });
    setErro(null);
    const lotes: string[][] = [];
    for (let i = 0; i < S.fotos.length; i += FOTOS_POR_PEDIDO) lotes.push(S.fotos.slice(i, i + FOTOS_POR_PEDIDO).map((f) => f.path));
    const partes: Leitura[] = [];
    try {
      for (let k = 0; k < lotes.length; k++) {
        setBusy({ label: 'A ler as fotos', sub: lotes.length > 1 ? `Lote ${k + 1} de ${lotes.length} · ${S.fotos.length} fotos` : `${S.fotos.length} ${S.fotos.length === 1 ? 'foto' : 'fotos'}` });
        const r = await ia<{ leitura: Leitura }>({ acao: 'leitura', pedido: S.pedido, fotos: lotes[k], a: k * FOTOS_POR_PEDIDO + 1, total: S.fotos.length });
        partes.push(r.leitura);
      }
    } catch (e) { falhou(e, 'ler', 'pedido'); return; }
    upd((d) => { d.leitura = juntarLeituras(partes); });
    setBusy(null); window.scrollTo({ top: 0 });
  }

  async function gerarPerguntas(base?: Estado) {
    const s = base || S;
    upd((d) => { if (base) Object.assign(d, structuredClone(base)); d.step = 'perguntas'; d.perguntas = null; });
    setErro(null);
    setBusy({ label: 'A preparar as perguntas', sub: 'Só o que falta para orçamentar' });
    try {
      const r = await ia<{ perguntas: Pergunta[] }>({ acao: 'perguntas', ctx: contexto(s) });
      upd((d) => { d.perguntas = r.perguntas; d.respostas = {}; });
    } catch (e) { falhou(e, 'perguntas', s.fotos.length ? 'leitura' : 'pedido'); return; }
    setBusy(null); window.scrollTo({ top: 0 });
  }
  function semFotos() {
    const d = structuredClone(S);
    d.leitura = LEITURA_VAZIA(); d.perguntas = null; d.medidas = null; d.orc = null; d.aprovado = false;
    gerarPerguntas(d);
  }

  function iniciarMedidas() {
    upd((d) => {
      if (!d.medidas || !d.medidas.length) {
        const nomes = d.leitura && d.leitura.divisoes.length ? d.leitura.divisoes.map((x) => x.nome) : [d.pedido.tipo || 'Divisão'];
        d.medidas = nomes.map((n) => ({ id: uid('D'), divisao: n, comp: '', larg: '', pd: '', vaos: '', nota: '', estimar: false }));
      }
      d.step = 'medidas';
    });
    setErro(null); window.scrollTo({ top: 0 });
  }

  async function montarOrcamento() {
    upd((d) => { d.step = 'revisao'; });
    setErro(null);
    setBusy({ label: 'A montar o orçamento', sub: 'Quantidades, preços e de onde vem cada preço. Pode levar um ou dois minutos.' });
    try {
      const r = await ia<{ orc: Orc }>({ acao: 'orcamento', ctx: contexto(S), modelo: S.modelo });
      // numeração sequencial da empresa (ex.: MMGS-2026-001); sem a migração 0002, data + iniciais
      let numero = S.meta.numero;
      if (!numero) {
        const { data } = await sb.rpc('proximo_numero_proposta');
        numero = typeof data === 'string' && data ? data : numeroProposta(S.pedido.dono);
      }
      upd((d) => {
        d.orc = r.orc; d.aprovado = false; d.revisto = false;
        d.meta.numero = numero;
        d.meta.data = isoHoje();
        if (!d.meta.validade) d.meta.validade = validadePadrao(empresa);
        d.meta.prazo = r.orc.prazo || d.meta.prazo || '';
      });
    } catch (e) { falhou(e, 'orcar', 'medidas'); return; }
    setBusy(null); window.scrollTo({ top: 0 });
  }

  async function aplicarAjuste(instr: string) {
    setBusy({ label: 'A aplicar o ajuste', sub: instr.length > 90 ? instr.slice(0, 90) + '…' : instr });
    try {
      const r = await ia<{ orc: Orc }>({ acao: 'ajuste', instr, orc: S.orc, prazo: S.meta.prazo, modelo: S.modelo });
      upd((d) => { d.orc = r.orc; d.revisto = false; if (r.orc.prazo) d.meta.prazo = r.orc.prazo; });
      setBusy(null);
      toast('Ajuste aplicado. Confirme os preços novos e marque de novo a revisão.');
      return true;
    } catch (e) {
      setBusy(null);
      if (codigo(e) !== 'cancelled') toast(msgErro(codigo(e)));
      return false;
    }
  }

  async function escreverMensagem() {
    setBusy({ label: 'A escrever a mensagem', sub: 'Curta, para WhatsApp ou email' });
    try {
      const r = await ia<{ texto: string }>({ acao: 'mensagem', estado: { pedido: S.pedido, meta: S.meta, orc: S.orc } });
      upd((d) => { d.mensagem = r.texto.trim(); });
    } catch (e) { if (codigo(e) !== 'cancelled') toast(msgErro(codigo(e))); }
    setBusy(null);
  }

  /* ---------- fotos ---------- */
  async function juntarFotos(files: FileList) {
    const lista = [...files].slice(0, Math.max(0, MAX_FOTOS - S.fotos.length));
    if (files.length > lista.length) toast(`Máximo de ${MAX_FOTOS} fotos por orçamento.`);
    setACarregar((n) => n + lista.length);
    for (const f of lista) {
      try {
        const foto = await carregarFoto(sb, userId, orcId, f);
        upd((d) => { d.fotos.push(foto); });
      } catch (e) {
        console.warn('foto', e);
        toast(`Não consegui carregar “${f.name}”. Experimente outra foto.`);
      } finally { setACarregar((n) => n - 1); }
    }
  }
  async function removerFoto(id: string) {
    const f = S.fotos.find((x) => x.id === id); if (!f) return;
    upd((d) => { d.fotos = d.fotos.filter((x) => x.id !== id); });
    await sb.storage.from('fotos').remove([f.path]);
  }

  /* ---------- PDF ---------- */
  async function dadosPDF() {
    const [fontes, logo, ...fotos] = await Promise.all([
      carregarFontes(),
      empresa.logo_path ? bytesDe(sb, 'logos', empresa.logo_path) : Promise.resolve(null),
      ...S.fotos.map((f) => bytesDe(sb, 'fotos', f.path))
    ]);
    return { empresa, logo, pedido: S.pedido, meta: S.meta, orc: S.orc!, totais: totais(S.orc, empresa), fotos, leitura: S.leitura, exemplo: false, modelo: S.modelo, mostrarPrecos: S.mostrar_precos, fontes: fontes as Awaited<ReturnType<typeof carregarFontes>> };
  }
  async function pdf(partilhar: boolean) {
    if (!S.orc) return;
    setPdfStatus('A gerar o PDF…');
    try {
      const { bytes, paginas } = await gerarPDF(await dadosPDF());
      const nome = nomeFicheiro(empresa.nome, S.meta.numero);
      if (partilhar) {
        const file = new File([bytes as BlobPart], nome, { type: 'application/pdf' });
        try { await navigator.share({ files: [file], title: nome }); setPdfStatus(`PDF partilhado (${paginas} páginas).`); }
        catch (e) { setPdfStatus((e as Error)?.name === 'AbortError' ? '' : 'Não foi possível partilhar. Use “Descarregar PDF”.'); }
        return;
      }
      descarregar(bytes, nome);
      setPdfStatus(`PDF pronto: ${paginas} páginas, ${Math.max(1, Math.round(bytes.length / 1024))} KB.`);
    } catch (e) {
      console.error(e);
      setPdfStatus('Não foi possível gerar o PDF. Tente de novo.');
    }
  }
  const podePartilhar = typeof navigator !== 'undefined' && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }); } catch { return false; } })();

  /* ---------- enviar ao cliente (WhatsApp, email) ---------- */
  // Guarda o PDF (privado) e devolve um link assinado, válido durante a validade da proposta.
  async function linkPDF(): Promise<string> {
    const { bytes } = await gerarPDF(await dadosPDF());
    const path = `${userId}/${orcId}/proposta.pdf`;
    const { error } = await sb.storage.from('propostas').upload(path, new Blob([bytes as BlobPart], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
    if (error) throw error;
    const dias = Math.min(90, Math.max(7, Math.round(num(S.meta.validade)) || 30));
    const { data, error: e2 } = await sb.storage.from('propostas').createSignedUrl(path, dias * 86400, { download: nomeFicheiro(empresa.nome, S.meta.numero) });
    if (e2 || !data?.signedUrl) throw e2 || new Error('sem link');
    return data.signedUrl;
  }
  function textoEnvio(link: string) {
    const t = totais(S.orc, empresa);
    const titulo = (S.orc?.titulo || descObra(S.pedido.tipo)).toLowerCase();
    const nome = (S.pedido.dono || '').trim().split(/\s+/)[0];
    const base = S.mensagem.trim() || [
      `Bom dia${nome ? ' ' + nome : ''},`,
      `Segue a nossa proposta n.º ${S.meta.numero} para ${titulo}${S.pedido.localidade ? ' (' + S.pedido.localidade + ')' : ''}, no valor global de ${fmtEUR(t.semIva)} + IVA (${fmtEUR(t.total)} com IVA).`,
      'Fico ao dispor para qualquer esclarecimento e para marcar a visita técnica.',
      `Com os melhores cumprimentos,\n${empresa.assinante || empresa.nome}${empresa.assinante && empresa.nome ? '\n' + empresa.nome : ''}${empresa.telefone ? '\n' + empresa.telefone : ''}`
    ].join('\n\n');
    return `${base}\n\nProposta em PDF: ${link}`;
  }
  const telefoneWa = (t: string) => {
    let n = String(t || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
    if (/^9\d{8}$/.test(n) || /^2\d{8}$/.test(n)) n = '351' + n; // números portugueses sem indicativo
    return n;
  };
  async function enviar(via: 'whatsapp' | 'email') {
    if (!S.orc) return;
    // a janela abre já, dentro do clique (senão o browser bloqueia); o endereço chega depois
    const janela = via === 'whatsapp' ? window.open('', '_blank') : null;
    setEnvio('A preparar o envio…');
    try {
      const texto = textoEnvio(await linkPDF());
      if (via === 'whatsapp') {
        const url = `https://wa.me/${telefoneWa(S.pedido.telefone || '')}?text=${encodeURIComponent(texto)}`;
        if (janela) janela.location.href = url; else window.location.href = url;
      } else {
        const assunto = `Proposta n.º ${S.meta.numero} - ${S.orc.titulo || maiuscula(descObra(S.pedido.tipo))} - ${empresa.nome}`;
        window.location.href = `mailto:${encodeURIComponent(S.pedido.email || '')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
      }
      upd((d) => { d.meta.enviado = `${new Date().toISOString()}|${via}`; });
      setEnvio(via === 'whatsapp' ? 'WhatsApp aberto com a mensagem e o link do PDF: confirme e envie.' : 'Email aberto com a mensagem e o link do PDF: confirme e envie.');
    } catch (e) {
      console.error('enviar', e);
      janela?.close();
      const semBucket = /bucket|not found/i.test(String((e as Error)?.message || ''));
      setEnvio(semBucket ? 'Falta atualizar a base de dados (migração 0003 no Supabase) para enviar por link. Entretanto use “Partilhar PDF” ou “Descarregar PDF”.' : 'Não foi possível preparar o envio. Tente de novo.');
    }
  }
  const enviadoTxt = (() => {
    const [quando, via] = String(S.meta.enviado || '').split('|');
    if (!quando) return '';
    const d = new Date(quando);
    return `Enviada a ${fmtData(d)} às ${pad(d.getHours())}:${pad(d.getMinutes())} por ${via === 'email' ? 'email' : 'WhatsApp'}.`;
  })();

  async function copiarMensagem() {
    if (!S.mensagem.trim()) { toast('Ainda não há mensagem para copiar.'); return; }
    try { await navigator.clipboard.writeText(S.mensagem); toast('Mensagem copiada.'); }
    catch { toast('Não consegui copiar: selecione o texto e copie à mão.'); }
  }

  async function apagarOrcamento() {
    if (!window.confirm('Apagar este orçamento e as fotos? Não dá para desfazer.')) return;
    const paths = S.fotos.map((f) => f.path);
    if (paths.length) await sb.storage.from('fotos').remove(paths);
    await sb.storage.from('propostas').remove([`${userId}/${orcId}/proposta.pdf`]);
    await sb.from('orcamentos').delete().eq('id', orcId);
    router.replace('/orcamentos'); router.refresh();
  }

  /* ============ vistas ============ */
  const intro = (passo: Passo, titulo: string, lead: string, extra?: React.ReactNode) => (
    <section className="intro"><span className="eyebrow">{PASSO_TXT[passo]}</span><h1>{titulo}</h1>{lead ? <p className="lead">{lead}</p> : null}{extra}</section>
  );
  const imgFoto = (n: number) => { const f = S.fotos[n - 1]; const u = f && urls[f.path]; return u ? <img src={u} alt={`Foto ${n}`} /> : <span className="ph" aria-hidden="true" />; };

  function vOcupado() {
    return (
      <section className="busy" aria-busy="true">
        <span className="eyebrow">{PASSO_TXT[S.step]}</span>
        <h1>{busy!.label}…</h1>
        <div className="prog" aria-hidden="true"><i /></div>
        <p className="lead">{busy!.sub}</p>
        <div><button className="btn" onClick={() => ctl.current?.abort()}>Parar</button></div>
      </section>
    );
  }
  function vErro() {
    const retry = erro!.retry ? { ler: lerFotos, perguntas: () => gerarPerguntas(), orcar: montarOrcamento }[erro!.retry] : null;
    return (
      <section className="callout crit" role="alert">
        <strong>Não foi possível continuar</strong>
        <p>{erro!.msg}</p>
        <div className="row">{retry ? <button className="btn primary" onClick={() => { setErro(null); retry(); }}>Tentar de novo</button> : null}<button className="btn" onClick={() => go(erro!.back)}>Voltar</button></div>
      </section>
    );
  }

  function vPedido() {
    const p = S.pedido;
    const prontas = !aCarregar;
    return (
      <>
        {intro('pedido', 'Novo orçamento', 'Escreva o pedido, junte as fotos da obra e responda ao que a IA perguntar. No fim revê os preços e recebe a proposta em PDF com a sua marca.')}
        <section className="sheet">
          <label className="f"><span className="lab">O que precisa</span><AreaTexto rows={2} value={p.texto} onChange={(e) => upd((d) => { d.pedido.texto = e.target.value; })} /><Ditado valor={p.texto} onValor={(v) => upd((d) => { d.pedido.texto = v; })} /></label>
          <div className="f"><span className="lab" id="lab-tipo">Tipo de obra</span>
            <div className="chips" role="radiogroup" aria-labelledby="lab-tipo">{TIPOS_OBRA.map((t) => <button key={t} type="button" className="chip" role="radio" aria-checked={p.tipo === t} onClick={() => upd((d) => { d.pedido.tipo = d.pedido.tipo === t ? '' : t; })}>{t}</button>)}</div>
          </div>
          <div className="f-grid">
            <label className="f"><span className="lab">Localidade</span><input value={p.localidade} placeholder="Ex.: Lisboa, Arroios" autoComplete="off" onChange={(e) => upd((d) => { d.pedido.localidade = e.target.value; })} /></label>
            <label className="f"><span className="lab">Dono de obra</span><input value={p.dono} placeholder="Nome, aparece na proposta" autoComplete="off" onChange={(e) => upd((d) => { d.pedido.dono = e.target.value; })} /></label>
          </div>
          <div className="f-grid">
            <label className="f"><span className="lab">Telemóvel do cliente</span><input type="tel" inputMode="tel" value={p.telefone || ''} placeholder="Para enviar por WhatsApp" autoComplete="off" onChange={(e) => upd((d) => { d.pedido.telefone = e.target.value; })} /></label>
            <label className="f"><span className="lab">Email do cliente</span><input type="email" inputMode="email" value={p.email || ''} placeholder="Para enviar por email" autoComplete="off" onChange={(e) => upd((d) => { d.pedido.email = e.target.value; })} /></label>
          </div>
          <div className="f"><span className="lab" id="lab-modelo">Proposta</span>
            <div className="chips" role="radiogroup" aria-labelledby="lab-modelo">
              {([['completo', 'Completa: carta, capítulos e fases'], ['rapido', 'Rápida: resumo e mapa de preços']] as const).map(([v, t]) => <button key={v} type="button" className="chip" role="radio" aria-checked={S.modelo === v} onClick={() => upd((d) => { d.modelo = v; })}>{t}</button>)}
            </div>
          </div>
          <label className="f"><span className="lab">Notas da visita</span><AreaTexto rows={3} value={p.notas} placeholder="O que o dono de obra quer, gama de materiais, quem compra os materiais, acessos, prazo… Pode ditar por voz." onChange={(e) => upd((d) => { d.pedido.notas = e.target.value; })} /><Ditado valor={p.notas} onValor={(v) => upd((d) => { d.pedido.notas = v; })} rotulo="Ditar as notas" /></label>
        </section>
        <section className="fotos" aria-labelledby="lab-fotos">
          <div className="row-between"><span className="lab" id="lab-fotos">Fotografias</span><span className="mono small muted">{S.fotos.length ? `${S.fotos.length} de ${MAX_FOTOS}` : `Ainda sem fotos · até ${MAX_FOTOS}`}{aCarregar ? ` · a carregar ${aCarregar}…` : ''}</span></div>
          <div className="thumbs">
            {S.fotos.map((f, i) => (
              <div className="thumb" key={f.id}>
                {urls[f.path] ? <img src={urls[f.path]} alt={`Foto ${i + 1}`} /> : null}
                <span className="n">{pad(i + 1)}</span>
                <button type="button" className="rm" aria-label={`Remover foto ${i + 1}`} onClick={() => removerFoto(f.id)}><span aria-hidden="true">×</span></button>
              </div>
            ))}
            {Array.from({ length: aCarregar }, (_, i) => <div className="thumb loading" key={'c' + i} />)}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={async (e) => { const fs = e.target.files; if (fs?.length) await juntarFotos(fs); e.target.value = ''; }} />
          <button type="button" className="btn dashed wide" onClick={() => fileRef.current?.click()}>{ICON.mais} Juntar fotos</button>
          <p className="small muted">Cada divisão vista da porta, cada parede de frente, os pormenores (humidade, fissuras, quadro elétrico) e uma foto do croqui com as cotas.</p>
        </section>
        <div className="row"><form action={`/orcamentos/${orcId}/duplicar`} method="post"><button className="link">Duplicar este orçamento</button></form><button className="link danger" onClick={apagarOrcamento}>Apagar este orçamento</button></div>
        <div className="actions">
          <button className="btn lg" onClick={semFotos} disabled={!prontas}>Continuar sem fotos</button>
          <button className="btn primary lg grow" onClick={lerFotos} disabled={!S.fotos.length || !prontas}>Ler as fotos {ICON.seta}</button>
        </div>
      </>
    );
  }

  function vLeitura() {
    const L = S.leitura!;
    const frase = (xs: string[]) => xs.map((x, i) => (i === 0 ? maiuscula(x) : x)).join('; ');
    const linhaDv = (rot: string, xs: string[]) => (xs.length ? <div className="dv-row"><span className="lab">{rot}</span><span className="t">{frase(xs)}</span></div> : null);
    const quantas = (nome: string) => L.fotos.filter((f) => norm(f.divisao) === norm(nome)).length;
    const variasDiv = L.divisoes.length > 1;
    const ms = (rot: string, xs: string[], cls = '') => (xs.length ? <div className="card ms"><span className={'lab ' + cls}>{rot}</span><ul>{xs.map((x, i) => <li key={i}>{maiuscula(x)}</li>)}</ul></div> : null);
    return (
      <>
        {intro('leitura', 'O que a IA vê', 'Confirme a leitura antes de seguir. O que estiver errado ou faltar, escreva no fim: a IA usa a sua correção daqui para a frente.')}
        {L.fotos.length ? <div className="strip" aria-label="Fotografias lidas">{L.fotos.map((f) => <figure key={f.n}>{imgFoto(f.n)}<figcaption>{variasDiv && f.divisao ? `${pad(f.n)} · ${f.divisao.toLowerCase()}` : `Foto ${pad(f.n)}`}</figcaption></figure>)}</div> : null}
        {L.alertas.length ? <section className="callout crit"><strong>Atenção</strong><ul>{L.alertas.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null}
        <div className="dvs">
          {L.divisoes.length ? L.divisoes.map((d) => { const n = quantas(d.nome); return <article className="sheet" key={d.nome}><div className="sh-h"><h2>{d.nome}</h2>{n ? <span className="mono small muted">{n} {n === 1 ? 'foto' : 'fotos'}</span> : null}</div>{linhaDv('Elementos', d.elementos)}{linhaDv('Materiais', d.materiais)}{linhaDv('Estado', d.estado)}</article>; }) : <p className="muted">Nenhuma divisão identificada nas fotos.</p>}
        </div>
        <div className="ms-grid">{ms('Não consigo ver', L.nao_consigo_ver)}{ms('Confirme', L.preciso_confirmar, 'warn')}{ms('Trabalhos prováveis', L.trabalhos_provaveis)}</div>
        {L.cotas_lidas.length ? <section className="blk"><span className="lab">Cotas lidas nas fotos</span><div className="cotas">{L.cotas_lidas.map((c, i) => <span key={i}>{c}</span>)}</div></section> : null}
        {L.fotos.length ? <details className="card"><summary>Descrição de cada foto</summary><div className="fotos-desc">{L.fotos.map((f) => <div key={f.n}>{imgFoto(f.n)}<p className="small"><strong>Foto {f.n}{f.divisao ? ' · ' + f.divisao : ''}.</strong> {f.descricao}</p></div>)}</div></details> : null}
        <section className="sheet">
          <label className="f"><span className="lab">Correções ou informação extra</span><AreaTexto rows={3} value={S.correcao} placeholder="Ex.: a base de duche fica; o teto é só para pintar." onChange={(e) => upd((d) => { d.correcao = e.target.value; })} /><Ditado valor={S.correcao} onValor={(v) => upd((d) => { d.correcao = v; })} /></label>
        </section>
        <div className="actions"><button className="btn lg" onClick={() => go('pedido')}>Voltar</button><button className="btn primary lg grow" onClick={() => gerarPerguntas()}>Está certo, continuar {ICON.seta}</button></div>
      </>
    );
  }

  function vPerguntas() {
    const qs = S.perguntas || [];
    const resp = (id: string, v: string) => upd((d) => { d.respostas[id] = v; });
    return (
      <>
        {intro('perguntas', qs.length ? 'Só o que falta' : 'Já tenho o que preciso', qs.length ? 'Responda ao que souber. O que ficar em branco, a IA marca como a confirmar na visita.' : 'Se quiser, acrescente alguma coisa antes de seguir para as medidas.')}
        <section className="sheet">
          {qs.map((q, i) => {
            const v = S.respostas[q.id] || '';
            const ops = q.tipo === 'sim_nao' ? ['Sim', 'Não'] : q.opcoes;
            return (
              <div className="q" key={q.id}>
                <span className="q-tema">{pad(i + 1)}{q.tema ? ' · ' + q.tema : ''}</span>
                <span className="q-p" id={`qp-${q.id}`}>{q.pergunta}</span>
                {q.tipo === 'escolha' || q.tipo === 'sim_nao' ? (
                  <>
                    <div className="chips" role="radiogroup" aria-labelledby={`qp-${q.id}`}>{ops.map((o) => <button key={o} type="button" className="chip" role="radio" aria-checked={v === o} onClick={() => resp(q.id, v === o ? '' : o)}>{o}</button>)}</div>
                    {q.tipo === 'escolha' ? <label className="ul sans"><span className="sr-only">Outra resposta</span><input placeholder="Outra resposta" value={ops.includes(v) ? '' : v} onChange={(e) => resp(q.id, e.target.value)} /></label> : null}
                  </>
                ) : q.tipo === 'numero' ? (
                  <div className="ul num-ul"><input inputMode="decimal" value={v} aria-labelledby={`qp-${q.id}`} onChange={(e) => resp(q.id, e.target.value)} />{q.unidade ? <span className="u">{un(q.unidade)}</span> : null}</div>
                ) : (
                  <div className="ul sans"><input value={v} aria-labelledby={`qp-${q.id}`} onChange={(e) => resp(q.id, e.target.value)} /></div>
                )}
                {q.porque ? <span className="why">{q.porque}</span> : null}
              </div>
            );
          })}
          <label className="f"><span className="lab">Mais alguma coisa?</span><AreaTexto rows={2} value={S.extra} placeholder="Ex.: o dono de obra quer começar em novembro." onChange={(e) => upd((d) => { d.extra = e.target.value; })} /><Ditado valor={S.extra} onValor={(v) => upd((d) => { d.extra = v; })} /></label>
        </section>
        <div className="actions"><button className="btn lg" onClick={() => go(S.fotos.length || S.leitura?.fotos.length ? 'leitura' : 'pedido')}>Voltar</button><button className="btn primary lg grow" onClick={iniciarMedidas}>Continuar para as medidas {ICON.seta}</button></div>
      </>
    );
  }

  function vMedidas() {
    const mudar = (id: string, f: 'divisao' | 'comp' | 'larg' | 'pd' | 'vaos' | 'nota', v: string) => upd((d) => { const m = d.medidas!.find((x) => x.id === id); if (m) m[f] = v; });
    return (
      <>
        {intro('medidas', 'Medidas', 'Em metros. Sem medidas, a IA estima pelas fotos e marca essas quantidades como estimadas, a confirmar na visita.')}
        {(S.medidas || []).map((m) => (
          <section className="sheet" aria-label={`Medidas: ${m.divisao}`} key={m.id}>
            <div className="dv-h"><input className="dv-nome" aria-label="Nome da divisão" value={m.divisao} onChange={(e) => mudar(m.id, 'divisao', e.target.value)} /><button className="link muted" onClick={() => upd((d) => { d.medidas = d.medidas!.filter((x) => x.id !== m.id); })}>Remover</button></div>
            <div className="plano"><Plano m={m} /></div>
            <div className="dims">
              {(['comp', 'larg', 'pd'] as const).map((f) => (
                <label className="dim-f" key={f}><span className="lab">{{ comp: 'Compr.', larg: 'Largura', pd: 'Pé-direito' }[f]}</span><span className="ul"><input inputMode="decimal" value={m[f]} disabled={m.estimar} onChange={(e) => mudar(m.id, f, e.target.value)} /><span className="u">m</span></span></label>
              ))}
            </div>
            <div className="dv-f">
              <label className="dv-l"><span className="lab">Vãos (portas e janelas)</span><span className="ul sans"><input value={m.vaos} placeholder="Ex.: porta 0,80 × 2,00; janela 0,60 × 0,80" onChange={(e) => mudar(m.id, 'vaos', e.target.value)} /></span></label>
              <label className="dv-l"><span className="lab">Nota</span><span className="ul sans"><input value={m.nota} placeholder="Ex.: a parede da janela tem 2,40 m" onChange={(e) => mudar(m.id, 'nota', e.target.value)} /></span></label>
            </div>
            <label className="est"><input type="checkbox" checked={m.estimar} onChange={(e) => upd((d) => { const x = d.medidas!.find((k) => k.id === m.id); if (x) x.estimar = e.target.checked; })} /> Não tenho as medidas desta divisão: estimar pelas fotos</label>
          </section>
        ))}
        <div><button className="btn dashed" onClick={() => upd((d) => { d.medidas!.push({ id: uid('D'), divisao: 'Nova divisão', comp: '', larg: '', pd: '', vaos: '', nota: '', estimar: false }); })}>{ICON.mais} Adicionar divisão</button></div>
        <div className="actions"><button className="btn lg" onClick={() => go('perguntas')}>Voltar</button><button className="btn primary lg grow" onClick={montarOrcamento}>Montar orçamento {ICON.seta}</button></div>
      </>
    );
  }

  function capaMini() {
    const e = empresa;
    const mc = partesMarca(e.nome || '');
    const dataP = deIso(S.meta.data || isoHoje());
    const val = Math.round(num(S.meta.validade)) || validadePadrao(e);
    const fim = new Date(dataP); fim.setDate(fim.getDate() + val);
    const cor = /^#[0-9a-f]{6}$/i.test(e.cor || '') ? e.cor : '#1F3F8F';
    const foto = S.fotos.find((f) => urls[f.path]);
    const contactos = [e.telefone, e.email].filter(Boolean).join(' · ');
    const legais = [e.nif ? 'NIF ' + e.nif : '', e.alvara ? 'Alvará/registo ' + e.alvara : '', e.seguro ? textoSeguro(e.seguro) : ''].filter(Boolean).join(' · ');
    return (
      <div className="paper" aria-hidden="true" style={{ '--brand': cor } as React.CSSProperties}>
        <div className="pp-top"><span className="pp-wm">{mc.main || 'Empresa'}</span><span className="pp-ct">{contactos}</span></div>
        <span className="pp-rule" />
        <span className="pp-lab">Proposta de orçamento</span>
        <span className="pp-tit">{maiuscula(descObra(S.pedido.tipo))}</span>
        <span className="pp-loc">{S.pedido.localidade}</span>
        <span className="pp-cota"><span>{fmtData(dataP)}</span><i /><b>{val} dias</b><i /><span>{fmtData(fim)}</span></span>
        <span className="pp-foto">{foto ? <img src={urls[foto.path]} alt="" /> : null}</span>
        <span className="pp-meta"><span>N.º {S.meta.numero}</span><span>{S.pedido.dono}</span></span>
        <span className="pp-legal">{legais}</span>
      </div>
    );
  }

  function vPdf() {
    const t = totais(S.orc, empresa);
    return (
      <>
        {intro('pdf', 'Proposta pronta', '', <div className="tot-line"><span className="lab">Total com IVA</span><span className="tot-mid num">{fmtEUR(t.total)}</span></div>)}
        <figure className="preview">{capaMini()}<figcaption className="mono small muted">{nomeFicheiro(empresa.nome, S.meta.numero)}</figcaption></figure>
        <section className="pdf-acts">
          <button className="btn lg" onClick={() => pdf(false)}>{ICON.baixar} Descarregar PDF</button>
          {podePartilhar ? <button className="btn lg" onClick={() => pdf(true)}>{ICON.partilhar} Partilhar PDF (ficheiro)</button> : null}
          <p className="small muted" role="status">{pdfStatus}</p>
          {custoIa !== null ? <p className="small muted">Custo de IA deste orçamento: {custoIa.toFixed(2).replace('.', ',')} US$</p> : null}
        </section>
        <section className="sheet enviar" aria-labelledby="lab-env">
          <div className="sh-h"><h2 id="lab-env">Enviar ao cliente</h2>{enviadoTxt ? <span className="small ok-msg">{enviadoTxt}</span> : null}</div>
          <div className="f-grid">
            <label className="f"><span className="lab">Telemóvel</span><input type="tel" inputMode="tel" value={S.pedido.telefone || ''} placeholder="Ex.: 912 345 678" onChange={(e) => upd((d) => { d.pedido.telefone = e.target.value; })} /></label>
            <label className="f"><span className="lab">Email</span><input type="email" inputMode="email" value={S.pedido.email || ''} placeholder="cliente@exemplo.pt" onChange={(e) => upd((d) => { d.pedido.email = e.target.value; })} /></label>
          </div>
          <div className="sh-f row">
            <button className="btn primary grow" onClick={() => enviar('whatsapp')}>{ICON.whatsapp} Enviar por WhatsApp</button>
            <button className="btn grow" onClick={() => enviar('email')}>{ICON.email} Enviar por email</button>
          </div>
          {envio ? <p className={'sh-f small ' + (/Falta|Não foi/.test(envio) ? 'erro' : 'muted')} role="status">{envio}</p> : null}
          <p className="sh-f small muted">Abre a conversa ou o email já com a mensagem abaixo e um link seguro para o PDF, válido durante a validade da proposta. Só envia quando confirmar na aplicação.</p>
        </section>
        <section className="sheet">
          <div className="sh-h"><span className="lab" id="lab-msg">Mensagem</span><button className="link" onClick={escreverMensagem}>{S.mensagem ? 'Escrever outra' : 'Escrever com a IA'}</button></div>
          <div className="f"><AreaTexto rows={6} aria-labelledby="lab-msg" value={S.mensagem} placeholder="Carregue em “Escrever com a IA” ou escreva aqui." onChange={(e) => upd((d) => { d.mensagem = e.target.value; })} /><Ditado valor={S.mensagem} onValor={(v) => upd((d) => { d.mensagem = v; })} /></div>
          <div className="sh-f"><button className="btn wide" onClick={copiarMensagem}>{ICON.copiar} Copiar mensagem</button></div>
        </section>
        {S.orc!.a_confirmar.length ? <section className="card ms"><span className="lab">Confirmar na visita</span><ul>{S.orc!.a_confirmar.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null}
        <div className="actions"><button className="btn lg" onClick={() => { upd((d) => { d.aprovado = false; }); go('revisao'); }}>Voltar à revisão</button>
          <form action="/orcamentos/novo" method="post" className="grow" style={{ display: 'flex' }}><button className="btn lg grow">Novo orçamento</button></form></div>
        <div className="row small muted"><form action={`/orcamentos/${orcId}/duplicar`} method="post"><button className="link">Duplicar este orçamento</button></form><span>para usar como base de outra proposta.</span></div>
      </>
    );
  }

  let corpo: React.ReactNode;
  if (busy && S.step !== 'revisao') corpo = vOcupado();
  else if (busy && S.step === 'revisao' && !S.orc) corpo = vOcupado();
  else if (erro) corpo = vErro();
  else if (S.step === 'leitura' && S.leitura) corpo = vLeitura();
  else if (S.step === 'perguntas' && S.perguntas) corpo = vPerguntas();
  else if (S.step === 'medidas' && S.medidas) corpo = vMedidas();
  else if (S.step === 'revisao' && S.orc) corpo = busy ? vOcupado() : <Revisao S={S} upd={upd} empresa={empresa} ocupado={!!busy} custoIa={custoIa} onAjuste={aplicarAjuste} onVoltar={() => go('medidas')} toast={toast} onAprovar={() => { upd((d) => { d.aprovado = true; }); setPdfStatus(''); go('pdf'); }} />;
  else if (S.step === 'pdf' && S.orc && S.aprovado) corpo = vPdf();
  else corpo = vPedido();

  const atual = PASSOS.findIndex((p) => p[0] === S.step);
  return (
    <>
      <nav aria-label="Passos do orçamento">
        <ol className="cota">
          {PASSOS.map(([k, label], i) => {
            const cls = i < atual ? 'done' : i === atual ? 'now' : '';
            const pode = i < atual && disponivel(k) && !busy;
            const dentro = <><span className="tk" aria-hidden="true" /><span className="lb"><span className="cn">{pad(i + 1)}</span><span className="cl">{label}</span></span></>;
            return <li key={k} className={cls} aria-current={i === atual ? 'step' : undefined}>{pode ? <button type="button" className="st" onClick={() => go(k)}>{dentro}</button> : <span className="st">{dentro}</span>}</li>;
          })}
        </ol>
      </nav>
      <p className="guardado" aria-live="polite" style={{ textAlign: 'right', marginTop: 6 }}>{gravacao === 'a guardar' ? 'A guardar…' : gravacao === 'erro' ? 'Sem ligação: alterações por guardar' : 'Guardado'}</p>
      <main>{corpo}</main>
      {toastMsg ? (
        <div className="toast" role="status">
          <span>{toastMsg.msg}</span>
          {toastMsg.desfazer ? <button className="link" onClick={() => { toastMsg.desfazer!(); setToastMsg(null); }}>Desfazer</button> : null}
        </div>
      ) : null}
    </>
  );
}
