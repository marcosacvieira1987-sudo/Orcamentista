import Link from 'next/link';
import { ASSINATURA } from '@/lib/marca';

// Página não encontrada (inclui links de propostas que não existem ou foram removidas).
export default function NaoEncontrada() {
  return (
    <div className="auth-palco">
      <main className="auth erro-pagina">
        <section className="intro">
          <Link href="/" className="auth-marca" aria-label="Página inicial do Prumo"><span className="auth-prumo" aria-hidden="true" />Prumo</Link>
          <h1>Não encontrámos esta página</h1>
          <p className="lead">O link pode estar incompleto ou já não existir. Se recebeu uma proposta, peça à empresa que lha envie de novo.</p>
        </section>
        <div className="row"><Link className="btn primary" href="/">Ir para o início</Link><Link className="btn" href="/orcamentos">Os meus orçamentos</Link></div>
      </main>
      <footer className="auth-assina">{ASSINATURA}</footer>
    </div>
  );
}
