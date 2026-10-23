import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropostaCliente from '@/components/PropostaCliente';
import { nomeFicheiro } from '@/lib/pdf';
import type { Instantaneo } from '@/lib/proposta';
import { supabaseAdmin, utilizadorAtual } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const valido = (t: string) => /^[0-9a-f]{32,128}$/.test(t);

async function ler(token: string) {
  if (!valido(token)) return null;
  const { data } = await supabaseAdmin().from('propostas').select('*').eq('token', token).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const p = await ler((await params).token);
  const s = p?.dados as Instantaneo | undefined;
  return {
    title: s ? `Proposta${s.meta.numero ? ' n.º ' + s.meta.numero : ''} · ${s.empresa.nome}` : 'Proposta',
    robots: { index: false, follow: false },
  };
}

const ERROS: Record<string, string> = { nome: 'Escreva o seu nome completo.', confirmo: 'Confirme que leu e aceita a proposta.', expirada: 'Esta proposta já expirou.' };

// Página pública da proposta: o cliente abre pelo link (sem conta). O token não se adivinha.
export default async function PaginaProposta({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ aceite?: string; erro?: string }> }) {
  const { token } = await params;
  const q = await searchParams;
  const p = await ler(token);
  if (!p) notFound();
  const snap = p.dados as Instantaneo;
  const admin = supabaseAdmin();

  // regista a visita do cliente (o próprio profissional não conta)
  const u = await utilizadorAtual();
  if (!u || u.id !== p.user_id) {
    await admin.from('propostas').update({ vistas: (p.vistas || 0) + 1, vista_em: p.vista_em || new Date().toISOString() }).eq('id', p.id);
  }

  // links temporários (1 hora) para o logótipo, o PDF e as fotografias de "O que encontrámos"
  const nums = (snap.orc.fotos_encontramos || []).filter((n) => snap.fotos[n - 1]).slice(0, 6);
  const [logo, pdf, fotos] = await Promise.all([
    snap.empresa.logo_path ? admin.storage.from('logos').createSignedUrl(snap.empresa.logo_path, 3600) : Promise.resolve({ data: null }),
    p.pdf_path ? admin.storage.from('propostas').createSignedUrl(p.pdf_path, 3600, { download: nomeFicheiro(snap.empresa.nome, snap.meta.numero) }) : Promise.resolve({ data: null }),
    nums.length ? admin.storage.from('fotos').createSignedUrls(nums.map((n) => snap.fotos[n - 1]), 3600) : Promise.resolve({ data: [] }),
  ]);
  const fotoUrls: Record<number, string> = {};
  (fotos.data || []).forEach((f, i) => { if (f?.signedUrl) fotoUrls[nums[i]] = f.signedUrl; });

  return (
    <PropostaCliente
      snap={snap} token={token}
      logoUrl={logo.data?.signedUrl || ''} pdfUrl={pdf.data?.signedUrl || ''} fotoUrls={fotoUrls}
      aceite={p.aceite_em ? { nome: p.aceite_nome || '', em: p.aceite_em } : null}
      recemAceite={q.aceite === '1'} erro={ERROS[q.erro || ''] || ''}
    />
  );
}
