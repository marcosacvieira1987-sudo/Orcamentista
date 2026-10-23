import { NextResponse } from 'next/server';
import { ehAdmin } from '@/lib/planos';
import { origemDoPedido } from '@/lib/redirecionar';
import { configurarStripe, stripeConfigurado, verificarStripe } from '@/lib/stripe';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Só para administradores (CONTAS_ADMIN): ver o estado do Stripe e criar o que faltar.
async function admin() {
  const u = await utilizadorAtual();
  return u && ehAdmin(u.email) ? u : null;
}

export async function GET(req: Request) {
  if (!(await admin())) return NextResponse.json({ code: 'proibido' }, { status: 403 });
  if (!stripeConfigurado()) return NextResponse.json({ code: 'sem_chave' }, { status: 400 });
  try { return NextResponse.json(await verificarStripe(origemDoPedido(req))); }
  catch (e) { console.error('stripe verificar', e); return NextResponse.json({ code: 'stripe', mensagem: e instanceof Error ? e.message : '' }, { status: 502 }); }
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ code: 'proibido' }, { status: 403 });
  if (!stripeConfigurado()) return NextResponse.json({ code: 'sem_chave' }, { status: 400 });
  try {
    const origem = origemDoPedido(req);
    const r = await configurarStripe(origem);
    return NextResponse.json({ ...r, estado: await verificarStripe(origem) });
  } catch (e) {
    console.error('stripe configurar', e);
    return NextResponse.json({ code: 'stripe', mensagem: e instanceof Error ? e.message : '' }, { status: 502 });
  }
}
