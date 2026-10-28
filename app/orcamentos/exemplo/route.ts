import { lerEmpresa } from '@/lib/empresa';
import { dadosExemplo } from '@/lib/exemplo';
import { novoEstado, type Estado } from '@/lib/orc';
import { redirecionar } from '@/lib/redirecionar';
import { utilizadorAtual } from '@/lib/supabase/server';

// Orçamento de exemplo (valores fictícios, sem usar a IA), para ver o resultado final logo no início.
// Um por conta: se já existir, abre esse.
export async function POST() {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const { data: ja } = await u.sb.from('orcamentos').select('id').eq('dados->>exemplo', 'true').limit(1).maybeSingle();
  if (ja) return redirecionar(`/orcamentos/${ja.id}`);
  const { data: row } = await u.sb.from('empresas').select('*').maybeSingle();
  const d = dadosExemplo(lerEmpresa(row), null);
  const base = novoEstado();
  const dados: Estado = {
    ...base, step: 'pdf', revisto: true, aprovado: true, exemplo: true,
    pedido: { ...base.pedido, tipo: 'Casa de banho', localidade: d.pedido.localidade, dono: d.pedido.dono },
    meta: d.meta, orc: d.orc, modelo: d.modelo, mostrar_precos: d.mostrarPrecos,
  };
  const { data, error } = await u.sb.from('orcamentos').insert({
    dados, estado: 'aprovado', numero: d.meta.numero, tipo: 'Casa de banho', localidade: d.pedido.localidade, dono: d.pedido.dono, total: d.totais.total,
  }).select('id').single();
  if (error || !data) return redirecionar('/orcamentos?erro=criar');
  return redirecionar(`/orcamentos/${data.id}`);
}
