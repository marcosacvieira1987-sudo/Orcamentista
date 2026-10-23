import { avisarPorEmail } from '@/lib/avisos';
import { empresaDe, validadeDe, type Instantaneo } from '@/lib/proposta';
import { redirecionar } from '@/lib/redirecionar';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fmtEUR } from '@/lib/util';
import { totais } from '@/lib/orc';

export const runtime = 'nodejs';

// "Aceitar proposta": regista o nome e a data (uma só vez) e avisa o profissional.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32,128}$/.test(token)) return new Response('Não encontrado', { status: 404 });
  const volta = (q: string) => redirecionar(`/p/${token}${q}#aceitar`);
  const form = await req.formData();
  const nome = String(form.get('nome') || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const nota = String(form.get('nota') || '').trim().slice(0, 1000);
  if (nome.length < 3) return volta('?erro=nome');
  if (form.get('confirmo') !== '1') return volta('?erro=confirmo');

  const admin = supabaseAdmin();
  const { data: p } = await admin.from('propostas').select('id, user_id, dados, aceite_em').eq('token', token).maybeSingle();
  if (!p) return new Response('Não encontrado', { status: 404 });
  if (p.aceite_em) return volta('');
  const snap = p.dados as Instantaneo;
  if (validadeDe(snap.meta, snap.empresa).expirada) return volta('?erro=expirada');

  const agora = new Date().toISOString();
  // "is null": se dois pedidos chegarem ao mesmo tempo, só o primeiro fica
  const { data: feito } = await admin.from('propostas').update({ aceite_nome: nome, aceite_em: agora, aceite_nota: nota || null }).eq('id', p.id).is('aceite_em', null).select('id');
  if (feito?.length) {
    const { data: u } = await admin.auth.admin.getUserById(p.user_id);
    const T = totais(snap.orc, empresaDe(snap));
    const n = snap.meta.numero ? ` n.º ${snap.meta.numero}` : '';
    await avisarPorEmail(u?.user?.email || '', `Proposta${n} aceite por ${nome}`,
      [`${nome} aceitou a proposta${n} (${snap.orc.titulo || 'orçamento'}), pelo valor global de ${fmtEUR(T.semIva)} + IVA.`,
        nota ? `Nota do cliente: ${nota}` : '',
        `Data: ${new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'long', timeStyle: 'short' }).format(new Date(agora))}`,
        'Abra o Prumo para ver os detalhes e combinar os próximos passos.'].filter(Boolean).join('\n\n'));
  }
  return redirecionar(`/p/${token}?aceite=1`);
}
