import Link from 'next/link';
import { partesMarca } from '@/lib/orc';
import { PRODUTO_CURTO, SLOGAN } from '@/lib/marca';

// Cabeçalho das páginas com sessão: marca do profissional e menu.
export default function Topo({ empresa, atual }: { empresa?: string; atual?: 'orcamentos' | 'configuracao' | 'planos' }) {
  const mc = empresa ? partesMarca(empresa) : { main: PRODUTO_CURTO, sub: SLOGAN };
  return (
    <header className="top">
      <Link href="/orcamentos" className="brand" style={{ textDecoration: 'none' }}>
        <span className="wordmark">
          <span className={'wm-main' + (mc.main.length > 12 ? ' long' : '')}>{mc.main}</span>
          {mc.sub ? <span className="wm-sub">{mc.sub}</span> : null}
        </span>
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
