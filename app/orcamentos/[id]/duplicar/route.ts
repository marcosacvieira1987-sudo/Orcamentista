import { novoEstado, type Estado } from '@/lib/orc';
import { redirecionar } from '@/lib/redirecionar';
import { utilizadorAtual } from '@/lib/supabase/server';
import { uid } from '@/lib/util';

// Cria uma cópia do orçamento (pedido, leitura, medidas e linhas), com fotos próprias e número novo.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await utilizadorAtual();
  if (!u) return redirecionar('/entrar');
  const { data: orig } = await u.sb.from('orcamentos').select('dados, tipo, localidade, dono').eq('id', id).maybeSingle();
  if (!orig) return redirecionar('/orcamentos');
  const base = { ...novoEstado(), ...(orig.dados as Partial<Estado>) };
  const copia: Estado = {
    ...base, fotos: [], aprovado: false, revisto: false, mensagem: '', tempo: undefined,
    meta: { numero: '', data: '', validade: base.meta?.validade || '', prazo: base.meta?.prazo || '' },
    step: base.orc ? 'revisao' : 'pedido'
  };
  const { data: novo, error } = await u.sb.from('orcamentos').insert({ dados: copia, tipo: orig.tipo, localidade: orig.localidade, dono: orig.dono }).select('id').single();
  if (error || !novo) return redirecionar('/orcamentos?erro=duplicar');
  // fotos: cópia no Storage, na pasta do orçamento novo (a ordem mantém-se, por causa da numeração)
  const fotos = [];
  for (const f of base.fotos || []) {
    const fid = uid('F');
    const path = `${u.id}/${novo.id}/${fid}.jpg`;
    const { error: e2 } = await u.sb.storage.from('fotos').copy(f.path, path);
    if (!e2) fotos.push({ ...f, id: fid, path });
  }
  if (fotos.length) await u.sb.from('orcamentos').update({ dados: { ...copia, fotos } }).eq('id', novo.id);
  return redirecionar(`/orcamentos/${novo.id}`);
}
