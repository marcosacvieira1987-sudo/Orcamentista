// Modelo do orçamento e regras de cálculo (cliente e servidor), herdados do protótipo.
import { arr, iniciais, isoHoje, norm, num, pad, r2, strs, uid, un, uniq } from './util';

/* ============ tipos ============ */
export type Empresa = {
  nome: string; nif: string; telefone: string; email: string; site: string; morada: string;
  alvara: string; seguro: string; cor: string; logo_path: string | null;
  iva: number; validade: number; imprevistos: number;
  pagamento: string; prazo: string; garantia: string; nunca_inclui: string; extras: string;
  rodape: boolean;
  precos: ItemPreco[];
};
export type ItemPreco = { descricao: string; unidade: string; preco: number | null };

export type Pedido = { texto: string; tipo: string; localidade: string; dono: string; notas: string };
export type Foto = { id: string; path: string; nome: string };
export type Leitura = {
  fotos: { n: number; divisao: string; descricao: string }[];
  divisoes: { nome: string; elementos: string[]; materiais: string[]; estado: string[] }[];
  nao_consigo_ver: string[]; preciso_confirmar: string[]; trabalhos_provaveis: string[];
  cotas_lidas: string[]; alertas: string[];
};
export type Pergunta = { id: string; tema: string; pergunta: string; tipo: 'escolha' | 'sim_nao' | 'numero' | 'texto'; opcoes: string[]; unidade: string; porque: string };
export type Medida = { id: string; divisao: string; comp: string; larg: string; pd: string; vaos: string; nota: string; estimar: boolean };
export type Linha = {
  id: string; descricao: string; unidade: string; quantidade: number; calculo: string;
  qtd_origem: 'medida' | 'estimada'; preco: number; fonte: 'propria' | 'estimativa'; ref: string;
  faixa_min: number | null; faixa_max: number | null; confirmar: boolean; nota: string; iva: number; fixado: boolean;
};
export type Capitulo = { id: string; nome: string; descricao: string; linhas: Linha[] };
export type Orc = { capitulos: Capitulo[]; nao_incluido: string[]; pressupostos: string[]; a_confirmar: string[]; prazo: string };
export type Meta = { numero: string; data: string; validade: number | ''; prazo: string };
export type Passo = 'pedido' | 'leitura' | 'perguntas' | 'medidas' | 'revisao' | 'pdf';

export type Estado = {
  v: 1; step: Passo;
  pedido: Pedido; fotos: Foto[];
  leitura: Leitura | null; correcao: string;
  perguntas: Pergunta[] | null; respostas: Record<string, string>; extra: string;
  medidas: Medida[] | null; orc: Orc | null;
  meta: Meta; revisto: boolean; aprovado: boolean; mensagem: string;
};

export const EMPRESA_VAZIA: Empresa = {
  nome: '', nif: '', telefone: '', email: '', site: '', morada: '', alvara: '', seguro: '', cor: '#1F3F8F', logo_path: null,
  iva: 23, validade: 30, imprevistos: 0, pagamento: '', prazo: '', garantia: '', nunca_inclui: '', extras: '', rodape: true, precos: []
};

export const novoEstado = (): Estado => ({
  v: 1, step: 'pedido',
  pedido: { texto: 'Preparar orçamento detalhado, com estimativa de preço', tipo: '', localidade: '', dono: '', notas: '' },
  fotos: [], leitura: null, correcao: '', perguntas: null, respostas: {}, extra: '', medidas: null, orc: null,
  meta: { numero: '', data: '', validade: '', prazo: '' }, revisto: false, aprovado: false, mensagem: ''
});

export const ivaPadrao = (e: Pick<Empresa, 'iva'>) => (num(e.iva) > 0 ? num(e.iva) : 23);
export const validadePadrao = (e: Pick<Empresa, 'validade'>) => { const v = Math.round(num(e.validade)); return v > 0 ? v : 30; };

/* ============ normalização das respostas da IA ============ */
export const LEITURA_VAZIA = (): Leitura => ({ fotos: [], divisoes: [], nao_consigo_ver: [], preciso_confirmar: [], trabalhos_provaveis: [], cotas_lidas: [], alertas: [] });

