import ConfigForm from '@/components/ConfigForm';
import Topo from '@/components/Topo';
import { lerEmpresa } from '@/lib/empresa';
import { exigirUtilizador } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Configuracao() {
  const { sb, id, email } = await exigirUtilizador();
  const { data } = await sb.from('empresas').select('*').maybeSingle();
  const empresa = lerEmpresa(data);
  return (
    <div className="wrap">
      <Topo empresa={empresa.nome} atual="configuracao" />
      <ConfigForm inicial={empresa} userId={id} email={email} />
    </div>
  );
}
