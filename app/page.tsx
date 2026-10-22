import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Landing from '@/components/Landing';
import { PRODUTO } from '@/lib/marca';
import { SITE } from '@/lib/site';
import { utilizadorAtual } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: `${PRODUTO} · Propostas de remodelação a partir de fotografias`,
  description: SITE.hero.texto,
  openGraph: { title: PRODUTO, description: SITE.hero.texto, locale: 'pt_PT', type: 'website', images: ['/landing/pagina-01.webp'] },
};

// Com sessão vai direto aos orçamentos; sem sessão mostra a apresentação do produto.
export default async function Inicio() {
  if (await utilizadorAtual()) redirect('/orcamentos');
  return <Landing />;
}
