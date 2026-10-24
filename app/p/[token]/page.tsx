import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropostaCliente from '@/components/PropostaCliente';
import { nomeFicheiro } from '@/lib/pdf';
import type { Instantaneo } from '@/lib/proposta';
import { supabaseAdmin } from '@/lib/supabase/server';

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
  const titulo = s ? `Proposta${s.meta.numero ? ' n.º ' + s.meta.numero : ''} · ${s.empresa.nome}` : 'Proposta';
  // pré-visualização do link no WhatsApp e no email: só o título e quem envia (sem valores)
  const descricao = s ? `Proposta de orçamento de ${s.empresa.nome || 'a empresa'}${s.orc.titulo ? ': ' + s.orc.titulo : ''}.` : '';
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, type: 'website', locale: 'pt_PT', siteName: s?.empresa.nome || undefined },
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

  // a visita conta-se no browser (RegistarVisita), para os robôs de pré-visualização não contarem

  // links temporários (1 hora) para o logótipo, o PDF e as fotografias de "O que encontrámos".
  // A cópia é escrita pela conta do profissional: só se assinam ficheiros da pasta dessa conta,
  // para ninguém conseguir links para ficheiros de outra conta pondo caminhos alheios na cópia.
  const daConta = (x: unknown): x is string => typeof x === 'string' && x.startsWith(`${p.user_id}/`) && !x.includes('..');
  const pdfPath = `${p.user_id}/${p.orcamento_id}/proposta.pdf`;
  const nums = (snap.orc.fotos_encontramos || []).filter((n) => daConta(snap.fotos[n - 1])).slice(0, 6);
  const [logo, pdf, fotos] = await Promise.all([
    daConta(snap.empresa.logo_path) ? admin.storage.from('logos').createSignedUrl(snap.empresa.logo_path, 3600) : Promise.resolve({ data: null }),
    p.pdf_path === pdfPath ? admin.storage.from('propostas').createSignedUrl(pdfPath, 3600, { download: nomeFicheiro(snap.empresa.nome, snap.meta.numero) }) : Promise.resolve({ data: null }),
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
