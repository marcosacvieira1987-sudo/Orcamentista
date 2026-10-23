import type { MetadataRoute } from 'next';
import { PRODUTO, PRODUTO_CURTO, SLOGAN } from '@/lib/marca';

// Permite instalar o app no ecrã principal do telemóvel ("Adicionar ao ecrã principal").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUTO,
    short_name: PRODUTO_CURTO,
    description: SLOGAN,
    lang: 'pt-PT',
    start_url: '/orcamentos',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F2EA',
    theme_color: '#2B2A28',
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
