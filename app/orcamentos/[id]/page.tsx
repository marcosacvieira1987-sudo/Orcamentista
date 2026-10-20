import { notFound } from 'next/navigation';
import Editor from '@/components/Editor';
import Topo from '@/components/Topo';
import { lerEmpresa } from '@/lib/empresa';
import { novoEstado, type Estado } from '@/lib/orc';
import { exigirUtilizador } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { sb, id: userId } = await exigirUtilizador();
  const [{ data: orc }, { data: emp }] = await Promise.all([
    sb.from('orcamentos').select('id, dados').eq('id', id).maybeSingle(),
    sb.from('empresas').select('*').maybeSingle()
  ]);
  if (!orc) notFound();
  const empresa = lerEmpresa(emp);
  const estado: Estado = { ...novoEstado(), ...(orc.dados as Partial<Estado>) };
  return (
    <div className="wrap" id="app">
      <Topo empresa={empresa.nome} atual="orcamentos" />
      <Editor orcId={orc.id} userId={userId} inicial={estado} empresa={empresa} />
    </div>
  );
}
