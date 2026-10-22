import 'server-only';
// Prompts do orçamentista, herdados do protótipo. Só correm no servidor.
import type { Empresa, Estado, Modelo, Orc } from './orc';
import { ivaPadrao, totais, validadePadrao } from './orc';
import { fmtEUR, fmtN, num } from './util';

// Parte do estado que o cliente envia para montar os prompts.
export type Contexto = Pick<Estado, 'pedido' | 'leitura' | 'correcao' | 'perguntas' | 'respostas' | 'extra' | 'medidas'>;

function contexto(S: Contexto) {
  const p = S.pedido, L = S.leitura;
  const qa = (S.perguntas || []).map((q) => `- ${q.pergunta} → ${S.respostas[q.id] ? S.respostas[q.id] : '(sem resposta)'}`).join('\n');
  const med = (S.medidas || [])
    .map((m) => `- ${m.divisao || 'Divisão'}: ${m.estimar ? 'sem medidas (estimar pelas fotos)' : `comprimento ${m.comp || '?'} m, largura ${m.larg || '?'} m, pé-direito ${m.pd || '?'} m`}${m.vaos ? `; vãos: ${m.vaos}` : ''}${m.nota ? `; nota: ${m.nota}` : ''}`)
    .join('\n');
  return [
    'PEDIDO', p.texto || '(sem texto)',
    `Tipo de obra: ${p.tipo || 'não indicado'}. Localidade: ${p.localidade || 'não indicada'}.`,
    `Notas da visita: ${p.notas || '(sem notas)'}`,
    '', 'LEITURA DAS FOTOS (JSON)', L ? JSON.stringify(L) : '(sem fotos)',
    S.correcao ? `\nCORREÇÕES DO PROFISSIONAL À LEITURA\n${S.correcao}` : '',
    qa ? `\nPERGUNTAS E RESPOSTAS\n${qa}` : '',
    S.extra ? `\nINFORMAÇÃO EXTRA\n${S.extra}` : '',
    med ? `\nMEDIDAS (metros)\n${med}` : ''
  ].filter((x) => x !== '').join('\n');
}

function contextoEmpresa(e: Empresa) {
  return [
    `EMPRESA: ${e.nome || '(sem nome)'}`,
    `IVA padrão: ${ivaPadrao(e)}%`,
    e.nunca_inclui ? `Nunca incluído nas propostas: ${e.nunca_inclui}` : '',
    e.extras ? `Deslocação e entulho: ${e.extras}` : '',
    e.prazo ? `Prazo habitual: ${e.prazo}` : ''
  ].filter(Boolean).join('\n');
}

function tabelaTexto(e: Empresa) {
  const itens = e.precos.filter((i) => String(i.descricao || '').trim() && num(i.preco) > 0);
  if (!itens.length) return 'TABELA DE PREÇOS DO CLIENTE: vazia (não há preços próprios; estima todos os preços).';
  return 'TABELA DE PREÇOS DO CLIENTE (preços de venda sem IVA, por unidade)\n' + itens.map((i) => `- ${i.descricao} | ${i.unidade || 'un'} | ${fmtN(num(i.preco))} €`).join('\n');
}

