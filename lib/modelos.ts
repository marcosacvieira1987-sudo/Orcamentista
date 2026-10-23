// Três modelos de apresentação prontos: um estilo visual (página da proposta) e textos-base.
// Os textos só usam o que o profissional indicou (questionário e dados da empresa): nada de factos inventados.
// No Essencial são estes os textos; no Pro e no Premium a IA pode reescrevê-los a partir do questionário.
import type { Empresa, Estilo, Questionario } from './orc';

type Textos = { apresentacao: string; condicoes: string; garantia: string };
export type ModeloApresentacao = { id: Estilo; nome: string; descricao: string; textos: (e: Pick<Empresa, 'nome' | 'garantia'>, q: Questionario) => Textos };

const anos = (v?: string) => { const t = String(v || '').trim(); return !t ? '' : /^\d+$/.test(t) ? `${t} ${t === '1' ? 'ano' : 'anos'}` : t; };
const frase = (t: string) => t.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim();
const lista = (v?: string) => String(v || '').trim().replace(/[.\s]+$/, '');
const garantiaBase = (e: Pick<Empresa, 'garantia'>, q: Questionario) =>
  e.garantia ? frase(`Durante ${e.garantia}, corrigimos sem custos qualquer defeito de execução nos trabalhos realizados${q.garantia ? ` (${lista(q.garantia)})` : ''}.`) : '';

export const MODELOS: ModeloApresentacao[] = [
  {
    id: 'classico', nome: 'Clássico', descricao: 'Próximo e de confiança. Cabeçalho claro, linhas finas.',
    textos: (e, q) => ({
      apresentacao: [
        frase(`A ${e.nome || 'nossa empresa'} faz obras de remodelação${q.zona ? ` em ${lista(q.zona)}` : ''}${anos(q.anos) ? `, com ${anos(q.anos)} de experiência` : ''}.${q.especialidades ? ` Trabalhamos sobretudo em ${lista(q.especialidades)}.` : ''}`),
        'Preparamos cada proposta depois de ver a obra, com os trabalhos descritos um a um, para que saiba exatamente o que vai ser feito e quanto custa.',
      ].join('\n\n'),
      condicoes: [
        'As datas de início e de conclusão são acertadas na adjudicação.',
        'Os materiais escolhidos pelo cliente devem estar em obra na data combinada, para não atrasar os trabalhos.',
        'Alterações pedidas durante a obra podem mudar o valor e o prazo, e são sempre combinadas antes.',
      ].join('\n'),
      garantia: garantiaBase(e, q),
    }),
  },
  {
    id: 'moderno', nome: 'Moderno', descricao: 'Direto e confiante. Faixa de cor e cartões.',
    textos: (e, q) => ({
      apresentacao: [
        frase(`Remodelações${q.zona ? ` em ${lista(q.zona)}` : ''}, com proposta clara e prazos definidos.${q.especialidades ? ` Fazemos sobretudo ${lista(q.especialidades)}.` : ''}`),
        frase(`Na ${e.nome || 'nossa empresa'} sabe desde o início o que inclui a obra, o que fica de fora e como se paga.${q.diferenca ? ` ${lista(q.diferenca)}.` : ''}`),
      ].join('\n\n'),
      condicoes: [
        'Início e conclusão combinados na adjudicação.',
        'Materiais escolhidos pelo cliente em obra na data combinada.',
        'Qualquer alteração ao que está descrito é orçamentada e aprovada antes de avançar.',
      ].join('\n'),
      garantia: garantiaBase(e, q),
    }),
  },
  {
    id: 'sobrio', nome: 'Sóbrio', descricao: 'Técnico e rigoroso. Preto e branco, pouca cor.',
    textos: (e, q) => ({
      apresentacao: [
        frase(`A ${e.nome || 'nossa empresa'} executa trabalhos de construção e remodelação${q.zona ? ` em ${lista(q.zona)}` : ''}${anos(q.anos) ? ` há ${anos(q.anos)}` : ''}.${q.equipa ? ` ${lista(q.equipa)}.` : ''}`),
        'As nossas propostas descrevem cada trabalho com as quantidades medidas na obra, indicam o que não está incluído e os pontos a confirmar antes de começar.',
      ].join('\n\n'),
      condicoes: [
        'O prazo de execução conta a partir da data de início acordada na adjudicação.',
        'Os materiais a fornecer pelo cliente devem estar disponíveis em obra antes do início dos trabalhos respetivos.',
        'Alterações ao âmbito dos trabalhos são objeto de orçamento adicional, aprovado por escrito antes da execução.',
      ].join('\n'),
      garantia: garantiaBase(e, q),
    }),
  },
];

export const modeloDe = (id?: string) => MODELOS.find((m) => m.id === id) || MODELOS[0];
