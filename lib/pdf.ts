// Proposta em PDF com a marca do profissional (gerada no browser), herdada do protótipo.
import { PDFDocument, StandardFonts, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import type { Empresa, Leitura, Meta, Orc, Pedido, Totais } from './orc';
import { descObra, partesMarca, subtotal, textoSeguro, totalLinha } from './orc';
import { PRODUTO } from './marca';
import { deIso, fmtData, fmtEUR, fmtN, isoHoje, maiuscula, num, pad, un } from './util';

export type ImagemBytes = { bytes: Uint8Array; png: boolean };
export type DadosPDF = {
  empresa: Empresa; logo: ImagemBytes | null; pedido: Pick<Pedido, 'tipo' | 'localidade' | 'dono'>;
  meta: Meta; orc: Orc; totais: Totais; fotos: (ImagemBytes | null)[]; leitura: Leitura | null; exemplo: boolean;
};

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
function quebrar(texto: string, font: PDFFont, size: number, maxW: number) {
  const words = pdfSafe(texto).split(/\s+/).filter(Boolean);
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

export async function gerarPDF(d: DadosPDF): Promise<{ bytes: Uint8Array; paginas: number }> {
  const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const FB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 54;
  const hex = (h: string, def = '101315') => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); const v = m ? m[1] : def; return rgb(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255); };
  const BR = hex(d.empresa.cor, '1F3F8F');
  const INK = hex('101315'), MUT = hex('5B6268'), HAIR = hex('DDE0DB'), PAPEL = hex('F2F3F0'), CRIT = hex('B3261E');
  const e = d.empresa;
  const T = d.totais;
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
  const rotulo = (p: PDFPage, s: string, x: number, top: number, c = MUT, bold = false) => txt(p, String(s).toUpperCase(), x, top, bold ? FB : F, 6.5, c, 1.3);

  const embed = async (im: ImagemBytes | null) => {
    if (!im) return null;
    try { return im.png ? await pdf.embedPng(im.bytes) : await pdf.embedJpg(im.bytes); } catch (err) { console.warn('imagem', err); return null; }
  };
  const logo = await embed(d.logo);
  const fotos: (PDFImage | null)[] = [];
  for (const f of d.fotos) fotos.push(await embed(f));
  const desenhaContida = (p: PDFPage, img: PDFImage, x: number, top: number, w: number, h: number) => { const s = Math.min(w / img.width, h / img.height); const iw = img.width * s, ih = img.height * s; p.drawImage(img, { x: x + (w - iw) / 2, y: Y(top + (h + ih) / 2), width: iw, height: ih }); };

  /* ----- capa ----- */
  const capa = pdf.addPage([W, H]);
  const marca = partesMarca(e.nome || '');
  if (logo) {
    const s = Math.min(170 / logo.width, 56 / logo.height, 1);
    capa.drawImage(logo, { x: M, y: Y(M + logo.height * s), width: logo.width * s, height: logo.height * s });
  } else if (marca.sub) {
    txt(capa, marca.main, M, M + 15, FB, 20, INK, 3.2);
    txt(capa, marca.sub.toUpperCase(), M, M + 27, F, 6.5, MUT, 1.4);
  } else {
    quebrar(e.nome || 'Empresa', FB, 15, 300).slice(0, 2).forEach((ln, i) => txt(capa, ln, M, M + 12 + i * 18, FB, 15, INK, 0.3));
  }
  [e.telefone, e.email, e.site].filter(Boolean).forEach((s, i) => txtR(capa, s, W - M, M + 7 + i * 11, F, 8, MUT));
  traco(capa, M, 117, W - M, 117, 0.75, HAIR);

  let t = 228;
  if (d.exemplo) {
    const et = 'EXEMPLO · VALORES FICTÍCIOS';
    const lw = larg(et, FB, 7, 1.2) + 16;
    capa.drawRectangle({ x: W - M - lw, y: Y(t + 6), width: lw, height: 17, borderColor: CRIT, borderWidth: 0.9 });
    txt(capa, et, W - M - lw + 8, t, FB, 7, CRIT, 1.2);
  }
  txt(capa, 'PROPOSTA DE ORÇAMENTO', M, t, FB, 7.5, BR, 1.5);
  const tl = quebrarEquilibrado(maiuscula(descObra(d.pedido.tipo)), FB, 34, 410).slice(0, 3);
  t += 43;
  tl.forEach((ln, i) => txt(capa, ln, M, t + i * 36, FB, 34, INK, -0.5));
  t += (tl.length - 1) * 36;
  if (d.pedido.localidade) { t += 29; txt(capa, quebrar(d.pedido.localidade, F, 13, W - 2 * M)[0], M, t, F, 13, MUT); }
  // cota de validade: emissão —— dias —— fim
  t += 51;
  rotulo(capa, 'Emitida', M, t);
  txtR(capa, 'VÁLIDA ATÉ', W - M, t, F, 6.5, MUT, 1.3);
  t += 18;
  const d1 = fmtData(dataP), d2 = fmtData(fim);
  txt(capa, d1, M, t, FB, 10, INK);
  txtR(capa, d2, W - M, t, FB, 10, INK);
  const lx1 = M + FB.widthOfTextAtSize(d1, 10) + 12, lx2 = W - M - FB.widthOfTextAtSize(d2, 10) - 12, ly = t - 3.5;
  traco(capa, lx1, ly, lx2, ly, 0.75, INK);
  tick(capa, lx1, ly, 3.5, INK); tick(capa, lx2, ly, 3.5, INK);
  txtC(capa, `${val} ${val === 1 ? 'DIA' : 'DIAS'}`, (lx1 + lx2) / 2, ly - 4, FB, 7, BR, 1.4);
  // ficha
  t += 38;
  traco(capa, M, t, W - M, t, 0.75, HAIR);
  const metas: [string, string][] = [['Proposta n.º', d.meta.numero || '-'], ['Dono de obra', d.pedido.dono || '-'], d.meta.prazo ? ['Prazo indicativo', d.meta.prazo] : ['Data', fmtData(dataP)], ['Total com IVA', fmtEUR(T.total)]];
  const colW = (W - 2 * M) / 4;
  metas.forEach(([k, v], i) => {
    const x = M + i * colW;
    rotulo(capa, k, x, t + 18);
    quebrar(v, FB, 10.5, colW - 12).slice(0, 2).forEach((ln, j) => txt(capa, ln, x, t + 34 + j * 13, FB, 10.5, INK));
  });
  // rodapé legal
  const fr = H - M - 32;
  const legais = [e.nome, e.nif ? `NIF ${e.nif}` : '', e.alvara ? `Alvará/registo ${e.alvara}` : '', e.seguro ? textoSeguro(e.seguro) : ''].filter(Boolean).join('  ·  ');
  traco(capa, M, fr, W - M, fr, 0.75, HAIR);
  let ft = fr + 15;
  if (e.morada) { txt(capa, quebrar(e.morada, F, 7, W - 2 * M)[0], M, ft, F, 7, MUT); ft += 10; }
  if (legais) quebrar(legais, F, 7, W - 2 * M).slice(0, 2).forEach((ln, i) => txt(capa, ln, M, ft + i * 10, F, 7, MUT));
  // fotografia principal
  const foto0 = fotos.find(Boolean);
  const fTop = t + 65, fBot = fr - 34;
  if (foto0 && fBot - fTop > 120) {
    const fh = fBot - fTop;
    capa.drawRectangle({ x: M, y: Y(fBot), width: W - 2 * M, height: fh, color: PAPEL });
    desenhaContida(capa, foto0, M, fTop, W - 2 * M, fh);
    const i0 = fotos.indexOf(foto0);
    const info = (d.leitura?.fotos || []).find((f) => f.n === i0 + 1);
    const et = `FOTO ${i0 + 1}`;
    rotulo(capa, et, M, fBot + 13, MUT, true);
    if (info?.descricao) { const x = M + larg(et, FB, 6.5, 1.3) + 10; txt(capa, quebrar(info.descricao, F, 7.5, W - M - x)[0], x, fBot + 13, F, 7.5, MUT); }
  }

  /* ----- páginas de conteúdo ----- */
  let page: PDFPage = capa, y = 0;
  const TOPO = 82, FUNDO = H - 72;
  const novaPagina = () => {
    page = pdf.addPage([W, H]); y = TOPO;
    txt(page, (e.nome || '').toUpperCase(), M, 44, FB, 7, INK, 1.4);
    txtR(page, `PROPOSTA N.º ${d.meta.numero || '-'}`, W - M, 44, F, 7, MUT, 1.4);
    if (d.exemplo) txtC(page, 'EXEMPLO · VALORES FICTÍCIOS', W / 2, 44, FB, 7, CRIT, 1.4);
    traco(page, M, 52, W - M, 52, 0.75, HAIR);
  };
  const precisa = (h: number) => { if (y + h > FUNDO) novaPagina(); };
  const paragrafo = (texto: string, { font = F, size = 9.5, color = INK, x = M, w = W - 2 * M, lh = 13.5, depois = 6 }: { font?: PDFFont; size?: number; color?: RGB; x?: number; w?: number; lh?: number; depois?: number } = {}) => {
    for (const raw of String(texto ?? '').split(/\n+/)) {
      if (!raw.trim()) continue;
      for (const ln of quebrar(raw, font, size, w)) { precisa(lh); txt(page, ln, x, y + lh * 0.75, font, size, color); y += lh; }
    }
    y += depois;
  };
  const titulo = (n: number, tt: string, minimo = 90) => {
    const margem = y > TOPO + 1 ? 30 : 0;
    if (y + margem + minimo > FUNDO) novaPagina(); else y += margem;
    txt(page, String(n).padStart(2, '0'), M, y + 13, FB, 9, BR, 1.4);
    txt(page, tt, M + 27, y + 13, FB, 16, INK, -0.2);
    y += 34;
  };
  const subtitulo = (tt: string, nn?: string) => {
    precisa(60);
    y += 8;
    let x = M;
    if (nn) { txt(page, nn, M, y + 9.5, FB, 9.5, BR); x = M + 27; }
    txt(page, tt, x, y + 9.5, FB, 9.5, INK);
    y += 19;
  };
  const marcadores = (itens: string[]) => {
    for (const it of itens) {
      const ls = quebrar(it, F, 9.5, W - 2 * M - 16);
      precisa(ls.length * 13.3 + 5);
      tick(page, M + 4, y + 7, 2.6, BR, 0.9);
      ls.forEach((ln) => { txt(page, ln, M + 16, y + 10, F, 9.5, INK); y += 13.3; });
      y += 5;
    }
    y += 4;
  };
  const AVISO = 'Os valores apresentados são estimativas, baseadas nas fotografias e nas informações recebidas até esta data, e ficam sujeitos a confirmação em visita técnica e medição. Os trabalhos não descritos nesta proposta não estão incluídos.';
  const caixaAviso = () => {
    const ls = quebrar(AVISO, F, 9, W - 2 * M - 32);
    const h = ls.length * 13 + 15;
    precisa(h + 8);
    page.drawRectangle({ x: M, y: Y(y + h), width: W - 2 * M, height: h, borderColor: HAIR, borderWidth: 0.75 });
    page.drawRectangle({ x: M, y: Y(y + h), width: 2.5, height: h, color: BR });
    ls.forEach((ln, i) => txt(page, ln, M + 16, y + 19 + i * 13 - 2, F, 9, INK));
    y += h + 14;
  };
  const caixaTotais = () => {
    const rows: [string, string, boolean?][] = [];
    if (T.imp) { rows.push(['Trabalhos', fmtEUR(T.base)]); rows.push([`Imprevistos (${fmtN(T.pct, 0)}%)`, fmtEUR(T.imp)]); }
    rows.push(['Total sem IVA', fmtEUR(T.semIva), true]);
    T.ivas.forEach((x) => rows.push([T.ivas.length > 1 ? `IVA ${fmtN(x.taxa, 0)}% sobre ${fmtEUR(x.base)}` : `IVA ${fmtN(x.taxa, 0)}%`, fmtEUR(x.valor)]));
    const rh = 18.5, w = 240, x0 = W - M - w;
    precisa(rows.length * rh + 58);
    y += 18;
    rows.forEach(([k, v, forte], i) => {
      txt(page, k, x0, y + 12.5, forte ? FB : F, 9, forte ? INK : MUT);
      txtR(page, v, W - M, y + 12.5, forte ? FB : F, 9, INK);
      y += rh;
      if (i < rows.length - 1) traco(page, x0, y, W - M, y, 0.5, HAIR);
    });
    y += 3;
    traco(page, x0, y, W - M, y, 1.2, BR);
    y += 19;
    txt(page, 'Total com IVA', x0, y, FB, 10.5, INK);
    txtR(page, fmtEUR(T.total), W - M, y, FB, 13, INK);
    y += 12;
  };

  // 01 Resumo
  novaPagina();
  titulo(1, 'Resumo');
  paragrafo(`Proposta para ${descObra(d.pedido.tipo)}${d.pedido.localidade ? ' em ' + d.pedido.localidade : ''}${d.pedido.dono ? ', preparada para ' + d.pedido.dono : ''}. Inclui:`);
  marcadores(d.orc.capitulos.map((c) => c.nome));
  caixaTotais();
  y += 18;
  if (d.meta.prazo) paragrafo(`Prazo indicativo: ${d.meta.prazo}.`, { depois: 0 });
  paragrafo(`Validade da proposta: ${val} dias, até ${fmtData(fim)}.`, { depois: 12 });
  caixaAviso();

  // 02 Descrição dos trabalhos
  titulo(2, 'Descrição dos trabalhos');
  d.orc.capitulos.forEach((c, i) => { subtitulo(c.nome, pad(i + 1)); paragrafo(c.descricao || c.linhas.map((l) => l.descricao).join('; ') + '.', { x: M + 27, w: W - 2 * M - 27, depois: 8 }); });

  // 03 Mapa de quantidades e preços
  titulo(3, 'Mapa de quantidades e preços', 130);
  const varias = T.ivas.length > 1;
  type Col = { k: string; t: string; w: number; a: 'l' | 'r'; x: number };
  const cols: Col[] = [
    { k: 'n', t: 'N.º', w: 34, a: 'l', x: 0 },
    { k: 'd', t: 'Descrição', w: 0, a: 'l', x: 0 },
    { k: 'u', t: 'Un.', w: 32, a: 'l', x: 0 },
    { k: 'q', t: 'Qtd.', w: 46, a: 'r', x: 0 },
    { k: 'p', t: 'Preço unit.', w: 66, a: 'r', x: 0 }
  ];
  if (varias) cols.push({ k: 'i', t: 'IVA', w: 34, a: 'r', x: 0 });
  cols.push({ k: 't', t: 'Total', w: 72, a: 'r', x: 0 });
  cols[1].w = W - 2 * M - cols.reduce((s, c) => s + c.w, 0);
  let cx = M; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const cabecalho = () => {
    precisa(30);
    cols.forEach((c) => (c.a === 'r' ? txtR : txt)(page, c.t.toUpperCase(), c.a === 'r' ? c.x + c.w : c.x, y + 7, F, 6.5, MUT, 1.2));
    y += 13;
    traco(page, M, y, W - M, y, 0.75, INK);
  };
  cabecalho();
  let marcou = false;
  const largNome = cols[1].w + cols[2].w + cols[3].w + cols[4].w - 16;
  d.orc.capitulos.forEach((c, ci) => {
    const nomes = quebrar(c.nome, FB, 9.5, largNome).slice(0, 2);
    if (y + 26 + nomes.length * 12 + 26 > FUNDO) { novaPagina(); cabecalho(); }
    y += 11;
    const b0 = y + 8;
    txt(page, pad(ci + 1), cols[0].x, b0, FB, 8.5, BR, 0.85);
    nomes.forEach((ln, k) => txt(page, ln, cols[1].x, b0 + k * 12, FB, 9.5, INK));
    txtR(page, fmtEUR(subtotal(c)), W - M, b0, FB, 9, INK);
    y = b0 + (nomes.length - 1) * 12 + 6;
    traco(page, M, y, W - M, y, 0.5, HAIR);
    c.linhas.forEach((l, li) => {
      const estrela = l.confirmar || l.qtd_origem === 'estimada';
      if (estrela) marcou = true;
      const dl = quebrar(l.descricao + (estrela ? ' *' : ''), F, 8.8, cols[1].w - 10);
      const h = 12 + dl.length * 11.4;
      if (y + h > FUNDO) { novaPagina(); cabecalho(); }
      const base = y + 14.6;
      txt(page, `${ci + 1}.${li + 1}`, cols[0].x, base, F, 8.8, MUT);
      dl.forEach((ln, k) => txt(page, ln, cols[1].x, base + k * 11.4, F, 8.8, INK));
      const vals: Record<string, string> = { u: un(l.unidade), q: fmtN(l.quantidade, Number.isInteger(l.quantidade) ? 0 : 2), p: fmtEUR(l.preco), i: `${fmtN(l.iva, 0)}%`, t: fmtEUR(totalLinha(l)) };
      cols.slice(2).forEach((col) => (col.a === 'r' ? txtR : txt)(page, vals[col.k], col.a === 'r' ? col.x + col.w : col.x, base, col.k === 't' ? FB : F, 8.8, col.k === 'u' ? MUT : INK));
      y += h;
      traco(page, M, y, W - M, y, 0.5, HAIR);
    });
  });
  if (marcou) { y += 8; paragrafo('* Quantidade estimada ou trabalho a confirmar na visita técnica.', { size: 7.5, color: MUT, lh: 11, depois: 0 }); }
  caixaTotais();

  // 04 Não incluído
  const naoIncl = d.orc.nao_incluido.length ? d.orc.nao_incluido : String(e.nunca_inclui || '').split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
  let n = 4;
  if (naoIncl.length) { titulo(n++, 'Não incluído'); marcadores(naoIncl); }

  // 05 Pressupostos e pontos a confirmar
  if (d.orc.pressupostos.length || d.orc.a_confirmar.length) {
    titulo(n++, 'Pressupostos e pontos a confirmar');
    if (d.orc.pressupostos.length) { subtitulo('Pressupostos'); marcadores(d.orc.pressupostos); }
    if (d.orc.a_confirmar.length) { subtitulo('A confirmar na visita técnica'); marcadores(d.orc.a_confirmar); }
  }

  // 06 Condições
  titulo(n++, 'Condições');
  const taxas = T.ivas.map((x) => `${fmtN(x.taxa, 0)}%`);
  const conds = ([
    ['Pagamento', e.pagamento || 'A acordar na adjudicação.'],
    ['Validade', `${val} dias, até ${fmtData(fim)}.`],
    ['Prazo', d.meta.prazo || e.prazo || ''],
    ['Garantia', e.garantia || ''],
    ['Seguro', e.seguro || ''],
    ['IVA', taxas.length ? `Taxa${taxas.length > 1 ? 's' : ''} de ${taxas.join(' e ')}, incluída${taxas.length > 1 ? 's' : ''} no total com IVA.` : ''],
    ['Deslocação e entulho', e.extras || ''],
    ['Alvará ou registo', e.alvara || '']
  ] as [string, string][]).filter((r) => String(r[1]).trim());
  traco(page, M, y, W - M, y, 0.5, HAIR);
  conds.forEach(([k, v]) => {
    const ls = quebrar(v, F, 9.5, W - 2 * M - 130);
    const h = ls.length * 13.3 + 14;
    if (y + h > FUNDO) { novaPagina(); traco(page, M, y, W - M, y, 0.5, HAIR); }
    rotulo(page, k, M, y + 17);
    ls.forEach((ln, i) => txt(page, ln, M + 130, y + 17 + i * 13.3, F, 9.5, INK));
    y += h;
    traco(page, M, y, W - M, y, 0.5, HAIR);
  });

  // 07 Fotografias
  const comFoto = fotos.map((img, i) => ({ img, i })).filter((x): x is { img: PDFImage; i: number } => !!x.img);
  if (comFoto.length) {
    titulo(n++, 'Fotografias do estado atual');
    const gap = 16, cw = (W - 2 * M - gap) / 2, ch = 170;
    for (let i = 0; i < comFoto.length; i += 2) {
      precisa(ch + 44);
      for (let j = 0; j < 2 && i + j < comFoto.length; j++) {
        const { img, i: idxF } = comFoto[i + j];
        const x = M + j * (cw + gap);
        page.drawRectangle({ x, y: Y(y + ch), width: cw, height: ch, color: PAPEL });
        desenhaContida(page, img, x, y, cw, ch);
        rotulo(page, `Foto ${idxF + 1}`, x, y + ch + 13, MUT, true);
        const info = (d.leitura?.fotos || []).find((f) => f.n === idxF + 1);
        if (info?.descricao) quebrar(info.descricao, F, 8, cw).slice(0, 2).forEach((ln, k) => txt(page, ln, x, y + ch + 25 + k * 10, F, 8, MUT));
      }
      y += ch + 46;
    }
  }

  // 08 Aceitação
  titulo(n++, 'Aceitação');
  paragrafo(`Aceito a proposta n.º ${d.meta.numero || '-'}${e.nome ? ' de ' + e.nome : ''}, nas condições descritas.`, { depois: 14 });
  precisa(130);
  ['Nome', 'Data', 'Assinatura'].forEach((k, i) => {
    const b = y + 26 + i * 40;
    rotulo(page, k, M, b);
    traco(page, M + 80, b + 2, M + 330, b + 2, 0.6, INK);
  });
  y += 140;

  /* ----- rodapés ----- */
  const todas = pdf.getPages();
  todas.forEach((p, i) => {
    if (i === 0) return;
    traco(p, M, H - 56, W - M, H - 56, 0.5, HAIR);
    txt(p, 'Valores estimados, sujeitos a confirmação em visita técnica e medição.', M, H - 44, F, 7, MUT);
    txtR(p, `Página ${i + 1} de ${todas.length}`, W - M, H - 44, F, 7, MUT);
    if (e.rodape) txtC(p, `Preparado com ${PRODUTO}`, W / 2, H - 30, F, 6.5, MUT);
  });
  return { bytes: await pdf.save(), paginas: todas.length };
}

export function nomeFicheiro(nomeEmpresa: string, numero: string, exemplo = false) {
  const emp = (nomeEmpresa || 'Orcamento').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  // sem acentos: alguns browsers ignoram o nome sugerido quando tem caracteres fora de ASCII
  return `${exemplo ? 'Exemplo de proposta' : 'Proposta ' + (numero || '')} - ${emp}.pdf`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ');
}

export function descarregar(bytes: Uint8Array, nome: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