/* ---------- 1. leitura das fotos ---------- */
export function promptLeitura(p: Contexto['pedido'], a: number, b: number, total: number) {
  return [
    `És o assistente de orçamentos de uma empresa de obras de remodelação em Portugal. Recebes ${b - a + 1} fotografias de uma obra (fotos ${a} a ${b}, de um total de ${total}), pela ordem da numeração.`,
    `Pedido do profissional: ${p.texto || '(sem texto)'}`,
    `Tipo de obra: ${p.tipo || 'não indicado'}. Localidade: ${p.localidade || 'não indicada'}.`,
    `Notas da visita: ${p.notas || '(sem notas)'}`,
    '',
    'Descreve o que vês, de forma objetiva, em português de Portugal (casa de banho, sanita, autoclismo, base de duche, pladur, tinta plástica, pavimento, rodapé, quadro elétrico).',
    'Regras: não inventes medidas nem estados que não se vejam. Se uma foto for um croqui ou mostrar uma fita métrica ou cotas escritas, transcreve as cotas em "cotas_lidas". Se vires sinais de problemas estruturais ou de materiais perigosos (por exemplo fibrocimento antigo), põe-nos em "alertas" com a recomendação de avaliação especializada.',
    '',
    'Responde só com um objeto JSON neste formato:',
    `{"fotos":[{"n":${a},"divisao":"Casa de banho","descricao":"legenda curta do que a foto mostra, no máximo 15 palavras"}],`,
    ' "divisoes":[{"nome":"Casa de banho","elementos":["base de duche"],"materiais":["azulejo cerâmico até ao teto"],"estado":["mancha de humidade junto à janela"]}],',
    ' "nao_consigo_ver":["estado da canalização embutida"],',
    ' "preciso_confirmar":["se a base de duche é para substituir"],',
    ' "trabalhos_provaveis":["remoção do revestimento cerâmico"],',
    ' "cotas_lidas":[],',
    ' "alertas":[]}',
    `Usa "n" de ${a} a ${b}. Agrupa por divisão, com nomes simples, e repete o mesmo nome quando é a mesma divisão. A "descricao" de cada foto é uma legenda para a proposta: concreta, no máximo 15 palavras, sem começar por "A foto mostra".`
  ].join('\n');
}

/* ---------- 2. perguntas ---------- */
export function promptPerguntas(S: Contexto) {
  return [
    'És o assistente de orçamentos de uma empresa de obras de remodelação em Portugal. Com base no pedido, na leitura das fotos e nas notas abaixo, escolhe as perguntas que ainda faltam para fazer um orçamento correto.',
    'Regras: no máximo 6 perguntas, as mais importantes primeiro; não perguntes medidas (vêm no passo seguinte); não perguntes o que já está respondido nas notas ou nas correções; uma pergunta por tema; português de Portugal, frases curtas.',
    'Temas habituais: âmbito (o que entra e o que fica de fora), gama de materiais, quem compra os materiais, acessos (andar, elevador, estacionamento), entulho, prazo desejado, horários do condomínio.',
    'Responde só com JSON: {"perguntas":[{"id":"q1","tema":"Âmbito","pergunta":"A base de duche é para substituir?","tipo":"sim_nao","opcoes":[],"unidade":"","porque":"Muda a demolição e a canalização."}]}',
    'Valores de "tipo": "escolha" (com 2 a 5 opções em "opcoes"), "sim_nao", "numero" (com "unidade") ou "texto".',
    '', contexto(S)
  ].join('\n');
}

/* ---------- 3. orçamento ---------- */
const REGRAS_LINHAS = [
  '2. Cada linha: "descricao" clara e específica, "unidade" (m2, ml, m3, un, vg ou h) e "quantidade" (número com ponto decimal).',
  '3. Quantidades: usa as medidas dadas e mostra a conta em "calculo" (ex.: "(2,10 + 1,80) x 2 x 2,40 - 1,60 = 17,12"). Se a quantidade vem das medidas, "qtd_origem":"medida"; se tiveste de estimar, "qtd_origem":"estimada".',
  '4. Preços por unidade, sem IVA. Se o trabalho existe na TABELA DE PREÇOS DO CLIENTE, usa esse preço exato, "fonte":"propria" e "ref" igual à descrição da tabela. Caso contrário, estima um preço de mercado em Portugal, com "fonte":"estimativa", "faixa_min" e "faixa_max" plausíveis e "preco" no meio da faixa. Nunca digas que um preço veio da tabela se não veio.',
  '5. "confirmar": true nas linhas que dependem de algo a confirmar na visita.',
  '6. Não ponhas IVA nas linhas e nunca menciones o IVA em "nao_incluido" nem em "pressupostos" (o IVA aparece sempre nos totais). Não incluas trabalhos que o profissional excluiu.'
];

