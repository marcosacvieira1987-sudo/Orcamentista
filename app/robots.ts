import type { MetadataRoute } from 'next';

// Só a apresentação e as páginas legais aparecem nos motores de busca.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL || 'https://orcamentista-coral.vercel.app').replace(/\/$/, '');
  return { rules: { userAgent: '*', allow: '/', disallow: ['/orcamentos', '/configuracao', '/planos', '/admin', '/p/', '/api/', '/auth/'] }, sitemap: `${base}/sitemap.xml` };
}
