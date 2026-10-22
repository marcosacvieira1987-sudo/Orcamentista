// Proposta em PDF com a marca do profissional (gerada no browser).
// Dois modelos: "rápido" (herdado do protótipo) e "completo" (estrutura da proposta MMGS:
// capas, apresentação, resumo por fases, o que encontrámos, um capítulo por página, condições e adjudicação).
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, clip, degrees, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import type { Capitulo, Empresa, Leitura, Meta, Modelo, MostrarPrecos, Orc, Pedido, Totais } from './orc';
import { descObra, partesMarca, planoPagamentos, resumoFases, semIva, subtotal, textoSeguro, totalLinha, valorCapitulo } from './orc';
import { PRODUTO } from './marca';
import { deIso, fmtData, fmtEUR, fmtN, isoHoje, maiuscula, num, pad, un } from './util';

export type ImagemBytes = { bytes: Uint8Array; png: boolean };
export type DadosPDF = {
  empresa: Empresa; logo: ImagemBytes | null; pedido: Pick<Pedido, 'tipo' | 'localidade' | 'dono'>;
  meta: Meta; orc: Orc; totais: Totais; fotos: (ImagemBytes | null)[]; leitura: Leitura | null; exemplo: boolean;
  modelo?: Modelo; mostrarPrecos?: MostrarPrecos;
  fontes?: Fontes | null;
};
// Poppins (a letra da proposta MMGS); sem ela o PDF usa Helvetica.
export type Fontes = { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array };
export async function carregarFontes(base = '/fontes'): Promise<Fontes | null> {
  try {
    const ler = async (f: string) => { const r = await fetch(`${base}/${f}`); if (!r.ok) throw new Error(f); return new Uint8Array(await r.arrayBuffer()); };
    const [regular, bold, italic] = await Promise.all([ler('poppins-400.woff'), ler('poppins-700.woff'), ler('poppins-400-italic.woff')]);
    return { regular, bold, italic };
  } catch { return null; }
}

