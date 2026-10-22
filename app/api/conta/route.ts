import { NextResponse } from 'next/server';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

// RGPD (direito ao apagamento): apaga ficheiros e a conta; as tabelas apagam em cascata.
export async function DELETE() {
  const u = await utilizadorAtual();
  if (!u) return NextResponse.json({ code: 'session_expired' }, { status: 401 });
  const admin = supabaseAdmin();
  for (const bucket of ['fotos', 'logos', 'propostas']) {
    // percorre a pasta do utilizador (fotos: <uid>/<orçamento>/<foto>.jpg; logos: <uid>/logo-*.png)
    const pastas = [u.id];
    while (pastas.length) {
      const pasta = pastas.pop()!;
      const { data } = await admin.storage.from(bucket).list(pasta, { limit: 1000 });
      const ficheiros: string[] = [];
      for (const item of data || []) {
        if (item.id) ficheiros.push(`${pasta}/${item.name}`);
        else pastas.push(`${pasta}/${item.name}`);
      }
      if (ficheiros.length) await admin.storage.from(bucket).remove(ficheiros);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) { console.error('apagar conta', error); return NextResponse.json({ code: 'erro' }, { status: 500 }); }
  await u.sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
