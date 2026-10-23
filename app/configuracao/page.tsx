import ConfigForm from '@/components/ConfigForm';
import Topo from '@/components/Topo';
import { lerEmpresa } from '@/lib/empresa';
import { marcaDaConta } from '@/lib/marca-app';
import { lerAcesso, textosNoMes } from '@/lib/plano';
import { exigirUtilizador } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Configuracao() {
  const { sb, id, email } = await exigirUtilizador();
  const [{ data }, acesso, usados] = await Promise.all([sb.from('empresas').select('*').maybeSingle(), lerAcesso(sb, id, email), textosNoMes(sb)]);
  const empresa = lerEmpresa(data);
  const marca = await marcaDaConta(sb, acesso, data);
  return (
    <div className="wrap">
      <Topo empresa={empresa.nome} atual="configuracao" marca={marca} />
      <ConfigForm inicial={empresa} userId={id} email={email} marca={{ pode: acesso.marca, usados, limite: Number.isFinite(acesso.limiteTextos) ? acesso.limiteTextos : null }} />
    </div>
  );
}
