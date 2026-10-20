import { novoEstado } from '@/lib/orc';
import { redirecionar } from '@/lib/redirecionar';
import { utilizadorAtual } from '@/lib/supabase/server';

export async function POST() {
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const { data, error } = await u.sb.from('orcamentos').insert({ dados: novoEstado() }).select('id').single();
  if (error || !data) return redirecionar('/orcamentos?erro=criar');
  return redirecionar(`/orcamentos/${data.id}`);
}
