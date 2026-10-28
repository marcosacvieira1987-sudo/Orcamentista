/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ASSINATURA, PRODUTO, PRODUTO_CURTO } from '@/lib/marca';
import { fmtDataLisboa as fmtData, fmtPreco, janelaLancamento, lancamentoAberto, PLANOS } from '@/lib/planos';
import { SITE } from '@/lib/site';
import HeroFilme from './HeroFilme';
import './landing.css';

// Página de apresentação para quem ainda não tem sessão. Os textos estão em lib/site.ts.

const I: Record<string, React.ReactNode> = {
  foto: <><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></>,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h1M4 12h1M4 18h1" /></>,
  voz: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  envio: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  numero: <><path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" /></>,
  copia: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  custo: <><circle cx="12" cy="12" r="9" /><path d="M15 9a3.5 3.5 0 1 0 0 6M7.5 11h5M7.5 13.5h5" /></>,
  escudo: <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  certo: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
};
const Icone = ({ n, s = 22 }: { n: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
);

export default function Landing() {
  const { hero, factos, passos, montra, funcoes, planos, notaPlanos, perguntas, final, negocio, contacto, video } = SITE;
  // durante o lançamento mostra o preço de lançamento (nunca como desconto)
  const lanc = lancamentoAberto();
  const tarifa = lanc ? 'lancamento' : 'normal';
  const completa = planos.find((p) => p.id === 'premium')!;
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-in lp-nav-in">
          <Link href="/" className="lp-logo" aria-label={PRODUTO}>
            <span className="lp-prumo" aria-hidden="true" /><span>{PRODUTO_CURTO}<span className="lp-assina">por MMGS</span></span>
          </Link>
          <nav aria-label="Secções" className="lp-links">
            <a href="#como">Como funciona</a>
            <a href="#proposta">A proposta</a>
            <a href="#planos">Planos</a>
          </nav>
          <div className="lp-nav-cta">
            <Link href="/entrar" className="lp-entrar">Entrar</Link>
            <Link href="/registar" className="lp-btn lp-btn-sm">Experimentar</Link>
          </div>
        </div>
      </header>

      <main>
        <section className={'lp-hero' + (video.mp4 ? ' lp-hero-filme' : '')}>
          <div className={'lp-in' + (video.mp4 ? ' lp-hero-grid' : '')}>
            <div>
              <p className="lp-eyebrow">{hero.eyebrow}</p>
              <h1>{hero.titulo.map((l, i) => <span key={i} className={i ? 'lp-hl' : undefined}>{l}</span>)}</h1>
              <p className="lp-hero-txt">{hero.texto}</p>
              <div className="lp-ctas">
                <Link href="/registar" className="lp-btn lp-btn-lg">{hero.cta}<Icone n="seta" s={18} /></Link>
                <a href="#proposta" className="lp-btn lp-btn-lg lp-btn-ghost">{hero.secundario}</a>
              </div>
              <div className="lp-factos" aria-label="Em números">
                {factos.map((f) => <div key={f.rotulo}><strong>{f.valor}</strong><span>{f.rotulo}</span></div>)}
              </div>
            </div>
            {video.mp4 ? <HeroFilme mp4={video.mp4} poster={video.poster || undefined} mostrarEm={video.cartas} desde={fmtPreco(PLANOS.essencial.precos[tarifa].mensal)} /> : null}
          </div>
          {video.mp4 ? null : (
            <div className="lp-leque" aria-hidden="true">
              <img src="/landing/pagina-03.webp" alt="" width={900} height={1272} className="lp-folha f1" />
              <img src="/landing/pagina-01.webp" alt="" width={900} height={1272} className="lp-folha f2" />
              <img src="/landing/pagina-04.webp" alt="" width={900} height={1272} className="lp-folha f3" />
            </div>
          )}
        </section>


        <section id="como" className="lp-sec">
          <div className="lp-in">
            <p className="lp-eyebrow lp-azul">Como funciona</p>
            <h2>Três passos. Sem folhas de cálculo.</h2>
            <ol className="lp-passos">
              {passos.map((p) => (
                <li key={p.n} className="lp-revela"><span className="lp-n">{p.n}</span><h3>{p.titulo}</h3><p>{p.texto}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section id="proposta" className="lp-sec lp-azulejo">
          <div className="lp-in">
            <p className="lp-eyebrow">{montra.eyebrow}</p>
            <h2>{montra.titulo}</h2>
            <p className="lp-sub">{montra.texto}</p>
          </div>
          <div className="lp-montra" tabIndex={0} aria-label="Páginas de uma proposta de exemplo">
            {montra.paginas.map((p) => (
              <figure key={p.src}>
                <img src={p.src} alt={`Exemplo: ${p.legenda}`} width={960} height={1280} loading="lazy" />
                <figcaption>{p.legenda}</figcaption>
              </figure>
            ))}
          </div>
          <div className="lp-in lp-montra-pe">
            <p>{montra.nota}</p>
            <a href={completa.exemplo.href} target="_blank" rel="noopener" className="lp-btn lp-btn-claro">Abrir o PDF de exemplo<Icone n="seta" s={18} /></a>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-in">
            <p className="lp-eyebrow lp-azul">Feito para a obra</p>
            <h2>Tudo o que precisa. Nada que atrapalhe.</h2>
            <div className="lp-funcoes">
              {funcoes.map((f) => (
                <div key={f.titulo} className="lp-funcao lp-revela"><span className="lp-ic"><Icone n={f.icone} /></span><h3>{f.titulo}</h3><p>{f.texto}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="lp-sec lp-cinza">
          <div className="lp-in">
            <p className="lp-eyebrow lp-azul">Planos</p>
            <h2>Escolha como quer apresentar-se.</h2>
            {lanc ? <p className="lp-lanc"><strong>Preço de lançamento</strong> até {fmtData(janelaLancamento().fim)}. Fica com ele nas renovações enquanto não cancelar.</p> : null}
            <div className="lp-planos">
              {planos.map((p) => {
                const d = PLANOS[p.id], pr = d.precos[tarifa];
                return (
                  <article key={p.id} className={'lp-plano' + (p.selo ? ' lp-plano-top' : '')}>
                    {p.selo ? <span className="lp-selo">{p.selo}</span> : null}
                    <h3>{d.nome}</h3>
                    <p className="lp-para">{p.para}</p>
                    <p className="lp-preco"><strong>{fmtPreco(pr.mensal)}</strong><span>/mês + IVA</span></p>
                    <p className="lp-anual">ou {fmtPreco(pr.anual)}/ano, com 2 meses oferecidos{lanc ? ` · preço normal ${fmtPreco(d.precos.normal.mensal)}/mês` : ''}</p>
                    <ul>
                      {p.inclui.map((x) => <li key={x}><Icone n="certo" s={18} />{x}</li>)}
                      {(p.emBreve || []).map((x) => <li key={x} className="lp-breve"><Icone n="certo" s={18} /><span>{x} <em>em breve</em></span></li>)}
                    </ul>
                    <Link href="/registar" className={'lp-btn lp-btn-lg' + (p.selo ? '' : ' lp-btn-escuro')}>Experimentar 14 dias grátis</Link>
                    <a href={p.exemplo.href} target="_blank" rel="noopener" className="lp-link">{p.exemplo.rotulo}</a>
                  </article>
                );
              })}
            </div>
            <p className="lp-nota">{notaPlanos}</p>
          </div>
        </section>

        {negocio ? (
          <section id="gestao" className="lp-sec lp-escuro">
            <div className="lp-in">
              <p className="lp-eyebrow">Também para a sua empresa</p>
              <h2>{negocio.nome}</h2>
              <p className="lp-sub">{negocio.frase}</p>
              <div className="lp-funcoes">
                {negocio.servicos.map((s) => <div key={s.titulo} className="lp-funcao"><h3>{s.titulo}</h3><p>{s.texto}</p></div>)}
              </div>
              <a href={negocio.contacto.href} className="lp-btn lp-btn-lg" target="_blank" rel="noopener">{negocio.contacto.rotulo}<Icone n="seta" s={18} /></a>
            </div>
          </section>
        ) : null}

        <section className="lp-sec">
          <div className="lp-in lp-estreito">
            <p className="lp-eyebrow lp-azul">Perguntas</p>
            <h2>Antes de começar.</h2>
            <div className="lp-faq">
              {perguntas.map((q) => <details key={q.p}><summary>{q.p}</summary><p>{q.r}</p></details>)}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-in">
            <h2>{final.titulo}</h2>
            <Link href="/registar" className="lp-btn lp-btn-lg">{final.cta}<Icone n="seta" s={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="lp-pe">
        <div className="lp-in lp-pe-in">
          <span className="lp-logo"><span className="lp-prumo" aria-hidden="true" /><span>{PRODUTO}<span className="lp-assina">{ASSINATURA}</span></span></span>
          <nav aria-label="Rodapé">
            <Link href="/entrar">Entrar</Link>
            <Link href="/registar">Criar conta</Link>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <a href={SITE.livroReclamacoes} target="_blank" rel="noopener">Livro de Reclamações</a>
            {contacto ? <a href={contacto.includes('@') ? `mailto:${contacto}` : contacto}>Contacto</a> : null}
          </nav>
          <p>© {new Date().getFullYear()} {PRODUTO}</p>
        </div>
      </footer>
    </div>
  );
}
