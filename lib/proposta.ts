// Página da proposta para o cliente final: o que fica guardado quando o profissional envia
// (uma cópia, para o cliente ver e aceitar essa versão) e as contas da validade.
import { EMPRESA_VAZIA, type Empresa, type Estado, type Meta, type Modelo, type MostrarPrecos, type Orc } from './orc';
import { isoHoje, num } from './util';

const CAMPOS_EMPRESA = [
  'nome', 'nif', 'telefone', 'email', 'site', 'morada', 'alvara', 'cor', 'cor2', 'logo_path', 'slogan', 'assinante',
  'apresentacao', 'condicoes_texto', 'garantia', 'garantia_texto', 'seguro', 'seguro_apolice', 'seguro_validade',
  'pagamento', 'prazo', 'extras', 'nunca_inclui', 'iva', 'validade', 'imprevistos', 'pag_adjudicacao', 'pag_inicio', 'pag_conclusao',
  'banco', 'iban', 'bic', 'estilo',
] as const satisfies readonly (keyof Empresa)[];

export type EmpresaPublica = Pick<Empresa, (typeof CAMPOS_EMPRESA)[number]>;
export type Instantaneo = {
  v: 1;
  empresa: EmpresaPublica;
  pedido: { tipo: string; localidade: string; dono: string };
  meta: Meta;
  orc: Orc;
  modelo: Modelo;
  mostrar_precos: MostrarPrecos;
  fotos: string[]; // caminhos no Storage (bucket "fotos"), pela ordem do orçamento
};

export function instantaneo(S: Estado, e: Empresa): Instantaneo {
  const empresa = Object.fromEntries(CAMPOS_EMPRESA.map((k) => [k, e[k]])) as EmpresaPublica;
  return {
    v: 1, empresa,
    pedido: { tipo: S.pedido.tipo, localidade: S.pedido.localidade, dono: S.pedido.dono },
    meta: S.meta, orc: S.orc!, modelo: S.modelo || e.modelo, mostrar_precos: S.mostrar_precos || e.mostrar_precos,
    fotos: S.fotos.map((f) => f.path),
  };
}

// Empresa completa para as contas (totais, fases, pagamentos) a partir da cópia guardada.
export const empresaDe = (i: Instantaneo): Empresa => ({ ...EMPRESA_VAZIA, ...i.empresa });

// 48 caracteres hexadecimais aleatórios: o link não se adivinha.
export function gerarToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function validadeDe(meta: Meta, e: Pick<Empresa, 'validade'>) {
  const dias = Math.round(num(meta.validade)) || Math.round(num(e.validade)) || 30;
  const [y, m, d] = String(meta.data || isoHoje()).split('-').map(Number);
  const emitida = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1));
  // válida até ao fim do último dia (hora de Lisboa ≈ UTC + 1 h no máximo)
  const ate = new Date(emitida.getTime() + dias * 86400000);
  const expira = new Date(ate.getTime() + 25 * 3600000);
  return { dias, emitida, ate, expirada: Date.now() > expira.getTime() };
}