const REGRAS_COMPLETA = [
  '',
  'PROPOSTA COMPLETA (o documento que convence o dono de obra a adjudicar)',
  '9. "titulo": título curto da obra para a capa (ex.: "Reabilitação do edifício", "Remodelação da casa de banho").',
  '10. "apresentacao": carta ao dono de obra, em 3 a 5 parágrafos separados por linha em branco. Começa pela saudação (ex.: "Exma. Senhora Inês Perez," ou "Exmos. Senhores," se não houver nome). Explica o que se encontrou na visita, as causas prováveis, as consequências de não intervir e porque é que a solução proposta é a certa. Usa **negrito** só em 2 ou 3 ideias-chave. Não ponhas valores, preços, totais, datas nem garantias na carta (isso aparece noutro sítio) e não ponhas despedida nem assinatura. Tom profissional, próximo e confiante, sem exageros.',
  '11. "encontramos": 2 a 3 frases que introduzem as fotos do estado atual e mostram a urgência (ex.: o que acontece se a obra esperar). "fotos_encontramos": números (n) das 4 a 6 fotos que melhor mostram os problemas.',
  '12. "fases": se a obra tiver uma ordem lógica de execução (ex.: primeiro fechar entradas de água, depois fachadas, depois interior), divide-a em 2 ou 3 fases, cada uma com "titulo" curto e "descricao" de 1 frase. Em obras pequenas usa só 1 fase.',
  '13. Em cada capítulo: "subtitulo" (onde, ex.: "Escritório, piso 1 e piso 2"; pode ficar vazio), "descricao" com 2 a 4 frases que explicam porque é que o trabalho é necessário e como é feito, "estado" com 2 a 6 constatações objetivas do estado atual (só o que se vê nas fotos ou foi dito), "fotos" com os números (n) de 0 a 2 fotos desse capítulo, "fase" (número da fase), "prazo" indicativo (ex.: "1 semana") e "nao_incluido" com o que fica de fora desse capítulo.',
  '14. Nunca inventes estados, medidas ou problemas que não estejam nas fotos, nas notas ou nas respostas.'
];

export function promptOrcamento(S: Contexto, e: Empresa, modelo: Modelo = 'rapido') {
  const completa = modelo === 'completo';
  const formato = completa
    ? '{"titulo":"...","apresentacao":"Exma. Senhora ...,\\n\\nNa visita ...","encontramos":"...","fotos_encontramos":[2,3],"fases":[{"titulo":"Fechar as entradas de água","descricao":"..."}],"capitulos":[{"nome":"Telhado","subtitulo":"","descricao":"...","estado":["..."],"fotos":[5],"fase":1,"prazo":"2 semanas","nao_incluido":["..."],"linhas":[{"descricao":"...","unidade":"m2","quantidade":5.04,"calculo":"2,10 x 2,40 = 5,04","qtd_origem":"medida","preco":12.5,"fonte":"estimativa","ref":"","faixa_min":10,"faixa_max":15,"confirmar":false,"nota":""}]}],"nao_incluido":["..."],"pressupostos":["..."],"a_confirmar":["..."],"prazo":"..."}'
    : '{"capitulos":[{"nome":"Demolições","descricao":"...","linhas":[{"descricao":"...","unidade":"m2","quantidade":5.04,"calculo":"2,10 x 2,40 = 5,04","qtd_origem":"medida","preco":12.5,"fonte":"estimativa","ref":"","faixa_min":10,"faixa_max":15,"confirmar":false,"nota":""}]}],"nao_incluido":["..."],"pressupostos":["..."],"a_confirmar":["..."],"prazo":"..."}';
  return [
    'És o orçamentista de uma empresa de obras de remodelação em Portugal. Monta o mapa de quantidades e preços desta obra, para o profissional rever antes de enviar ao dono de obra.',
    '',
    'REGRAS',
    '1. Organiza por capítulos, só os que a obra precisa (por exemplo: Trabalhos preparatórios e demolições; Canalização; Eletricidade; Pladur e tetos; Revestimentos; Pintura; Louças e equipamentos; Limpeza final). Em cada capítulo, "descricao" tem 1 a 3 frases claras para o dono de obra.',
    ...REGRAS_LINHAS,
    '7. "nao_incluido": o que fica de fora. "pressupostos": condições assumidas. "a_confirmar": pontos a confirmar na visita. "prazo": prazo indicativo curto (ex.: "3 semanas").',
    '8. Português de Portugal.',
    ...(completa ? REGRAS_COMPLETA : []),
    '',
    'Responde só com JSON neste formato:',
    formato,
    '', contextoEmpresa(e), '', tabelaTexto(e), '', contexto(S)
  ].join('\n');
}

