import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Instrument_Sans } from 'next/font/google';
import { PRODUTO, SLOGAN } from '@/lib/marca';
import './globals.css';

// Letras servidas pelo próprio site (descarregadas na compilação): o browser do visitante não contacta o Google.
const sans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--letra-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--letra-mono', display: 'swap' });

export const metadata: Metadata = { title: PRODUTO, description: SLOGAN, appleWebApp: { capable: true, title: 'Prumo', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F6F2EA' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