export function juntarLeituras(partes: unknown[]): Leitura {
  const out = LEITURA_VAZIA();
  const porNome = new Map<string, Leitura['divisoes'][number]>();
  const listas = ['nao_consigo_ver', 'preciso_confirmar', 'trabalhos_provaveis', 'cotas_lidas', 'alertas'] as const;
  for (const p0 of partes) {
    const p = (p0 && typeof p0 === 'object' && !Array.isArray(p0) ? p0 : {}) as Record<string, unknown>;
    for (const f of arr(p.fotos)) {
      if (typeof f !== 'object' || !f) continue;
      const o = f as Record<string, unknown>;
      out.fotos.push({ n: Math.round(num(o.n)) || out.fotos.length + 1, divisao: String(o.divisao || ''), descricao: String(o.descricao || '') });
    }
    for (const d of arr(p.divisoes)) {
      if (typeof d !== 'object' || !d) continue;
      const o = d as Record<string, unknown>;
      const nome = String(o.nome || 'Divisão').trim();
      const k = norm(nome);
      const cur = porNome.get(k) || { nome, elementos: [], materiais: [], estado: [] };
      cur.elementos = uniq([...cur.elementos, ...strs(o.elementos)]);
      cur.materiais = uniq([...cur.materiais, ...strs(o.materiais)]);
      cur.estado = uniq([...cur.estado, ...strs(o.estado)]);
      porNome.set(k, cur);
    }
    for (const key of listas) out[key] = uniq([...out[key], ...strs(p[key])]);
  }
  out.divisoes = [...porNome.values()];
  return out;
}

export function normPerguntas(r: unknown): Pergunta[] {
  const ps = arr((r as Record<string, unknown> | null)?.perguntas)
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object' && !!(q as Record<string, unknown>).pergunta)
    .slice(0, 8);
  return ps
    .map((q, i): Pergunta => ({
      id: 'q' + (i + 1),
      tema: String(q.tema || ''),
      pergunta: String(q.pergunta),
      tipo: (['escolha', 'sim_nao', 'numero', 'texto'] as const).includes(q.tipo as Pergunta['tipo']) ? (q.tipo as Pergunta['tipo']) : 'texto',
      opcoes: strs(q.opcoes).slice(0, 6),
      unidade: String(q.unidade || ''),
      porque: String(q.porque || '')
    }))
    .map((q) => (q.tipo === 'escolha' && q.opcoes.length < 2 ? { ...q, tipo: 'texto' } : q));
}

const tabelaComPreco = (precos: ItemPreco[]) => precos.filter((i) => String(i.descricao || '').trim() && num(i.preco) > 0);

// Uma linha só fica como "tabela própria" se o preço bater certo com a tabela do profissional.
export function confereTabela(linha: Linha, precos: ItemPreco[]): Linha {
  if (linha.fonte !== 'propria') return linha;
  const tab = tabelaComPreco(precos);
  const alvo = norm(linha.ref || linha.descricao);
  let it = tab.find((i) => norm(i.descricao) === alvo);
  if (!it) {
    const pal = new Set(alvo.split(' ').filter((w) => w.length > 3));
    it = tab.find((i) => r2(num(i.preco)) === linha.preco && norm(i.descricao).split(' ').filter((w) => pal.has(w)).length >= Math.max(1, Math.ceil(pal.size / 2)));
  }
  if (it && r2(num(it.preco)) === linha.preco) return { ...linha, ref: it.descricao };
  return { ...linha, fonte: 'estimativa', ref: '' };
}

export function normOrc(r: unknown, precos: ItemPreco[], ivaDef: number, anterior?: Orc | null): Orc {
  const o = (r && typeof r === 'object' && !Array.isArray(r) ? r : {}) as Record<string, unknown>;
  const velhas = new Map((anterior?.capitulos || []).flatMap((c) => c.linhas).map((l) => [l.id, l]));
  const capitulos = arr(o.capitulos)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c, ci): Capitulo => ({
      id: uid('C'),
      nome: String(c.nome || `Capítulo ${ci + 1}`),
      descricao: String(c.descricao || ''),
      linhas: arr(c.linhas)
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object' && !!String((l as Record<string, unknown>).descricao || '').trim())
        .map((l) => {
          const ant = l.id ? velhas.get(String(l.id)) : undefined;
          const nulo = (v: unknown) => v === null || v === undefined || v === '';
          const linha: Linha = {
            id: ant ? ant.id : uid('L'),
            descricao: String(l.descricao || ''),
            unidade: un(l.unidade || 'un'),
            quantidade: r2(num(l.quantidade)),
            calculo: String(l.calculo || ''),
            qtd_origem: l.qtd_origem === 'medida' ? 'medida' : 'estimada',
            preco: r2(num(l.preco)),
            fonte: l.fonte === 'propria' ? 'propria' : 'estimativa',
            ref: String(l.ref || ''),
            faixa_min: nulo(l.faixa_min) ? null : r2(num(l.faixa_min)),
            faixa_max: nulo(l.faixa_max) ? null : r2(num(l.faixa_max)),
            confirmar: !!l.confirmar,
            nota: String(l.nota || ''),
            iva: [23, 13, 6].includes(num(l.iva)) ? num(l.iva) : ant ? ant.iva : ivaDef,
            fixado: !!(ant && ant.fixado && (r2(num(l.preco)) === ant.preco || l.fixado))
          };
          return confereTabela(linha, precos);
        })
    }))
    .filter((c) => c.linhas.length);
  return { capitulos, nao_incluido: strs(o.nao_incluido), pressupostos: strs(o.pressupostos), a_confirmar: strs(o.a_confirmar), prazo: String(o.prazo || '') };
}

