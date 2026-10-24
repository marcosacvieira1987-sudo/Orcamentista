import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Robôs e verificadores de links conhecidos (por precaução: normalmente nem executam o JavaScript que chama isto).
const ROBO = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|outlook|microsoft|safelinks|headless|curl|wget|python|node-fetch/i;

// Regista uma visita do cliente à página da proposta. O próprio profissional não conta.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32,128}$/.test(token) || ROBO.test(req.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
  const admin = supabaseAdmin();
  const { data: p } = await admin.from('propostas').select('id, user_id, vistas, vista_em').eq('token', token).maybeSingle();
  if (!p) return new Response(null, { status: 204 });
  const u = await utilizadorAtual();
  if (u?.id === p.user_id) return new Response(null, { status: 204 });
  await admin.from('propostas').update({ vistas: (p.vistas || 0) + 1, vista_em: p.vista_em || new Date().toISOString() }).eq('id', p.id);
  return new Response(null, { status: 204 });
}
