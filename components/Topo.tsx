/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { MarcaApp } from '@/lib/marca-app';
import { PRODUTO_CURTO, SLOGAN } from '@/lib/marca';
import { partesMarca } from '@/lib/orc';

// Cabeçalho das páginas com sessão: marca do profissional e menu.
// Com o espaço personalizado, mostra o logótipo e o app usa a cor da marca.
export default function Topo({ empresa, atual, marca }: { empresa?: string; atual?: 'orcamentos' | 'configuracao' | 'planos'; marca?: MarcaApp }) {
  const mc = empresa ? partesMarca(empresa) : { main: PRODUTO_CURTO, sub: SLOGAN };
  return (
    <header className="top">
      {marca && /^#[0-9A-F]{6}$/i.test(marca.cor) ? <style>{`:root{--accent:${marca.cor};--accent-ink:${marca.ink}}`}</style> : null}
      <Link href="/orcamentos" className="brand" style={{ textDecoration: 'none' }}>
        {marca?.logoUrl ? <img src={marca.logoUrl} alt={empresa || 'Logótipo'} /> : (
          <span className="wordmark">
            <span className={'wm-main' + (mc.main.length > 12 ? ' long' : '')}>{mc.main}</span>
            {mc.sub ? <span className="wm-sub">{mc.sub}</span> : null}
          </span>
        )}
      </Link>
      <nav className="menu" aria-label="Menu">
        <Link href="/orcamentos" aria-current={atual === 'orcamentos' ? 'page' : undefined}>Orçamentos</Link>
        <Link href="/configuracao" aria-current={atual === 'configuracao' ? 'page' : undefined}>Empresa</Link>
        <Link href="/planos" aria-current={atual === 'planos' ? 'page' : undefined}>Plano</Link>
        <form action="/auth/sair" method="post"><button type="submit">Sair</button></form>
      </nav>
    </header>
  );
}
