import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Landing from '@/components/Landing';
import { PRODUTO } from '@/lib/marca';
import { ORDEM, PLANOS } from '@/lib/planos';
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
  // dados estruturados para os motores de busca: o produto e os preços normais dos planos (sem IVA)
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: PRODUTO, applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web', inLanguage: 'pt-PT', description: SITE.hero.texto,
    offers: ORDEM.map((p) => ({
      '@type': 'Offer', name: PLANOS[p].nome, priceCurrency: 'EUR', price: PLANOS[p].precos.normal.mensal,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: PLANOS[p].precos.normal.mensal, priceCurrency: 'EUR', unitCode: 'MON', valueAddedTaxIncluded: false },
    })),
    publisher: { '@type': 'Organization', name: SITE.titular.nome || 'MMGS' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <Landing />
    </>
  );
}
