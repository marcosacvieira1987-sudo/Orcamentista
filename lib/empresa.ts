import { EMPRESA_VAZIA, type Empresa, type ItemPreco } from './orc';
import { num, r2, un } from './util';

// Linha da tabela "empresas" → Empresa (tolerante a campos em falta).
export function lerEmpresa(row: Record<string, unknown> | null | undefined): Empresa {
  const r = row || {};
  const e: Empresa = { ...EMPRESA_VAZIA };
  for (const k of Object.keys(EMPRESA_VAZIA) as (keyof Empresa)[]) {
    if (r[k] === undefined || r[k] === null) continue;
    (e as Record<string, unknown>)[k] = r[k];
  }
  e.iva = num(e.iva) || 23;
  e.validade = Math.round(num(e.validade)) || 30;
  e.imprevistos = num(e.imprevistos);
  e.precos = Array.isArray(r.precos) ? (r.precos as Record<string, unknown>[]).map(lerPreco) : [];
  return e;
}

export function lerPreco(x: Record<string, unknown>): ItemPreco {
  const p = x?.preco;
  return {
    descricao: String(x?.descricao || '').trim(),
    unidade: un(String(x?.unidade || '').trim()) || 'un',
    preco: p === '' || p === null || p === undefined || !(num(p) > 0) ? null : r2(num(p))
  };
}