/* ============ texto ============ */
const WIN = new Set<string>();
for (let c = 0x20; c <= 0x7e; c++) WIN.add(String.fromCharCode(c));
for (let c = 0xa0; c <= 0xff; c++) WIN.add(String.fromCharCode(c));
for (const ch of '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ') WIN.add(ch);
const TROCA: Record<string, string> = { '→': '->', '←': '<-', '≈': '~', '≥': '>=', '≤': '<=', '−': '-', '‑': '-', '‐': '-', '‒': '-', ' ': ' ', ' ': ' ', '​': '', '\t': ' ', '✓': 'v', '✔': 'v', 'ﬁ': 'fi', 'ﬂ': 'fl', '⁄': '/', '∅': 'Ø', '­': '' };
// As fontes padrão do PDF só têm WinAnsi: troca ou retira o que não cabe.
function pdfSafe(s: unknown) {
  let out = '';
  for (const ch of String(s ?? '').normalize('NFC').replace(/[\r\n]+/g, ' ')) {
    if (WIN.has(ch)) out += ch;
    else if (TROCA[ch] !== undefined) out += TROCA[ch];
    else { const b = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); if ([...b].every((x) => WIN.has(x))) out += b; }
  }
  return out;
}
// Folga de 2% na largura: os leitores de PDF podem usar uma Helvetica substituta ligeiramente mais larga.
const FOLGA = 0.98;
// Valores (ex.: "7 011,00 €") nunca se partem entre linhas: os espaços dentro de números ficam inquebráveis.
const NBSP = '\u00a0';
const unirNumeros = (t: string) => t.replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`).replace(/(\d) (?=€)/g, `$1${NBSP}`).replace(/€ (?=\+ IVA)/g, `€${NBSP}`);
const separar = (t: string) => unirNumeros(pdfSafe(t)).split(/[ \t\r\n]+/).filter(Boolean);
function quebrar(texto: string, font: PDFFont, size: number, largura: number) {
  const maxW = largura * FOLGA;
  const words = separar(texto);
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur);
    if (font.widthOfTextAtSize(w, size) > maxW) {
      let part = '';
      for (const ch of w) { if (font.widthOfTextAtSize(part + ch, size) > maxW) { lines.push(part); part = ch; } else part += ch; }
      cur = part;
    } else cur = w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
// Quebra com linhas de comprimento parecido (para títulos): procura a largura mínima que mantém o número de linhas.
function quebrarEquilibrado(texto: string, font: PDFFont, size: number, maxW: number) {
  const base = quebrar(texto, font, size, maxW);
  if (base.length < 2) return base;
  let lo = maxW * 0.45, hi = maxW;
  for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (quebrar(texto, font, size, mid).length > base.length) lo = mid; else hi = mid; }
  return quebrar(texto, font, size, hi);
}
// Texto com **negrito**: devolve linhas de palavras marcadas.
// "colada": sem espaço antes (ex.: a vírgula logo a seguir a um negrito).
type Palavra = { t: string; b: boolean; colada?: boolean };
function quebrarRico(texto: string, F: PDFFont, FB: PDFFont, size: number, largura: number): Palavra[][] {
  const maxW = largura * FOLGA;
  const palavras: Palavra[] = [];
  const partes = String(texto || '').split('**');
  partes.forEach((parte, i) => {
    const colaInicio = i > 0 && !/^\s/.test(parte) && !/\s$/.test(partes[i - 1]);
    separar(parte).forEach((t, j) => palavras.push({ t, b: i % 2 === 1, colada: j === 0 && colaInicio && palavras.length > 0 }));
  });
  const esp = F.widthOfTextAtSize(' ', size);
  const larg = (p: Palavra) => (p.b ? FB : F).widthOfTextAtSize(p.t, size);
  const linhas: Palavra[][] = []; let cur: Palavra[] = []; let w = 0;
  for (const p of palavras) {
    const lp = larg(p), e = cur.length && !p.colada ? esp : 0;
    if (cur.length && !p.colada && w + e + lp > maxW) { linhas.push(cur); cur = []; w = 0; }
    w += (cur.length && !p.colada ? esp : 0) + lp; cur.push(p);
  }
  if (cur.length) linhas.push(cur);
  return linhas;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

/* ============ base comum ============ */
const W = 595.28, H = 841.89, M = 54;

async function preparar(d: DadosPDF) {
  const pdf = await PDFDocument.create();
  let F: PDFFont, FB: PDFFont, FI: PDFFont;
  try {
    if (!d.fontes) throw new Error('sem fontes');
    pdf.registerFontkit(fontkit);
    [F, FB, FI] = await Promise.all([pdf.embedFont(d.fontes.regular, { subset: true }), pdf.embedFont(d.fontes.bold, { subset: true }), pdf.embedFont(d.fontes.italic, { subset: true })]);
  } catch {
    [F, FB, FI] = await Promise.all([pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold), pdf.embedFont(StandardFonts.HelveticaOblique)]);
  }
  const cor = (h: string, def = '101315') => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); const v = m ? m[1] : def; return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255]; };
  const [br, bg, bb] = cor(d.empresa.cor, '1F3F8F');
  const tom = (k: number) => rgb(br + (1 - br) * k, bg + (1 - bg) * k, bb + (1 - bb) * k);
  // cor da marca muito escura (ex.: preto): sobre fundo escuro usa-se um tom claro, para se ler
  const escura = 0.2126 * br + 0.7152 * bg + 0.0722 * bb < 0.3;
  const C = {
    BR: rgb(br, bg, bb), BR_CLARO: tom(0.9), BR_FUNDO: tom(0.96), BR_SOBRE_ESCURO: escura ? tom(0.7) : rgb(br, bg, bb),
    INK: rgb(0.063, 0.075, 0.082), MUT: rgb(0.357, 0.384, 0.408), HAIR: rgb(0.867, 0.878, 0.859), PAPEL: rgb(0.949, 0.953, 0.941), CRIT: rgb(0.702, 0.149, 0.118), BRANCO: rgb(1, 1, 1)
  };
  const e = d.empresa;
  const val = Math.round(num(d.meta.validade)) || 30;
  const dataP = deIso(d.meta.data || isoHoje());
  const fim = new Date(dataP); fim.setDate(fim.getDate() + val);

  pdf.setTitle(`Proposta ${d.meta.numero} - ${e.nome || 'Orçamento'}`);
  pdf.setAuthor(e.nome || '');
  pdf.setSubject([d.pedido.tipo, d.pedido.localidade].filter(Boolean).join(', '));
  pdf.setCreator(PRODUTO);
  pdf.setProducer(`${PRODUTO} (pdf-lib)`);
  pdf.setLanguage('pt-PT');

  // Coordenadas medidas a partir do topo da página (como no desenho), convertidas aqui.
  const Y = (t: number) => H - t;
  // ² e ³ desenhados como algarismos pequenos e elevados: assim aparecem em qualquer leitor de PDF.
  const SUP: Record<string, string> = { '²': '2', '³': '3' };
  const segs = (t: string) => t.split(/([²³])/).filter(Boolean);
  const larg = (s: string, f: PDFFont, sz: number, tr = 0) => {
    const t = pdfSafe(s); let w = 0;
    for (const g of segs(t)) w += SUP[g] ? f.widthOfTextAtSize(SUP[g], sz * 0.62) + 0.9 : f.widthOfTextAtSize(g, sz) + g.length * tr;
    return w - (t && !SUP[t[t.length - 1]] ? tr : 0);
  };
  const txt = (p: PDFPage, s: string, x: number, top: number, f: PDFFont, sz: number, c: RGB, tr = 0) => {
    const t = pdfSafe(s); if (!t) return;
    let xx = x;
    for (const g of segs(t)) {
      if (SUP[g]) { p.drawText(SUP[g], { x: xx + 0.3, y: Y(top) + sz * 0.36, size: sz * 0.62, font: f, color: c }); xx += f.widthOfTextAtSize(SUP[g], sz * 0.62) + 0.9; continue; }
      if (tr) p.pushOperators(setCharacterSpacing(tr));
      p.drawText(g, { x: xx, y: Y(top), size: sz, font: f, color: c });
      if (tr) p.pushOperators(setCharacterSpacing(0));
      xx += f.widthOfTextAtSize(g, sz) + g.length * tr;
    }
  };
  const txtR = (p: PDFPage, s: string, xr: number, top: number, f: PDFFont, sz: number, c: RGB, tr = 0) => txt(p, s, xr - larg(s, f, sz, tr), top, f, sz, c, tr);
  const txtC = (p: PDFPage, s: string, xc: number, top: number, f: PDFFont, sz: number, c: RGB, tr = 0) => txt(p, s, xc - larg(s, f, sz, tr) / 2, top, f, sz, c, tr);
  const traco = (p: PDFPage, x1: number, t1: number, x2: number, t2: number, th: number, c: RGB) => p.drawLine({ start: { x: x1, y: Y(t1) }, end: { x: x2, y: Y(t2) }, thickness: th, color: c });
  const tick = (p: PDFPage, x: number, top: number, a: number, c: RGB, th = 0.75) => traco(p, x - a, top + a, x + a, top - a, th, c);
  const rotulo = (p: PDFPage, s: string, x: number, top: number, c = C.MUT, bold = false, sz = 6.5) => txt(p, String(s).toUpperCase(), x, top, bold ? FB : F, sz, c, 1.3);
  const caixa = (p: PDFPage, x: number, top: number, w: number, h: number, o: { fundo?: RGB; borda?: RGB; barra?: RGB; topo?: RGB } = {}) => {
    p.drawRectangle({ x, y: Y(top + h), width: w, height: h, color: o.fundo, borderColor: o.borda, borderWidth: o.borda ? 0.75 : 0 });
    if (o.barra) p.drawRectangle({ x, y: Y(top + h), width: 2.5, height: h, color: o.barra });
    if (o.topo) p.drawRectangle({ x, y: Y(top + 1.5), width: w, height: 1.5, color: o.topo });
  };
  const linhaRica = (p: PDFPage, ps: Palavra[], x: number, top: number, sz: number, c: RGB) => {
    const esp = F.widthOfTextAtSize(' ', sz); let xx = x;
    ps.forEach((w, i) => {
      if (i > 0 && !w.colada) xx += esp;
      const f = w.b ? FB : F; p.drawText(w.t, { x: xx, y: Y(top), size: sz, font: f, color: c }); xx += f.widthOfTextAtSize(w.t, sz);
    });
  };

  const embed = async (im: ImagemBytes | null) => {
    if (!im) return null;
    try { return im.png ? await pdf.embedPng(im.bytes) : await pdf.embedJpg(im.bytes); } catch (err) { console.warn('imagem', err); return null; }
  };
  const logo = await embed(d.logo);
  const fotos: (PDFImage | null)[] = [];
  for (const f of d.fotos) fotos.push(await embed(f));
  // Foto a preencher a moldura (corta o que sobra, ao centro): fotos ao alto deixam de ficar pequenas.
  const fotoCoberta = (p: PDFPage, img: PDFImage, x: number, top: number, w: number, h: number) => {
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    p.pushOperators(pushGraphicsState(), rectangle(x, Y(top + h), w, h), clip(), endPath());
    p.drawImage(img, { x: x + (w - iw) / 2, y: Y(top + (h + ih) / 2), width: iw, height: ih });
    p.pushOperators(popGraphicsState());
  };
  const legenda = (n: number) => (d.leitura?.fotos || []).find((f) => f.n === n)?.descricao || '';
  const legendaFoto = (p: PDFPage, n: number, x: number, top: number, w: number, linhas = 3) => {
    const et = `FOTO ${n}`;
    rotulo(p, et, x, top, C.INK, true);
    const desc = legenda(n);
    if (!desc) return top;
    const x2 = x + larg(et, FB, 6.5, 1.3) + 6;
    const ls = quebrar(desc, F, 7.5, w - (x2 - x));
    ls.slice(0, linhas).forEach((ln, i) => txt(p, i === linhas - 1 && ls.length > linhas ? ln.replace(/\s*\S*$/, ' ...') : ln, x2, top + i * 9.5, F, 7.5, C.MUT));
    return top + Math.min(ls.length, linhas) * 9.5;
  };

  return { pdf, F, FB, FI, C, e, val, dataP, fim, Y, larg, txt, txtR, txtC, traco, tick, rotulo, caixa, linhaRica, logo, fotos, fotoCoberta, legendaFoto };
}
type Base = Awaited<ReturnType<typeof preparar>>;

// Páginas corridas com cabeçalho e quebra automática.
function corrido(b: Base, cabecalho: (p: PDFPage) => void) {
  const TOPO = 82, FUNDO = H - 72;
  const s = { page: null as unknown as PDFPage, y: 0 };
  const novaPagina = () => { s.page = b.pdf.addPage([W, H]); s.y = TOPO; cabecalho(s.page); };
  const precisa = (h: number) => { if (s.y + h > FUNDO) novaPagina(); };
  const paragrafo = (texto: string, { font = b.F, size = 9.5, color = b.C.INK, x = M, w = W - 2 * M, lh = 13.5, depois = 6, rico = false }: { font?: PDFFont; size?: number; color?: RGB; x?: number; w?: number; lh?: number; depois?: number; rico?: boolean } = {}) => {
    for (const raw of String(texto ?? '').split(/\n+/)) {
      if (!raw.trim()) continue;
      if (rico) for (const ln of quebrarRico(raw, b.F, b.FB, size, w)) { precisa(lh); b.linhaRica(s.page, ln, x, s.y + lh * 0.75, size, color); s.y += lh; }
      else for (const ln of quebrar(raw, font, size, w)) { precisa(lh); b.txt(s.page, ln, x, s.y + lh * 0.75, font, size, color); s.y += lh; }
      s.y += depois;
    }
  };
  const marcadores = (itens: string[], { x = M, w = W - 2 * M, size = 9.5 } = {}) => {
    for (const it of itens) {
      const ls = quebrarRico(it, b.F, b.FB, size, w - 16);
      precisa(ls.length * 13.3 + 5);
      b.tick(s.page, x + 4, s.y + 7, 2.6, b.C.BR, 0.9);
      ls.forEach((ln) => { b.linhaRica(s.page, ln, x + 16, s.y + 10, size, b.C.INK); s.y += 13.3; });
      s.y += 5;
    }
    s.y += 4;
  };
  return { s, TOPO, FUNDO, novaPagina, precisa, paragrafo, marcadores };
}

export async function gerarPDF(d: DadosPDF): Promise<{ bytes: Uint8Array; paginas: number }> {
  const b = await preparar(d);
  if (d.modelo === 'completo') await completo(b, d); else await rapido(b, d);
  return { bytes: await b.pdf.save(), paginas: b.pdf.getPageCount() };
}

/* ============ modelo rápido ============ */
async function rapido(b: Base, d: DadosPDF) {
  const { F, FB, C, e, val, dataP, fim, txt, txtR, txtC, traco, tick, rotulo, logo, fotos, fotoCoberta, legendaFoto, larg } = b;
  const T = d.totais;

  /* ----- capa ----- */
  const capa = b.pdf.addPage([W, H]);
  const marca = partesMarca(e.nome || '');
  if (logo) {
    const s = Math.min(170 / logo.width, 56 / logo.height, 1);
    capa.drawImage(logo, { x: M, y: b.Y(M + logo.height * s), width: logo.width * s, height: logo.height * s });
  } else if (marca.sub) {
    txt(capa, marca.main, M, M + 15, FB, 20, C.INK, 3.2);
    txt(capa, marca.sub.toUpperCase(), M, M + 27, F, 6.5, C.MUT, 1.4);
  } else {
    quebrar(e.nome || 'Empresa', FB, 15, 300).slice(0, 2).forEach((ln, i) => txt(capa, ln, M, M + 12 + i * 18, FB, 15, C.INK, 0.3));
  }
  [e.telefone, e.email, e.site].filter(Boolean).forEach((s, i) => txtR(capa, s, W - M, M + 7 + i * 11, F, 8, C.MUT));
  traco(capa, M, 117, W - M, 117, 0.75, C.HAIR);

  let t = 228;
  if (d.exemplo) {
    const et = 'EXEMPLO · VALORES FICTÍCIOS';
    const lw = larg(et, FB, 7, 1.2) + 16;
    capa.drawRectangle({ x: W - M - lw, y: b.Y(t + 6), width: lw, height: 17, borderColor: C.CRIT, borderWidth: 0.9 });
    txt(capa, et, W - M - lw + 8, t, FB, 7, C.CRIT, 1.2);
  }
  txt(capa, 'PROPOSTA DE ORÇAMENTO', M, t, FB, 7.5, C.BR, 1.5);
  const tl = quebrarEquilibrado(d.orc.titulo || maiuscula(descObra(d.pedido.tipo)), FB, 34, 410).slice(0, 3);
  t += 43;
  tl.forEach((ln, i) => txt(capa, ln, M, t + i * 36, FB, 34, C.INK, -0.5));
  t += (tl.length - 1) * 36;
  if (d.pedido.localidade) { t += 29; txt(capa, quebrar(d.pedido.localidade, F, 13, W - 2 * M)[0], M, t, F, 13, C.MUT); }
  t += 51;
  t = reguaValidade(b, capa, t);
  t += 38;
  traco(capa, M, t, W - M, t, 0.75, C.HAIR);
  const metas: [string, string][] = [['Proposta n.º', d.meta.numero || '-'], ['Dono de obra', d.pedido.dono || '-'], d.meta.prazo ? ['Prazo indicativo', d.meta.prazo] : ['Data', fmtData(dataP)], ['Total com IVA', fmtEUR(T.total)]];
  const colW = (W - 2 * M) / 4;
  metas.forEach(([k, v], i) => {
    const x = M + i * colW;
    rotulo(capa, k, x, t + 18);
    quebrar(v, FB, 10.5, colW - 12).slice(0, 2).forEach((ln, j) => txt(capa, ln, x, t + 34 + j * 13, FB, 10.5, C.INK));
  });
  const fr = H - M - 32;
  const legais = [e.nome, e.nif ? `NIF ${e.nif}` : '', e.alvara ? `Alvará/registo ${e.alvara}` : '', e.seguro ? textoSeguro(e.seguro) : ''].filter(Boolean).join('  ·  ');
  traco(capa, M, fr, W - M, fr, 0.75, C.HAIR);
  let ft = fr + 15;
  if (e.morada) { txt(capa, quebrar(e.morada, F, 7, W - 2 * M)[0], M, ft, F, 7, C.MUT); ft += 10; }
  if (legais) quebrar(legais, F, 7, W - 2 * M).slice(0, 2).forEach((ln, i) => txt(capa, ln, M, ft + i * 10, F, 7, C.MUT));
  const foto0 = fotos.find(Boolean);
  const fTop = t + 65, fBot = fr - 40;
  if (foto0 && fBot - fTop > 120) {
    fotoCoberta(capa, foto0, M, fTop, W - 2 * M, fBot - fTop);
    legendaFoto(capa, fotos.indexOf(foto0) + 1, M, fBot + 13, W - 2 * M, 2);
  }

  /* ----- páginas de conteúdo ----- */
  const k = corrido(b, (p) => {
    txt(p, (e.nome || '').toUpperCase(), M, 44, FB, 7, C.INK, 1.4);
    txtR(p, `PROPOSTA N.º ${d.meta.numero || '-'}`, W - M, 44, F, 7, C.MUT, 1.4);
    if (d.exemplo) txtC(p, 'EXEMPLO · VALORES FICTÍCIOS', W / 2, 44, FB, 7, C.CRIT, 1.4);
    traco(p, M, 52, W - M, 52, 0.75, C.HAIR);
  });
  const { s, paragrafo, marcadores, precisa, novaPagina } = k;
  const titulo = (n: number, tt: string, minimo = 90) => {
    const margem = s.y > k.TOPO + 1 ? 30 : 0;
    if (s.y + margem + minimo > k.FUNDO) novaPagina(); else s.y += margem;
    txt(s.page, String(n).padStart(2, '0'), M, s.y + 13, FB, 9, C.BR, 1.4);
    txt(s.page, tt, M + 27, s.y + 13, FB, 16, C.INK, -0.2);
    s.y += 34;
  };
  const subtitulo = (tt: string, nn?: string) => {
    precisa(60);
    s.y += 8;
    let x = M;
    if (nn) { txt(s.page, nn, M, s.y + 9.5, FB, 9.5, C.BR); x = M + 27; }
    txt(s.page, tt, x, s.y + 9.5, FB, 9.5, C.INK);
    s.y += 19;
  };
  const AVISO = 'Os valores apresentados são estimativas, baseadas nas fotografias e nas informações recebidas até esta data, e ficam sujeitos a confirmação em visita técnica e medição. Os trabalhos não descritos nesta proposta não estão incluídos.';
  const caixaAviso = () => {
    const ls = quebrar(AVISO, F, 9, W - 2 * M - 32);
    const h = ls.length * 13 + 15;
    precisa(h + 8);
    b.caixa(s.page, M, s.y, W - 2 * M, h, { borda: C.HAIR, barra: C.BR });
    ls.forEach((ln, i) => txt(s.page, ln, M + 16, s.y + 19 + i * 13 - 2, F, 9, C.INK));
    s.y += h + 14;
  };
  const caixaTotais = () => {
    const rows: [string, string, boolean?][] = [];
    if (T.imp) { rows.push(['Trabalhos', fmtEUR(T.base)]); rows.push([`Imprevistos (${fmtN(T.pct, 0)}%)`, fmtEUR(T.imp)]); }
    rows.push(['Total sem IVA', fmtEUR(T.semIva), true]);
    T.ivas.forEach((x) => rows.push([T.ivas.length > 1 ? `IVA ${fmtN(x.taxa, 0)}% sobre ${fmtEUR(x.base)}` : `IVA ${fmtN(x.taxa, 0)}%`, fmtEUR(x.valor)]));
    const rh = 18.5, w = 240, x0 = W - M - w;
    precisa(rows.length * rh + 58);
    s.y += 18;
    rows.forEach(([kk, v, forte], i) => {
      txt(s.page, kk, x0, s.y + 12.5, forte ? FB : F, 9, forte ? C.INK : C.MUT);
      txtR(s.page, v, W - M, s.y + 12.5, forte ? FB : F, 9, C.INK);
      s.y += rh;
      if (i < rows.length - 1) traco(s.page, x0, s.y, W - M, s.y, 0.5, C.HAIR);
    });
    s.y += 3;
    traco(s.page, x0, s.y, W - M, s.y, 1.2, C.BR);
    s.y += 19;
    txt(s.page, 'Total com IVA', x0, s.y, FB, 10.5, C.INK);
    txtR(s.page, fmtEUR(T.total), W - M, s.y, FB, 13, C.INK);
    s.y += 12;
  };

  // 01 Resumo
  novaPagina();
  titulo(1, 'Resumo');
  paragrafo(`Proposta para ${descObra(d.pedido.tipo)}${d.pedido.localidade ? ' em ' + d.pedido.localidade : ''}${d.pedido.dono ? ', preparada para ' + d.pedido.dono : ''}. Inclui:`);
  marcadores(d.orc.capitulos.map((c) => c.nome));
  caixaTotais();
  s.y += 18;
  if (d.meta.prazo) paragrafo(`Prazo indicativo: ${d.meta.prazo}.`, { depois: 0 });
  paragrafo(`Validade da proposta: ${val} dias, até ${fmtData(fim)}.`, { depois: 12 });
  caixaAviso();

  // 02 Descrição dos trabalhos
  titulo(2, 'Descrição dos trabalhos');
  d.orc.capitulos.forEach((c, i) => { subtitulo(c.nome, pad(i + 1)); paragrafo(c.descricao || c.linhas.map((l) => l.descricao).join('; ') + '.', { x: M + 27, w: W - 2 * M - 27, depois: 8 }); });

  // 03 Mapa de quantidades e preços
  titulo(3, 'Mapa de quantidades e preços', 130);
  tabelaLinhas(b, k, d.orc.capitulos, { precos: true, ivaColuna: T.ivas.length > 1, subtotais: true });
  caixaTotais();

  // 04 Não incluído
  const naoIncl = semIva(d.orc.nao_incluido.length ? d.orc.nao_incluido : String(e.nunca_inclui || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean));
  let n = 4;
  if (naoIncl.length) { titulo(n++, 'Não incluído'); marcadores(naoIncl); }

  // 05 Pressupostos e pontos a confirmar
  if (d.orc.pressupostos.length || d.orc.a_confirmar.length) {
    titulo(n++, 'Pressupostos e pontos a confirmar');
    if (d.orc.pressupostos.length) { subtitulo('Pressupostos'); marcadores(semIva(d.orc.pressupostos)); }
    if (d.orc.a_confirmar.length) { subtitulo('A confirmar na visita técnica'); marcadores(d.orc.a_confirmar); }
  }

  // 06 Condições
  titulo(n++, 'Condições');
  const taxas = T.ivas.map((x) => `${fmtN(x.taxa, 0)}%`);
  tabelaCondicoes(b, k, [
    ['Pagamento', textoPagamento(d, true)],
    ['Validade', `${val} dias, até ${fmtData(fim)}.`],
    ['Prazo', d.meta.prazo || e.prazo || ''],
    ['Garantia', [e.garantia, e.garantia_texto].filter(Boolean).join('. ')],
    ['Seguro', textoSeguroCompleto(e)],
    ['IVA', taxas.length ? `Taxa${taxas.length > 1 ? 's' : ''} de ${taxas.join(' e ')}, incluída${taxas.length > 1 ? 's' : ''} no total com IVA.` : ''],
    ['Deslocação e entulho', e.extras || ''],
    ['Alvará ou registo', e.alvara || '']
  ]);

  // 07 Fotografias
  const comFoto = fotos.map((img, i) => ({ img, i })).filter((x): x is { img: PDFImage; i: number } => !!x.img);
  if (comFoto.length) {
    titulo(n++, 'Fotografias do estado atual');
    grelhaFotos(b, k, comFoto.map((x) => x.i + 1));
  }

  // 08 Aceitação
  titulo(n++, 'Aceitação');
  paragrafo(`Aceito a proposta n.º ${d.meta.numero || '-'}${e.nome ? ' de ' + e.nome : ''}, nas condições descritas.`, { depois: 14 });
  precisa(130);
  ['Nome', 'Data', 'Assinatura'].forEach((kk, i) => {
    const bb = s.y + 26 + i * 40;
    rotulo(s.page, kk, M, bb);
    traco(s.page, M + 80, bb + 2, M + 330, bb + 2, 0.6, C.INK);
  });
  s.y += 140;

  /* ----- rodapés ----- */
  const todas = b.pdf.getPages();
  todas.forEach((p, i) => {
    if (i === 0) return;
    traco(p, M, H - 56, W - M, H - 56, 0.5, C.HAIR);
    txt(p, 'Valores estimados, sujeitos a confirmação em visita técnica e medição.', M, H - 44, F, 7, C.MUT);
    txtR(p, `Página ${i + 1} de ${todas.length}`, W - M, H - 44, F, 7, C.MUT);
    if (e.rodape) txtC(p, `Preparado com ${PRODUTO}`, W / 2, H - 30, F, 6.5, C.MUT);
  });
}

/* ============ modelo completo ============ */
async function completo(b: Base, d: DadosPDF) {
  const { F, FB, FI, C, e, val, dataP, fim, txt, txtR, txtC, traco, rotulo, caixa, logo, fotos, fotoCoberta, legendaFoto } = b;
  const T = d.totais, o = d.orc;
  const fases = resumoFases(o, e);
  const variasFases = fases.length > 1;
  const plano = planoPagamentos(o, e);
  const titulo = o.titulo || maiuscula(descObra(d.pedido.tipo));
  const marca = partesMarca(e.nome || '');
  const detalhado = d.mostrarPrecos === 'detalhado';
  const vg = (v: number) => `${fmtEUR(v)}`;
  const existe = (n: number) => !!fotos[n - 1];

  const desenhaLogo = (p: PDFPage, x: number, top: number, maxW: number, maxH: number, centro = false) => {
    if (logo) {
      const s = Math.min(maxW / logo.width, maxH / logo.height, 1), w = logo.width * s, h = logo.height * s;
      p.drawImage(logo, { x: centro ? x - w / 2 : x, y: b.Y(top + h), width: w, height: h });
      return h;
    }
    const sz = Math.min(28, maxH * 0.55);
    if (centro) txtC(p, marca.main || e.nome || 'Empresa', x, top + sz, FB, sz, C.INK, sz * 0.12);
    else txt(p, marca.main || e.nome || 'Empresa', x, top + sz, FB, sz, C.INK, sz * 0.12);
    if (marca.sub) (centro ? txtC : txt)(p, marca.sub.toUpperCase(), x, top + sz + 13, F, sz * 0.28, C.MUT, 1.4);
    return sz + (marca.sub ? 16 : 0);
  };

  /* ----- capa institucional ----- */
  const c0 = b.pdf.addPage([W, H]);
  for (const [x, y] of [[-40, H - 150], [W - 200, 90]] as const) {
    c0.drawRectangle({ x, y, width: 170, height: 170, color: C.BR_CLARO, rotate: degrees(45), opacity: 0.55 });
  }
  c0.drawLine({ start: { x: 0, y: H - 300 }, end: { x: 300, y: H }, thickness: 0.8, color: C.BR });
  c0.drawLine({ start: { x: W - 300, y: 0 }, end: { x: W, y: 300 }, thickness: 0.8, color: C.BR });
  const hl = desenhaLogo(c0, W / 2, 300, 380, 140, true);
  const ty = 300 + hl + 80;
  txtC(c0, 'PROPOSTA DE ORÇAMENTO', W / 2, ty, F, 17, C.INK, 4);
  traco(c0, W / 2 - 50, ty + 26, W / 2 + 50, ty + 26, 1, C.BR);
  if (d.exemplo) txtC(c0, 'EXEMPLO · VALORES FICTÍCIOS', W / 2, ty + 56, FB, 8, C.CRIT, 1.4);

  /* ----- capa da obra ----- */
  const c1 = b.pdf.addPage([W, H]);
  let hTopo = desenhaLogo(c1, M, M - 6, 190, 52);
  if (e.slogan) { txt(c1, e.slogan, M, M - 6 + hTopo + 15, FI, 11, C.INK); hTopo += 20; }
  [[e.nome, FB], [e.nif ? `NIF ${e.nif}` : '', F], [e.morada, F], [e.telefone ? `Tlm. ${e.telefone}` : '', F], [e.email, F]].filter((x) => x[0]).forEach(([s, f], i) => txtR(c1, String(s), W - M, M + 2 + i * 11, f as PDFFont, 7.5, i ? C.MUT : C.INK));
  const linhaTopo = Math.max(M + hTopo + 10, M + 62);
  traco(c1, M, linhaTopo, W - M, linhaTopo, 0.75, C.HAIR);
  let t = linhaTopo + 46;
  rotulo(c1, 'Proposta de orçamento', M, t, C.BR, true, 7.5);
  const tl = quebrarEquilibrado(titulo, FB, 30, W - 2 * M).slice(0, 2);
  t += 36;
  tl.forEach((ln, i) => txt(c1, ln, M, t + i * 33, FB, 30, C.INK, -0.5));
  t += (tl.length - 1) * 33;
  if (d.pedido.localidade) { t += 26; txt(c1, quebrar(d.pedido.localidade, F, 11.5, W - 2 * M)[0], M, t, F, 11.5, C.MUT); }
  t += 42;
  t = reguaValidade(b, c1, t);
  t += 30;
  traco(c1, M, t, W - M, t, 0.75, C.HAIR);
  const execucao = variasFases ? `Em ${fases.length} fases` : d.meta.prazo || o.prazo || '-';
  const metas: [string, string][] = [['Proposta n.º', d.meta.numero || '-'], d.pedido.dono ? ['Aos cuidados de', d.pedido.dono] : ['Data', fmtData(dataP)], [variasFases ? 'Execução' : 'Prazo indicativo', execucao], ['Valor global', `${vg(T.semIva)} + IVA`]];
  const colW = (W - 2 * M) / 4;
  metas.forEach(([k, v], i) => {
    const x = M + i * colW;
    rotulo(c1, k, x, t + 18);
    quebrar(v, FB, 10, colW - 10).slice(0, 2).forEach((ln, j) => txt(c1, ln, x, t + 34 + j * 12.5, FB, 10, C.INK));
  });
  const fr = H - M - 20;
  const fTop = t + 60, fBot = fr - 42;
  const capaN = fotos.findIndex(Boolean);
  if (capaN >= 0 && fBot - fTop > 120) {
    fotoCoberta(c1, fotos[capaN]!, M, fTop, W - 2 * M, fBot - fTop);
    legendaFoto(c1, capaN + 1, M, fBot + 13, W - 2 * M, 2);
  }
  traco(c1, M, fr, W - M, fr, 0.75, C.HAIR);
  let fx = M;
  if (e.garantia) { const g = `Garantia de ${e.garantia}`; txt(c1, g, fx, fr + 15, FB, 7, C.BR); fx += b.larg(g, FB, 7) + 4; }
  if (e.seguro) txt(c1, `${e.garantia ? '· ' : ''}Seguro de responsabilidade civil ${e.seguro.replace(/^seguro\s*/i, '')}`, fx, fr + 15, F, 7, C.MUT);
  txtR(c1, 'Valores sem IVA', W - M, fr + 15, F, 7, C.MUT);

  /* ----- páginas corridas ----- */
  const k = corrido(b, (p) => {
    if (logo) { const s = Math.min(70 / logo.width, 13 / logo.height); p.drawImage(logo, { x: M, y: b.Y(48), width: logo.width * s, height: logo.height * s }); }
    else txt(p, (marca.main || e.nome || '').toUpperCase(), M, 46, FB, 7.5, C.INK, 1.4);
    txtR(p, `PROPOSTA N.º ${d.meta.numero || '-'}`, W - M, 46, F, 7, C.MUT, 1.6);
    if (d.exemplo) txtC(p, 'EXEMPLO · VALORES FICTÍCIOS', W / 2, 46, FB, 7, C.CRIT, 1.4);
    traco(p, M, 54, W - M, 54, 0.75, C.HAIR);
  });
  const { s, paragrafo, marcadores, precisa, novaPagina } = k;
  let secao = 1;
  const tituloSecao = (tt: string, nova = true) => {
    if (nova) novaPagina(); else { s.y += 26; precisa(110); }
    txt(s.page, pad(secao++), M, s.y + 15, FB, 9.5, C.BR, 1.2);
    txt(s.page, tt, M + 27, s.y + 15, FB, 17, C.INK, -0.3);
    s.y += 36;
  };
  const subtitulo = (tt: string) => { precisa(50); s.y += 6; txt(s.page, tt, M, s.y + 10, FB, 10, C.INK); s.y += 20; };
  const caixaValor = (rot: string, sub: string, valor: string) => {
    const h = 62;
    precisa(h + 14);
    s.y += 8;
    caixa(s.page, M, s.y, W - 2 * M, h, { borda: C.HAIR, barra: C.BR });
    rotulo(s.page, rot, M + 20, s.y + 22);
    if (sub) txt(s.page, sub, M + 20, s.y + 40, F, 9, C.MUT);
    const v = valor, w1 = b.larg(v, FB, 17), w2 = b.larg(' + IVA', F, 8.5);
    txt(s.page, v, W - M - 20 - w2 - w1, s.y + 38, FB, 17, C.INK, -0.3);
    txt(s.page, ' + IVA', W - M - 20 - w2, s.y + 38, F, 8.5, C.MUT);
    s.y += h + 12;
  };

  // 01 Apresentação
  tituloSecao('Apresentação');
  // "Lisboa, 22 de outubro de 2026" só quando a localidade é só a cidade; com morada fica só a data
  const local = /^[\p{L} ]{2,30}$/u.test((d.pedido.localidade || '').trim()) && !/\b(rua|av|avenida|travessa|largo|praça|estrada)\b/i.test(d.pedido.localidade) ? d.pedido.localidade.trim() : '';
  txtR(s.page, `${local ? local + ', ' : ''}${dataExtenso(dataP)}`, W - M, s.y + 8, F, 9, C.MUT);
  s.y += 26;
  if (o.apresentacao.trim()) paragrafo(o.apresentacao.replace(/\n{2,}/g, '\n'), { rico: true, lh: 14, depois: 8 });
  else paragrafo(`Apresentamos a nossa proposta para ${descObra(d.pedido.tipo)}${d.pedido.localidade ? ' em ' + d.pedido.localidade : ''}, preparada a partir da visita e das fotografias da obra.`);
  // valor global
  {
    const frase = variasFases
      ? `Adjudicação na totalidade, com a execução e os pagamentos repartidos por **${fases.length} fases**: ${fases.map((f) => (f.titulo || `Fase ${f.n}`).toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' e $1')}.`
      : `Valor global fechado para os trabalhos descritos${d.meta.prazo ? `, com prazo indicativo de ${d.meta.prazo}` : ''}.`;
    const ls = quebrarRico(frase, F, FB, 9.5, W - 2 * M - 40);
    const h = 66 + ls.length * 13.5;
    precisa(h + 16);
    s.y += 6;
    caixa(s.page, M, s.y, W - 2 * M, h, { borda: C.HAIR, barra: C.BR });
    rotulo(s.page, 'Valor global da proposta', M + 20, s.y + 22);
    const v = vg(T.semIva);
    txt(s.page, v, M + 20, s.y + 46, FB, 19, C.INK, -0.3);
    txt(s.page, ' + IVA', M + 20 + b.larg(v, FB, 19, -0.3), s.y + 46, F, 9, C.MUT);
    ls.forEach((ln, i) => b.linhaRica(s.page, ln, M + 20, s.y + 66 + i * 13.5, 9.5, C.INK));
    s.y += h + 18;
  }
  const garantias = [
    e.garantia ? `**Garantia de ${e.garantia}** sobre os trabalhos executados.` : '',
    e.seguro ? `**Seguro de responsabilidade civil**${textoSeguroCompleto(e) ? ': ' + textoSeguroCompleto(e) : ''}.` : '',
    'Um único responsável por toda a intervenção.',
    'Valor global fechado para os trabalhos descritos: nenhum trabalho extra avança sem a sua aprovação.',
    variasFases ? `Pagamentos repartidos pelas ${fases.length} fases, ao ritmo da obra.` : ''
  ].filter(Boolean);
  subtitulo('O que garantimos');
  marcadores(garantias);
  precisa(100); // despedida e assinatura sempre juntas
  paragrafo('Estamos disponíveis para esclarecer qualquer questão.', { depois: 10 });
  paragrafo('Com os melhores cumprimentos,', { depois: 14 });
  precisa(40);
  if (e.assinante) { txt(s.page, e.assinante, M, s.y + 10, FB, 10, C.INK); s.y += 16; }
  txt(s.page, [e.nome, e.nif ? `NIF ${e.nif}` : '', e.telefone].filter(Boolean).join(' · '), M, s.y + 10, F, 9, C.MUT);
  s.y += 20;

  // 02 Resumo da proposta
  tituloSecao('Resumo da proposta');
  paragrafo(`${o.capitulos.length === 1 ? 'Um orçamento com 1 capítulo' : `Um orçamento único, com ${o.capitulos.length} capítulos`}. Cada capítulo tem o seu valor global e a soma de todos forma o valor da proposta${variasFases ? ', adjudicada na totalidade' : ''}.`, { depois: 10 });
  {
    const cols = variasFases
      ? [{ t: 'Cap.', x: M, w: 30 }, { t: 'Capítulo', x: M + 30, w: 0 }, { t: 'Fase', x: 0, w: 46 }, { t: 'Prazo indicativo', x: 0, w: 90 }, { t: 'Valor global', x: 0, w: 80 }]
      : [{ t: 'Cap.', x: M, w: 30 }, { t: 'Capítulo', x: M + 30, w: 0 }, { t: 'Prazo indicativo', x: 0, w: 100 }, { t: 'Valor global', x: 0, w: 80 }];
    const fixo = cols.reduce((a, c) => a + c.w, 0);
    cols[1].w = W - 2 * M - fixo;
    let cx = M; cols.forEach((c) => { c.x = cx; cx += c.w; });
    precisa(40);
    cols.forEach((c, i) => (i === cols.length - 1 ? txtR(s.page, c.t.toUpperCase(), c.x + c.w, s.y + 8, F, 6.5, C.MUT, 1.2) : rotulo(s.page, c.t, c.x, s.y + 8)));
    s.y += 14; traco(s.page, M, s.y, W - M, s.y, 0.9, C.INK);
    o.capitulos.forEach((c, i) => {
      const nome = quebrar(c.nome + (c.subtitulo ? ` — ${c.subtitulo}` : ''), F, 9.5, cols[1].w - 8);
      const h = 14 + nome.length * 12;
      precisa(h);
      const bl = s.y + 16;
      txt(s.page, pad(i + 1), cols[0].x, bl, FB, 9, C.BR);
      nome.forEach((ln, j) => txt(s.page, ln, cols[1].x, bl + j * 12, F, 9.5, C.INK));
      let ci = 2;
      if (variasFases) txt(s.page, `Fase ${c.fase || 1}`, cols[ci++].x, bl, F, 8.5, C.MUT);
      txt(s.page, quebrar(c.prazo || '-', F, 8.5, cols[ci].w - 6)[0], cols[ci].x, bl, F, 8.5, C.MUT);
      txtR(s.page, vg(valorCapitulo(c, o, e)), W - M, bl, FB, 9.5, C.INK);
      s.y += h; traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
    });
    precisa(70);
    s.y += 24;
    txt(s.page, 'Valor global da proposta', cols[1].x, s.y, FB, 11, C.INK);
    txtR(s.page, vg(T.semIva), W - M, s.y, FB, 15, C.INK);
    s.y += 16;
    const ivaTxt = T.ivas.map((x) => `IVA ${fmtN(x.taxa, 0)}%: ${fmtEUR(x.valor)}`).join(' · ');
    txtR(s.page, `VALORES SEM IVA${ivaTxt ? ` · ${ivaTxt.toUpperCase()} · TOTAL COM IVA: ${fmtEUR(T.total)}` : ''}`, W - M, s.y, F, 6.5, C.MUT, 1);
    s.y += 18;
  }
  if (variasFases) {
    subtitulo(`Execução em ${fases.length} fases`);
    paragrafo(`A ordem dos trabalhos conta: ${fases.map((f) => (f.titulo || `fase ${f.n}`).toLowerCase()).join(', depois ').replace(/, depois ([^,]*)$/, ' e, por fim, $1')}. O calendário das fases é acordado consigo e os pagamentos acompanham a obra, fase a fase.`, { depois: 10 });
    const n = fases.length, gap = 12, cw = (W - 2 * M - gap * (Math.min(n, 3) - 1)) / Math.min(n, 3);
    for (let i = 0; i < n; i += 3) {
      const linha = fases.slice(i, i + 3);
      const alturas = linha.map((f) => 30 + quebrar(f.titulo || `Fase ${f.n}`, FB, 10.5, cw - 28).length * 13 + quebrar(f.descricao, F, 8, cw - 28).length * 10.5 + 52);
      const h = Math.max(...alturas);
      precisa(h + 12);
      linha.forEach((f, j) => {
        const x = M + j * (cw + gap);
        caixa(s.page, x, s.y, cw, h, { borda: C.HAIR, topo: C.BR });
        let yy = s.y + 20;
        rotulo(s.page, `Fase ${f.n}`, x + 14, yy, C.BR, true);
        yy += 16;
        quebrar(f.titulo || `Fase ${f.n}`, FB, 10.5, cw - 28).forEach((ln) => { txt(s.page, ln, x + 14, yy, FB, 10.5, C.INK); yy += 13; });
        quebrar(f.descricao, F, 8, cw - 28).forEach((ln) => { txt(s.page, ln, x + 14, yy, F, 8, C.MUT); yy += 10.5; });
        txt(s.page, `Capítulo${f.capitulos.length > 1 ? 's' : ''} ${f.capitulos.join(', ').replace(/, (\d+)$/, ' e $1')}`, x + 14, s.y + h - 32, F, 7.5, C.MUT);
        txt(s.page, vg(f.valor), x + 14, s.y + h - 13, FB, 13, C.INK);
      });
      s.y += h + 12;
    }
  }

  // 03 O que encontrámos
  let nEnc = (o.fotos_encontramos.length ? o.fotos_encontramos : fotos.map((_, i) => i + 1)).filter(existe).slice(0, 6);
  if (nEnc.length > 2 && nEnc.length % 2) nEnc = nEnc.slice(0, -1); // número par: nenhuma foto fica sozinha numa linha
  if (o.encontramos.trim() || nEnc.length) {
    tituloSecao('O que encontrámos');
    if (o.encontramos.trim()) paragrafo(o.encontramos, { rico: true, depois: 10 });
    grelhaFotos(b, k, nEnc, 150);
  }

  // Capítulos: um por página
  o.capitulos.forEach((c, ci) => {
    novaPagina();
    rotulo(s.page, `Capítulo ${ci + 1}`, M, s.y + 6, C.BR, true, 7);
    s.y += 14;
    quebrar(c.nome, FB, 20, W - 2 * M).slice(0, 2).forEach((ln) => { txt(s.page, ln, M, s.y + 20, FB, 20, C.INK, -0.4); s.y += 24; });
    if (c.subtitulo) { txt(s.page, c.subtitulo, M, s.y + 12, F, 11, C.MUT); s.y += 18; }
    s.y += 10;
    if (c.descricao) paragrafo(c.descricao, { rico: true, depois: 10 });
    const fc = c.fotos.filter(existe).slice(0, 2);
    if (fc.length === 1 && c.estado.length) {
      // uma foto: à esquerda, com o estado atual ao lado (como na proposta MMGS)
      const gap = 20, cw = (W - 2 * M - gap) / 2, ch = 150;
      precisa(ch + 40);
      const topo = s.y;
      fotoCoberta(s.page, fotos[fc[0] - 1]!, M, topo, cw, ch);
      const fimLegenda = legendaFoto(s.page, fc[0], M, topo + ch + 12, cw, 2);
      const xe = M + cw + gap, we = W - M - xe;
      let ye = topo + 4;
      txt(s.page, 'Estado atual', xe, ye + 10, FB, 10, C.INK); ye += 22;
      for (const it of c.estado) {
        const ls = quebrarRico(it, F, FB, 9, we - 14);
        if (ye + ls.length * 12.5 > topo + ch + 40) break;
        b.tick(s.page, xe + 4, ye + 6, 2.4, C.BR, 0.9);
        ls.forEach((ln) => { b.linhaRica(s.page, ln, xe + 14, ye + 9, 9, C.INK); ye += 12.5; });
        ye += 4;
      }
      s.y = Math.max(fimLegenda, ye) + 16;
    } else if (fc.length) {
      const gap = 16, cw = (W - 2 * M - gap) / 2, ch = 150;
      precisa(ch + 40);
      fc.forEach((n, j) => {
        const x = M + j * (cw + gap);
        fotoCoberta(s.page, fotos[n - 1]!, x, s.y, cw, ch);
        legendaFoto(s.page, n, x, s.y + ch + 12, cw, 2);
      });
      s.y += ch + 36;
    }
    if (c.estado.length && !(fc.length === 1)) { subtitulo('Estado atual'); marcadores(c.estado); }
    subtitulo('Trabalhos incluídos');
    tabelaLinhas(b, k, [c], { precos: detalhado, ivaColuna: detalhado && T.ivas.length > 1, subtotais: false, numeroCap: ci + 1 });
    caixaValor('Valor global do capítulo', [variasFases ? `Fase ${c.fase || 1}` : '', c.prazo ? `prazo indicativo: ${c.prazo}` : ''].filter(Boolean).join(' · '), vg(valorCapitulo(c, o, e)));
    const naoCap = semIva(c.nao_incluido);
    if (naoCap.length) precisa(quebrarRico(`**Não incluído:** ${naoCap.join('; ')}.`, F, FB, 8.5, W - 2 * M).length * 12.5 + 8);
    if (naoCap.length) paragrafo(`**Não incluído:** ${naoCap.join('; ').replace(/\.$/, '')}.`, { rico: true, size: 8.5, lh: 12.5 });
  });

  // 04 Condições gerais
  tituloSecao('Condições gerais');
  if (e.garantia || e.seguro) {
    const gap = 14, cw = (W - 2 * M - gap) / 2;
    const gls = quebrar(e.garantia_texto || 'Garantia sobre todos os trabalhos executados nas zonas intervencionadas.', F, 8.5, (e.seguro ? cw : W - 2 * M) - 36);
    const h = Math.max(120, 78 + gls.length * 12);
    precisa(h + 16);
    if (e.garantia) {
      const wg = e.seguro ? cw : W - 2 * M;
      caixa(s.page, M, s.y, wg, h, { fundo: C.INK, topo: C.BR_SOBRE_ESCURO });
      rotulo(s.page, 'Garantia', M + 18, s.y + 22, C.BR_SOBRE_ESCURO, true);
      txt(s.page, e.garantia, M + 18, s.y + 50, FB, 20, C.BRANCO, -0.3);
      gls.forEach((ln, i) => txt(s.page, ln, M + 18, s.y + 72 + i * 12, F, 8.5, C.BRANCO));
    }
    if (e.seguro) {
      const x = e.garantia ? M + cw + gap : M;
      caixa(s.page, x, s.y, cw, h, { borda: C.HAIR, topo: C.BR });
      rotulo(s.page, 'Seguro de responsabilidade civil', x + 18, s.y + 22);
      txt(s.page, quebrar(e.seguro.replace(/^seguro\s*/i, ''), FB, 14, cw - 36)[0], x + 18, s.y + 46, FB, 14, C.INK);
      [e.seguro_apolice ? `Apólice n.º ${e.seguro_apolice}` : '', e.seguro_validade ? `Válida até ${e.seguro_validade}` : ''].filter(Boolean).forEach((l, i) => txt(s.page, l, x + 18, s.y + 66 + i * 13, F, 9, C.INK));
    }
    s.y += h + 20;
  }
  const naoGeral = semIva(o.nao_incluido.length ? o.nao_incluido : String(e.nunca_inclui || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean));
  tabelaCondicoes(b, k, [
    ['Valores', `Valores sem IVA; acresce IVA à taxa legal em vigor${T.ivas.length ? ` (${T.ivas.map((x) => `${fmtN(x.taxa, 0)}%`).join(' e ')})` : ''}. Total com IVA: ${fmtEUR(T.total)}. O valor global da proposta é a soma dos valores globais dos ${o.capitulos.length} capítulos.`],
    ['Adjudicação', variasFases ? 'A proposta é adjudicada na totalidade, pelo valor global. Os capítulos são interligados e não são adjudicáveis em separado.' : 'A proposta é adjudicada na totalidade, pelo valor global.'],
    ['Fases', variasFases ? `Execução em ${fases.length} fases, pela ordem indicada: ${fases.map((f) => `Fase ${f.n}${f.titulo ? ' — ' + f.titulo.toLowerCase() : ''} (capítulo${f.capitulos.length > 1 ? 's' : ''} ${f.capitulos.join(', ')})`).join('; ')}.` : ''],
    ['Pagamento', textoPagamento(d, false)],
    ['Prazos', variasFases ? 'Indicados em cada capítulo, a contar do início de cada fase.' : d.meta.prazo || e.prazo || 'Indicados em cada capítulo.'],
    ['Execução', semIva(d.orc.pressupostos)],
    ['Não incluído', naoGeral],
    ['A confirmar', d.orc.a_confirmar],
    ['Deslocação e entulho', e.extras || ''],
    ['Trabalhos extra', 'Trabalhos não descritos ou imprevistos são orçamentados à parte e só avançam depois de aprovados.'],
    ['Validade', `${val} dias, até ${fmtData(fim)}.`],
    ['Alvará ou registo', e.alvara || '']
  ]);

  // 05 Adjudicação
  tituloSecao('Adjudicação');
  paragrafo(`A adjudicação abrange a proposta na totalidade. Para adjudicar, basta devolver esta página assinada${variasFases ? ': a Fase 1 é agendada logo a seguir, e as fases seguintes no calendário que for acordado' : ' e os trabalhos são agendados logo a seguir'}.`, { depois: 10 });
  {
    const cliente = d.pedido.dono ? d.pedido.dono : 'O cliente';
    const decl = `${cliente} aceita a proposta n.º ${d.meta.numero || '-'} **na totalidade**, pelo valor global de **${vg(T.semIva)} + IVA**${variasFases ? `, com execução em ${fases.length} fases pela ordem indicada` : ''} e nas condições gerais desta proposta.`;
    const ls = quebrarRico(decl, F, FB, 10.5, W - 2 * M - 40);
    const h = 40 + ls.length * 15;
    precisa(h + 14);
    caixa(s.page, M, s.y, W - 2 * M, h, { borda: C.HAIR, barra: C.BR });
    rotulo(s.page, 'Declaração de aceitação', M + 20, s.y + 20);
    ls.forEach((ln, i) => b.linhaRica(s.page, ln, M + 20, s.y + 40 + i * 15, 10.5, C.INK));
    s.y += h + 18;
  }
  if (plano.length) {
    subtitulo('Plano de pagamentos');
    precisa(30);
    rotulo(s.page, 'Momento', M, s.y + 8); rotulo(s.page, 'Referência', M + 190, s.y + 8); txtR(s.page, 'VALOR', W - M, s.y + 8, F, 6.5, C.MUT, 1.2);
    s.y += 13; traco(s.page, M, s.y, W - M, s.y, 0.9, C.INK);
    plano.forEach((p) => {
      precisa(24);
      txt(s.page, p.momento, M, s.y + 16, F, 9, C.INK);
      txt(s.page, quebrar(p.referencia, F, 8.5, W - 2 * M - 290)[0], M + 190, s.y + 16, F, 8.5, C.MUT);
      txtR(s.page, fmtEUR(p.valor), W - M, s.y + 16, FB, 9, C.INK);
      s.y += 24; traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
    });
    precisa(40);
    s.y += 20;
    txt(s.page, 'Valor global da proposta', M, s.y, FB, 10.5, C.INK);
    txtR(s.page, fmtEUR(T.semIva), W - M, s.y, FB, 13, C.INK);
    s.y += 14;
    txtR(s.page, 'VALORES SEM IVA', W - M, s.y, F, 6.5, C.MUT, 1.2);
    s.y += 14;
  }
  if (e.iban) {
    const h = 54;
    precisa(h + 14);
    caixa(s.page, M, s.y, W - 2 * M, h, { borda: C.HAIR, barra: C.BR });
    rotulo(s.page, 'Dados para transferência bancária', M + 20, s.y + 17, C.BR, true);
    const campos = [['Titular', e.nome], ['Banco', e.banco], ['IBAN', e.iban], ['BIC/SWIFT', e.bic]].filter((x) => x[1]);
    const ws = [0.27, 0.18, 0.4, 0.15];
    let x = M + 20;
    campos.forEach(([kk, v], i) => {
      const w = (W - 2 * M - 40) * (ws[i] ?? 0.2);
      rotulo(s.page, kk, x, s.y + 32);
      txt(s.page, quebrar(v, FB, 8.5, w - 6)[0], x, s.y + 45, FB, 8.5, C.INK);
      x += w;
    });
    s.y += h + 18;
  }
  // assinaturas dos dois lados
  precisa(170);
  {
    const gap = 30, cw = (W - 2 * M - gap) / 2;
    const lado = (x: number, tit: string, campos: [string, string][]) => {
      rotulo(s.page, tit, x, s.y + 8, C.BR, true);
      campos.forEach(([kk, v], i) => {
        const bl = s.y + 36 + i * 32;
        rotulo(s.page, kk, x, bl);
        if (v) txt(s.page, quebrar(v, F, 10, cw - 60)[0], x + 60, bl, F, 10, C.INK);
        else traco(s.page, x + 60, bl + 2, x + cw, bl + 2, 0.6, C.INK);
      });
    };
    lado(M, 'Pelo cliente', [['Nome', ''], ['Data', ''], ['Assinatura', '']]);
    lado(M + cw + gap, `Pela ${e.nome || 'empresa'}`, [['Nome', e.assinante], ['NIF', e.nif], ['Data', ''], ['Assinatura', '']]);
    s.y += 170;
  }

  /* ----- rodapés (sem as duas capas) ----- */
  const todas = b.pdf.getPages();
  const pe = [e.nome, e.nif ? `NIF ${e.nif}` : '', d.pedido.localidade, 'Valores sem IVA'].filter(Boolean).join(' · ');
  todas.forEach((p, i) => {
    if (i < 2) return;
    traco(p, M, H - 52, W - M, H - 52, 0.5, C.HAIR);
    txt(p, quebrar(pe, F, 6.5, W - 2 * M - 80)[0], M, H - 40, F, 6.5, C.MUT);
    txtR(p, `Página ${i + 1} de ${todas.length}`, W - M, H - 40, F, 6.5, C.MUT);
    if (e.rodape) txtC(p, `Preparado com ${PRODUTO}`, W / 2, H - 28, F, 6, C.MUT);
  });
}

/* ============ peças partilhadas ============ */
// Régua de validade: emissão —— dias —— fim. Devolve o "top" seguinte.
function reguaValidade(b: Base, p: PDFPage, t: number) {
  const { F, FB, C, val, dataP, fim, rotulo, txt, txtR, txtC, traco, tick } = b;
  rotulo(p, 'Emitida', M, t);
  txtR(p, 'VÁLIDA ATÉ', W - M, t, F, 6.5, C.MUT, 1.3);
  t += 18;
  const d1 = fmtData(dataP), d2 = fmtData(fim);
  txt(p, d1, M, t, FB, 10, C.INK);
  txtR(p, d2, W - M, t, FB, 10, C.INK);
  const lx1 = M + FB.widthOfTextAtSize(d1, 10) + 12, lx2 = W - M - FB.widthOfTextAtSize(d2, 10) - 12, ly = t - 3.5;
  traco(p, lx1, ly, lx2, ly, 0.75, C.INK);
  tick(p, lx1, ly, 3.5, C.INK); tick(p, lx2, ly, 3.5, C.INK);
  txtC(p, `${val} ${val === 1 ? 'DIA' : 'DIAS'}`, (lx1 + lx2) / 2, ly - 4, FB, 7, C.BR, 1.4);
  return t;
}

// Tabela de linhas por capítulo. Sem preços: só descrição, unidade e quantidade.
function tabelaLinhas(b: Base, k: ReturnType<typeof corrido>, caps: Capitulo[], o: { precos: boolean; ivaColuna: boolean; subtotais: boolean; numeroCap?: number }) {
  const { F, FB, C, txt, txtR, traco } = b;
  const { s, novaPagina, FUNDO } = k;
  type Col = { k: string; t: string; w: number; a: 'l' | 'r'; x: number };
  const cols: Col[] = [{ k: 'n', t: 'N.º', w: 34, a: 'l', x: 0 }, { k: 'd', t: 'Descrição dos trabalhos', w: 0, a: 'l', x: 0 }, { k: 'u', t: 'Un.', w: 32, a: 'l', x: 0 }, { k: 'q', t: 'Qtd.', w: 46, a: 'r', x: 0 }];
  if (o.precos) cols.push({ k: 'p', t: 'Preço unit.', w: 66, a: 'r', x: 0 });
  if (o.ivaColuna) cols.push({ k: 'i', t: 'IVA', w: 34, a: 'r', x: 0 });
  if (o.precos) cols.push({ k: 't', t: 'Total', w: 72, a: 'r', x: 0 });
  cols[1].w = W - 2 * M - cols.reduce((a, c) => a + c.w, 0);
  let cx = M; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const cabecalho = () => {
    if (s.y + 30 > FUNDO) novaPagina();
    cols.forEach((c) => (c.a === 'r' ? txtR : txt)(s.page, c.t.toUpperCase(), c.a === 'r' ? c.x + c.w : c.x, s.y + 7, F, 6.5, C.MUT, 1.2));
    s.y += 13;
    traco(s.page, M, s.y, W - M, s.y, 0.75, C.INK);
  };
  cabecalho();
  let marcou = false;
  caps.forEach((c, i) => {
    const ci = o.numeroCap ?? i + 1;
    if (o.subtotais) {
      const nomes = quebrar(c.nome, FB, 9.5, W - 2 * M - 120).slice(0, 2);
      if (s.y + 26 + nomes.length * 12 + 26 > FUNDO) { novaPagina(); cabecalho(); }
      s.y += 11;
      const b0 = s.y + 8;
      txt(s.page, pad(ci), cols[0].x, b0, FB, 8.5, C.BR, 0.85);
      nomes.forEach((ln, kk) => txt(s.page, ln, cols[1].x, b0 + kk * 12, FB, 9.5, C.INK));
      if (o.precos) txtR(s.page, fmtEUR(subtotal(c)), W - M, b0, FB, 9, C.INK);
      s.y = b0 + (nomes.length - 1) * 12 + 6;
      traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
    }
    c.linhas.forEach((l, li) => {
      const estrela = l.confirmar || l.qtd_origem === 'estimada';
      if (estrela) marcou = true;
      const dl = quebrar(l.descricao + (estrela ? ' *' : ''), F, 8.8, cols[1].w - 10);
      const h = 12 + dl.length * 11.4;
      if (s.y + h > FUNDO) { novaPagina(); cabecalho(); }
      const base = s.y + 14.6;
      txt(s.page, `${ci}.${li + 1}`, cols[0].x, base, F, 8.8, C.MUT);
      dl.forEach((ln, kk) => txt(s.page, ln, cols[1].x, base + kk * 11.4, F, 8.8, C.INK));
      const vals: Record<string, string> = { u: un(l.unidade), q: fmtN(l.quantidade, Number.isInteger(l.quantidade) ? 0 : 2), p: fmtEUR(l.preco), i: `${fmtN(l.iva, 0)}%`, t: fmtEUR(totalLinha(l)) };
      cols.slice(2).forEach((col) => (col.a === 'r' ? txtR : txt)(s.page, vals[col.k], col.a === 'r' ? col.x + col.w : col.x, base, col.k === 't' ? FB : F, 8.8, col.k === 'u' ? C.MUT : C.INK));
      s.y += h;
      traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
    });
  });
  if (marcou) { s.y += 8; if (s.y + 12 > FUNDO) novaPagina(); txt(s.page, '* Quantidade estimada ou trabalho a confirmar na visita técnica.', M, s.y + 8, F, 7.5, C.MUT); s.y += 14; }
}

// Grelha de fotos 2 por linha, a preencher a moldura, com legenda completa (até 3 linhas).
function grelhaFotos(b: Base, k: ReturnType<typeof corrido>, nums: number[], ch = 170) {
  const { s, precisa } = k;
  const gap = 16, cw = (W - 2 * M - gap) / 2;
  const ok = nums.filter((n) => !!b.fotos[n - 1]);
  for (let i = 0; i < ok.length; i += 2) {
    precisa(ch + 50);
    let fundo = s.y + ch;
    for (let j = 0; j < 2 && i + j < ok.length; j++) {
      const n = ok[i + j], x = M + j * (cw + gap);
      b.fotoCoberta(s.page, b.fotos[n - 1]!, x, s.y, cw, ch);
      fundo = Math.max(fundo, b.legendaFoto(s.page, n, x, s.y + ch + 13, cw, 3));
    }
    s.y = fundo + 16;
  }
}

// Linhas "rótulo | texto". Listas: um item por linha, com marcador; as listas longas continuam na página seguinte.
function tabelaCondicoes(b: Base, k: ReturnType<typeof corrido>, linhas: [string, string | string[]][]) {
  const { F, C, txt, traco, rotulo, tick } = b;
  const { s, novaPagina, FUNDO } = k;
  const lh = 13.3, wv = W - 2 * M - 130;
  traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
  linhas.filter((r) => (Array.isArray(r[1]) ? r[1].length : String(r[1]).trim())).forEach(([kk, v]) => {
    const itens = Array.isArray(v) ? v.map((x) => quebrar(x, F, 9.5, wv - 14)) : [quebrar(v, F, 9.5, wv)];
    const lista = Array.isArray(v);
    const primeira = itens[0].length * lh + 14;
    if (s.y + Math.min(primeira, 80) > FUNDO) { novaPagina(); traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR); }
    rotulo(s.page, kk, M, s.y + 17);
    let y = s.y + 17;
    itens.forEach((ls) => {
      if (y + ls.length * lh > FUNDO) { novaPagina(); y = s.y + 17; rotulo(s.page, `${kk} (cont.)`, M, y); }
      if (lista) tick(s.page, M + 134, y - 3.5, 2.4, C.BR, 0.9);
      ls.forEach((ln, i) => txt(s.page, ln, M + 130 + (lista ? 14 : 0), y + i * lh, F, 9.5, C.INK));
      y += ls.length * lh + (lista ? 4 : 0);
    });
    s.y = y - 17 + (lista ? 10 : 14);
    traco(s.page, M, s.y, W - M, s.y, 0.5, C.HAIR);
  });
}

function textoSeguroCompleto(e: Empresa) {
  return [e.seguro ? e.seguro.replace(/^seguro\s*/i, '') : '', e.seguro_apolice ? `apólice n.º ${e.seguro_apolice}` : '', e.seguro_validade ? `válida até ${e.seguro_validade}` : ''].filter(Boolean).join(', ');
}

// Plano de pagamentos em texto. No modelo rápido os valores vão com IVA (o documento mostra o total com IVA).
function textoPagamento(d: DadosPDF, comIva: boolean) {
  const plano = planoPagamentos(d.orc, d.empresa);
  const f = comIva && d.totais.semIva ? d.totais.total / d.totais.semIva : 1;
  const partes = plano.map((p) => `${p.momento.toLowerCase().replace(/^adjudicação$/, 'na adjudicação').replace(/^início/, 'no início').replace(/^conclusão/, 'na conclusão')}: ${p.referencia.split(' do ')[0]} (${fmtEUR(p.valor * f)})`);
  const plan = partes.length ? `${maiuscula(partes.join('; '))}${comIva ? ', valores com IVA' : ', valores sem IVA'}.` : '';
  // notas só com números (ex.: "40, 40, 20") repetem o plano calculado: não entram
  const notas = /^[\d\s,.;%/+e-]*$/i.test(d.empresa.pagamento || '') ? '' : d.empresa.pagamento;
  return [plan, notas].filter(Boolean).join(' ');
}

export function nomeFicheiro(nomeEmpresa: string, numero: string, exemplo = false) {
  const emp = (nomeEmpresa || 'Orcamento').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  // sem acentos: alguns browsers ignoram o nome sugerido quando tem caracteres fora de ASCII
  return `${exemplo ? 'Exemplo de proposta' : 'Proposta ' + (numero || '')} - ${emp}.pdf`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ');
}

export function descarregar(bytes: Uint8Array, nome: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
