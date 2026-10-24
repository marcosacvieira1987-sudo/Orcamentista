import type { MetadataRoute } from 'next';

// Páginas públicas. O endereço vem de SITE_URL (domínio próprio quando existir).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL || 'https://orcamentista-coral.vercel.app').replace(/\/$/, '');
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/termos`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacidade`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
