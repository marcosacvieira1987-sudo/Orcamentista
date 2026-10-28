'use client';
// Erro inesperado numa página: mensagem clara e forma de tentar de novo.
import Link from 'next/link';
import { useEffect } from 'react';

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="auth-palco">
      <main className="auth erro-pagina">
        <section className="intro">
          <Link href="/" className="auth-marca" aria-label="Página inicial do Prumo"><span className="auth-prumo" aria-hidden="true" />Prumo</Link>
          <h1>Algo correu mal</h1>
          <p className="lead">Não foi possível mostrar esta página. O seu trabalho já gravado está seguro. Tente de novo dentro de momentos.</p>
          {error.digest ? <p className="small muted">Referência: {error.digest}</p> : null}
        </section>
        <div className="row"><button className="btn primary" onClick={reset}>Tentar de novo</button><Link className="btn" href="/orcamentos">Os meus orçamentos</Link></div>
      </main>
    </div>
  );
}
