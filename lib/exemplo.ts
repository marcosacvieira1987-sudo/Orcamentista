// Proposta fictícia para testar a marca no PDF sem usar a IA.
import type { Empresa, Linha, Orc } from './orc';
import { ivaPadrao, totais, validadePadrao } from './orc';
import type { DadosPDF, ImagemBytes } from './pdf';
import { isoHoje, uid, un } from './util';

export function dadosExemplo(emp: Empresa, logo: ImagemBytes | null): DadosPDF {
  const L = (descricao: string, unidade: string, quantidade: number, preco: number, origem: Linha['qtd_origem'], confirmar = false): Linha => ({
    id: uid('L'), descricao, unidade: un(unidade), quantidade, calculo: '', qtd_origem: origem, preco, fonte: 'estimativa', ref: '',
    faixa_min: null, faixa_max: null, confirmar, nota: '', iva: ivaPadrao(emp), fixado: true
  });
  const orc: Orc = {
    capitulos: [
      { id: 'c1', nome: 'Trabalhos preparatórios e demolições', descricao: 'Proteção das zonas de passagem e remoção dos revestimentos e das louças existentes, com o entulho levado a vazadouro.', linhas: [L('Proteção de pavimentos e zonas de passagem', 'vg', 1, 80, 'medida'), L('Remoção de revestimento cerâmico de paredes', 'm2', 18.5, 9, 'medida'), L('Remoção de louças sanitárias e base de duche', 'un', 4, 25, 'medida'), L('Remoção de entulho e transporte a vazadouro', 'vg', 1, 150, 'estimada', true)] },
      { id: 'c2', nome: 'Canalização', descricao: 'Revisão das alimentações de água e dos esgotos da casa de banho, com novos pontos para as louças.', linhas: [L('Ponto de água (abastecimento)', 'un', 5, 60, 'medida'), L('Ponto de esgoto', 'un', 3, 55, 'medida', true)] },
      { id: 'c3', nome: 'Revestimentos', descricao: 'Assentamento de azulejo nas paredes e de pavimento cerâmico, com o material escolhido pelo dono de obra.', linhas: [L('Assentamento de azulejo em paredes (mão de obra)', 'm2', 18.5, 28, 'medida'), L('Assentamento de pavimento cerâmico (mão de obra)', 'm2', 4.2, 30, 'estimada')] },
      { id: 'c4', nome: 'Limpeza final', descricao: 'Limpeza da obra no fim dos trabalhos.', linhas: [L('Limpeza final da obra', 'vg', 1, 60, 'medida')] }
    ],
    nao_incluido: ['Louças, torneiras e revestimentos (fornecidos pelo dono de obra)', 'Licenças e taxas camarárias'],
    pressupostos: ['Acesso à obra em dias úteis, das 8h às 18h', 'Água e eletricidade disponíveis no local'],
    a_confirmar: ['Estado da canalização embutida, depois da remoção do azulejo'],
    prazo: '3 semanas'
  };
  return {
    empresa: emp, logo, pedido: { tipo: 'Casa de banho', localidade: 'Lisboa', dono: 'Dono de obra (exemplo)' },
    meta: { numero: 'EXEMPLO', data: isoHoje(), validade: validadePadrao(emp), prazo: '3 semanas' },
    orc, totais: totais(orc, emp), fotos: [], leitura: null, exemplo: true
  };
}
