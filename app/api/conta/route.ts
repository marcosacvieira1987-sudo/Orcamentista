import { NextResponse } from 'next/server';
import { ESTADOS_ATIVOS } from '@/lib/plano';
import { stripe, stripeConfigurado } from '@/lib/stripe';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

// RGPD (direito ao apagamento): apaga ficheiros e a conta; as tabelas apagam em cascata.
export async function DELETE() {
  const u = await utilizadorAtual();
  if (!u) return NextResponse.json({ code: 'session_expired' }, { status: 401 });
  const admin = supabaseAdmin();
  // primeiro termina a subscrição, para não continuar a cobrar uma conta que deixa de existir
  const { data: ass } = await admin.from('assinaturas').select('stripe_subscription, estado').eq('user_id', u.id).maybeSingle();
  if (ass?.stripe_subscription && ESTADOS_ATIVOS.includes(String(ass.estado)) && stripeConfigurado()) {
    try { await stripe().subscriptions.cancel(ass.stripe_subscription); }
    catch (e) { console.error('cancelar subscrição', e); return NextResponse.json({ code: 'subscricao' }, { status: 500 }); }
  }
  // Os ficheiros apagam-se todos antes da conta: qualquer erro devolve 500 e a conta fica, para se poder repetir.
  const falhou = (passo: string, e: unknown) => {
    console.error('apagar conta:', passo, e);
    return NextResponse.json({ code: 'ficheiros' }, { status: 500 });
  };
  for (const bucket of ['fotos', 'logos', 'propostas']) {
    const st = admin.storage.from(bucket);
    // percorre a pasta do utilizador (fotos: <uid>/<orçamento>/<foto>.jpg; logos: <uid>/logo-*.png)
    const pastas = [u.id];
    while (pastas.length) {
      const pasta = pastas.pop()!;
      const ficheiros: string[] = [];
      // a listagem devolve no máximo 1000 de cada vez
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await st.list(pasta, { limit: 1000, offset });
        if (error) return falhou(`listar ${bucket}`, error);
        for (const item of data) {
          if (item.id) ficheiros.push(`${pasta}/${item.name}`);
          else pastas.push(`${pasta}/${item.name}`);
        }
        if (data.length < 1000) break;
      }
      for (let i = 0; i < ficheiros.length; i += 1000) {
        const { error } = await st.remove(ficheiros.slice(i, i + 1000));
        if (error) return falhou(`remover ${bucket}`, error);
      }
    }
    const { data: resto, error } = await st.list(u.id, { limit: 1 });
    if (error || resto.length) return falhou(`confirmar ${bucket} vazio`, error);
  }
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) { console.error('apagar conta', error); return NextResponse.json({ code: 'erro' }, { status: 500 }); }
  await u.sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