export function promptAjuste(instr: string, orc: Orc, prazo: string, e: Empresa, modelo: Modelo = 'rapido') {
  const completa = modelo === 'completo';
  const atual = {
    ...(completa ? { titulo: orc.titulo, apresentacao: orc.apresentacao, encontramos: orc.encontramos, fotos_encontramos: orc.fotos_encontramos, fases: orc.fases } : {}),
    capitulos: orc.capitulos.map((c) => ({
      nome: c.nome, descricao: c.descricao,
      ...(completa ? { subtitulo: c.subtitulo, estado: c.estado, fotos: c.fotos, fase: c.fase, prazo: c.prazo, nao_incluido: c.nao_incluido } : {}),
      linhas: c.linhas.map((l) => ({ id: l.id, descricao: l.descricao, unidade: l.unidade, quantidade: l.quantidade, calculo: l.calculo, qtd_origem: l.qtd_origem, preco: l.preco, fonte: l.fonte, ref: l.ref, faixa_min: l.faixa_min, faixa_max: l.faixa_max, confirmar: l.confirmar, nota: l.nota, iva: l.iva, fixado: l.fixado }))
    })),
    nao_incluido: orc.nao_incluido, pressupostos: orc.pressupostos, a_confirmar: orc.a_confirmar, prazo: prazo || orc.prazo
  };
  return [
    'És o orçamentista de uma empresa de obras de remodelação em Portugal. Abaixo está o orçamento atual em JSON e um pedido de alteração do profissional.',
    `PEDIDO DE ALTERAÇÃO: ${instr}`,
    '',
    'Aplica só o que foi pedido e devolve o orçamento completo no mesmo formato JSON, com todos os campos. Mantém o "id" das linhas que ficam; linhas novas vão sem "id". Nas linhas com "fixado": true o preço foi confirmado pelo profissional: não o mudes, a não ser que o pedido o diga. Linhas novas seguem as mesmas regras de fonte: "propria" só com preço da tabela do cliente; senão "estimativa", com "faixa_min" e "faixa_max". Nunca menciones o IVA em "nao_incluido" nem em "pressupostos".',
    'Responde só com o JSON.',
    '', tabelaTexto(e), '', 'ORÇAMENTO ATUAL', JSON.stringify(atual)
  ].join('\n');
}

/* ---------- 4. mensagem ---------- */
export function promptMensagem(S: Pick<Estado, 'pedido' | 'meta' | 'orc'>, e: Empresa) {
  const t = totais(S.orc, e);
  const val = Math.round(num(S.meta.validade)) || validadePadrao(e);
  return `Escreve uma mensagem curta de WhatsApp, em português de Portugal, de ${e.nome || 'a empresa'} para ${S.pedido.dono || 'o dono de obra'}, a acompanhar a proposta de orçamento em PDF (proposta n.º ${S.meta.numero}, ${S.pedido.tipo || 'obra'}${S.pedido.localidade ? ' em ' + S.pedido.localidade : ''}).
Tom cordial e profissional, 4 a 6 linhas, sem emojis. Diz o total estimado com IVA (${fmtEUR(t.total)}), que os valores são estimativas a confirmar na visita técnica, que a proposta é válida por ${val} dias e convida a marcar a visita. Não acrescentes outros números, datas ou condições. Responde só com o texto da mensagem.`;
}
