import type { MetadataRoute } from 'next';

// Só a apresentação e as páginas legais aparecem nos motores de busca.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/orcamentos', '/configuracao', '/planos', '/api/', '/auth/'] } };
}
