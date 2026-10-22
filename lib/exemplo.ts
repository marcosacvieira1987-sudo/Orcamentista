// Proposta fictícia para testar a marca no PDF sem usar a IA.
import type { Capitulo, Empresa, Linha, Modelo, Orc } from './orc';
import { ivaPadrao, totais, validadePadrao } from './orc';
import type { DadosPDF, ImagemBytes } from './pdf';
import { isoHoje, uid, un } from './util';

export function dadosExemplo(emp: Empresa, logo: ImagemBytes | null, modelo: Modelo = emp.modelo): DadosPDF {
  const L = (descricao: string, unidade: string, quantidade: number, preco: number, origem: Linha['qtd_origem'], confirmar = false): Linha => ({
    id: uid('L'), descricao, unidade: un(unidade), quantidade, calculo: '', qtd_origem: origem, preco, fonte: 'estimativa', ref: '',
    faixa_min: null, faixa_max: null, confirmar, nota: '', iva: ivaPadrao(emp), fixado: true
  });
  const C = (id: string, nome: string, descricao: string, fase: number, prazo: string, estado: string[], nao: string[], linhas: Linha[]): Capitulo =>
    ({ id, nome, descricao, subtitulo: '', estado, nao_incluido: nao, fotos: [], fase, prazo, linhas });
  const orc: Orc = {
    titulo: 'Remodelação da casa de banho',
    apresentacao: 'Exma. Senhora Maria Fernandes,\n\nNa visita à casa de banho encontrámos **azulejos soltos junto à base de duche** e sinais de humidade na parede contígua ao quarto. É o padrão típico de uma impermeabilização que já não cumpre a sua função.\n\nPor isso propomos começar por retirar os revestimentos e **refazer a impermeabilização e os pontos de água**, e só depois assentar os novos revestimentos. Assim o acabamento final fica protegido e a reparação não volta a ser necessária daqui a poucos anos.',
    encontramos: 'Fotografias tiradas na visita. **Os sinais de humidade tendem a crescer** se a origem não for tratada antes dos acabamentos.',
    fotos_encontramos: [],
    fases: [{ titulo: 'Demolição e redes', descricao: 'Retirar revestimentos, refazer canalização e impermeabilizar.' }, { titulo: 'Acabamentos', descricao: 'Revestimentos novos e limpeza final.' }],
    capitulos: [
      C('c1', 'Trabalhos preparatórios e demolições', 'Proteção das zonas de passagem e remoção dos revestimentos e das louças existentes, com o entulho levado a vazadouro.', 1, '3 dias', ['Azulejos soltos junto à base de duche', 'Louças com calcário e juntas escurecidas'], ['Licenças de ocupação da via pública'], [L('Proteção de pavimentos e zonas de passagem', 'vg', 1, 80, 'medida'), L('Remoção de revestimento cerâmico de paredes', 'm2', 18.5, 9, 'medida'), L('Remoção de louças sanitárias e base de duche', 'un', 4, 25, 'medida'), L('Remoção de entulho e transporte a vazadouro', 'vg', 1, 150, 'estimada', true)]),
      C('c2', 'Canalização', 'Revisão das alimentações de água e dos esgotos da casa de banho, com novos pontos para as louças.', 1, '1 semana', ['Tubagem antiga em ferro galvanizado'], ['Substituição da coluna do prédio'], [L('Ponto de água (abastecimento)', 'un', 5, 60, 'medida'), L('Ponto de esgoto', 'un', 3, 55, 'medida', true)]),
      C('c3', 'Revestimentos', 'Assentamento de azulejo nas paredes e de pavimento cerâmico, com o material escolhido pelo dono de obra.', 2, '1 semana', [], ['Fornecimento de azulejo e pavimento'], [L('Assentamento de azulejo em paredes (mão de obra)', 'm2', 18.5, 28, 'medida'), L('Assentamento de pavimento cerâmico (mão de obra)', 'm2', 4.2, 30, 'estimada')]),
      C('c4', 'Limpeza final', 'Limpeza da obra no fim dos trabalhos.', 2, '1 dia', [], [], [L('Limpeza final da obra', 'vg', 1, 60, 'medida')])
    ],
    nao_incluido: ['Louças, torneiras e revestimentos (fornecidos pelo dono de obra)', 'Licenças e taxas camarárias'],
    pressupostos: ['Acesso à obra em dias úteis, das 8h às 18h', 'Água e eletricidade disponíveis no local'],
    a_confirmar: ['Estado da canalização embutida, depois da remoção do azulejo'],
    prazo: '3 semanas'
  };
  return {
    empresa: emp, logo, pedido: { tipo: 'Casa de banho', localidade: 'Lisboa', dono: 'Maria Fernandes (exemplo)' },
    meta: { numero: 'EXEMPLO', data: isoHoje(), validade: validadePadrao(emp), prazo: '3 semanas' },
    orc, totais: totais(orc, emp), fotos: [], leitura: null, exemplo: true, modelo, mostrarPrecos: emp.mostrar_precos
  };
}