/* ============ totais e regras ============ */
export const linhas = (o: Orc | null) => (o ? o.capitulos.flatMap((c) => c.linhas) : []);
export const totalLinha = (l: Linha) => r2(l.quantidade * l.preco);
export const subtotal = (c: Capitulo) => r2(c.linhas.reduce((s, l) => s + totalLinha(l), 0));
export function confianca(l: Linha) {
  if (l.fonte === 'estimativa' && !l.fixado) return 'baixa';
  if (l.qtd_origem === 'medida') return 'alta';
  return 'media';
}
export const pendentes = (o: Orc | null) => linhas(o).filter((l) => confianca(l) === 'baixa');

export type Totais = { base: number; imp: number; pct: number; semIva: number; ivas: { taxa: number; base: number; valor: number }[]; iva: number; total: number };
export function totais(o: Orc | null, e: Pick<Empresa, 'iva' | 'imprevistos'>): Totais {
  const pct = Math.max(0, num(e.imprevistos));
  const tPadrao = ivaPadrao(e);
  const ls = linhas(o);
  const base = r2(ls.reduce((s, l) => s + totalLinha(l), 0));
  const imp = pct > 0 ? r2((base * pct) / 100) : 0;
  const porTaxa = new Map<number, number>();
  for (const l of ls) porTaxa.set(l.iva, r2((porTaxa.get(l.iva) || 0) + totalLinha(l)));
  if (imp) porTaxa.set(tPadrao, r2((porTaxa.get(tPadrao) || 0) + imp));
  const ivas = [...porTaxa.entries()]
    .filter((x) => x[1] !== 0)
    .sort((a, b) => b[0] - a[0])
    .map(([taxa, b]) => ({ taxa, base: b, valor: r2((b * taxa) / 100) }));
  const semIva = r2(base + imp);
  const iva = r2(ivas.reduce((s, x) => s + x.valor, 0));
  return { base, imp, pct, semIva, ivas, iva, total: r2(semIva + iva) };
}

export function numeroProposta(dono: string) {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${iniciais(dono) || 'XX'}`;
}
export { isoHoje };

const OBRA: Record<string, string> = {
  'Casa de banho': 'remodelação de casa de banho', Cozinha: 'remodelação de cozinha', Pintura: 'trabalhos de pintura',
  'Pladur e tetos falsos': 'trabalhos de pladur e tetos falsos', Pavimentos: 'trabalhos de pavimentos',
  'Remodelação geral': 'remodelação geral', Outro: 'obra de remodelação'
};
export const descObra = (tipo: string) => OBRA[tipo] || (tipo ? String(tipo).toLowerCase() : 'obra de remodelação');
export const TIPOS_OBRA = Object.keys(OBRA);

// "MACV Gestão de Obras" → marca "MACV" e linha "Gestão de Obras"; outros nomes ficam inteiros.
export function partesMarca(nome: string) {
  const n = String(nome || '').trim();
  const ws = n.split(/\s+/);
  if (ws.length >= 2 && /^[A-Z0-9&]{2,6}$/.test(ws[0])) return { main: ws[0], sub: ws.slice(1).join(' ') };
  return { main: n, sub: '' };
}
export const textoSeguro = (s: string) => { const t = String(s || '').trim(); return /^seguro/i.test(t) ? t : 'Seguro ' + t; };

export const LISTA_BASE: [string, string][] = [
  ['Proteção de pavimentos e zonas de passagem', 'vg'], ['Remoção de revestimento cerâmico de paredes', 'm2'],
  ['Remoção de pavimento cerâmico', 'm2'], ['Remoção de louças sanitárias', 'un'],
  ['Remoção de entulho e transporte a vazadouro', 'vg'], ['Reboco de paredes', 'm2'], ['Barramento de paredes', 'm2'],
  ['Parede em pladur (estrutura, placa e isolamento)', 'm2'], ['Teto falso em pladur', 'm2'],
  ['Pintura de paredes (tinta plástica, 2 demãos)', 'm2'], ['Pintura de tetos', 'm2'],
  ['Assentamento de azulejo em paredes (mão de obra)', 'm2'], ['Assentamento de pavimento cerâmico (mão de obra)', 'm2'],
  ['Impermeabilização de zona de duche', 'm2'], ['Montagem de base de duche', 'un'],
  ['Montagem de sanita, lavatório ou bidé', 'un'], ['Ponto de água (abastecimento)', 'un'], ['Ponto de esgoto', 'un'],
  ['Ponto elétrico (tomada ou interruptor)', 'un'], ['Limpeza final da obra', 'vg']
];
