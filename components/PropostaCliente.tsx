/* eslint-disable @next/next/no-img-element */
// Página da proposta para o cliente final: com a marca do profissional, o PDF e o botão "Aceitar proposta".
import { corLegivel, textoSobre } from '@/lib/cores';
import { PRODUTO } from '@/lib/marca';
import { descObra, planoPagamentos, resumoFases, semIva, subtotal, totais, totalLinha, valorCapitulo } from '@/lib/orc';
import { empresaDe, validadeDe, type Instantaneo } from '@/lib/proposta';
import { fmtEUR, fmtQ, maiuscula } from '@/lib/util';
import RegistarVisita from './RegistarVisita';
import './proposta.css';

export type Aceite = { nome: string; em: string } | null;

const fmtData = (d: Date) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const fmtDataHora = (d: Date) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

// **negrito** dos textos da IA
function Rico({ t }: { t: string }) {
  return <>{t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}
const Paragrafos = ({ t }: { t: string }) => <>{t.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}><Rico t={p} /></p>)}</>;

const telWa = (t: string) => { let n = String(t || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, ''); if (/^[29]\d{8}$/.test(n)) n = '351' + n; return n; };

export default function PropostaCliente({ snap, token, logoUrl, pdfUrl, fotoUrls, aceite, recemAceite, erro }: {
  snap: Instantaneo; token: string; logoUrl: string; pdfUrl: string; fotoUrls: Record<number, string>; aceite: Aceite; recemAceite: boolean; erro: string;
}) {
  const e = empresaDe(snap), o = snap.orc, completa = snap.modelo === 'completo';
  const T = totais(o, e);
  const val = validadeDe(snap.meta, e);
  const detalhado = !completa || snap.mostrar_precos === 'detalhado';
  const fases = completa ? resumoFases(o, e) : [];
  const variasFases = fases.length > 1;
  const pagamentos = planoPagamentos(o, e);
  const marca = corLegivel(e.cor || '#2B2A28');
  const estilo = e.estilo || 'classico';
  const titulo = o.titulo || maiuscula(descObra(snap.pedido.tipo));
  const naoIncl = semIva(o.nao_incluido.length ? o.nao_incluido : String(e.nunca_inclui || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean));
  const fotosEnc = (o.fotos_encontramos || []).filter((n) => fotoUrls[n]).slice(0, 6);
  const numero = snap.meta.numero;

  return (
    <div className={'pc pc-' + estilo} style={{ ['--marca' as string]: marca, ['--marca-ink' as string]: textoSobre(marca), ['--marca2' as string]: e.cor2 || marca }}>
      <RegistarVisita token={token} />
      <header className="pc-topo">
        <div className="pc-in pc-topo-in">
          <div className="pc-marca">
            {logoUrl ? <img src={logoUrl} alt={e.nome} /> : <strong>{e.nome}</strong>}
            {e.slogan ? <span>{e.slogan}</span> : null}
          </div>
          <nav className="pc-contactos" aria-label="Contactos">
            {e.telefone ? <a href={`tel:${e.telefone.replace(/\s/g, '')}`}>Ligar</a> : null}
            {e.telefone ? <a href={`https://wa.me/${telWa(e.telefone)}?text=${encodeURIComponent(`Olá, sobre a proposta n.º ${numero}: `)}`} target="_blank" rel="noopener">WhatsApp</a> : null}
            {e.email ? <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Proposta n.º ${numero}`)}`}>Email</a> : null}
          </nav>
        </div>
      </header>

      <main>
        <section className="pc-hero">
          <div className="pc-in">
            <p className="pc-eyebrow">Proposta de orçamento{numero ? ` n.º ${numero}` : ''}</p>
            <h1>{titulo}</h1>
            <p className="pc-sub">{[snap.pedido.localidade, snap.pedido.dono ? `para ${snap.pedido.dono}` : ''].filter(Boolean).join(' · ')}</p>
            <div className="pc-valor">
              <div><span className="pc-lab">Valor global</span><strong>{fmtEUR(T.semIva)}</strong><span className="pc-iva">+ IVA · {fmtEUR(T.total)} com IVA</span></div>
              <div className="pc-datas">
                <span>Emitida a {fmtData(val.emitida)}</span>
                <span>{aceite ? <b className="pc-estado ok">Aceite</b> : val.expirada ? <b className="pc-estado exp">Expirada</b> : <>Válida até {fmtData(val.ate)}</>}</span>
              </div>
            </div>
            <div className="pc-acoes">
              {!aceite && !val.expirada ? <a className="pc-btn" href="#aceitar">Aceitar proposta</a> : null}
              {pdfUrl ? <a className="pc-btn pc-btn-2" href={pdfUrl}>Descarregar PDF</a> : null}
            </div>
          </div>
        </section>

        {recemAceite || aceite ? (
          <section className="pc-in"><div className="pc-aceite" role="status">
            <strong>{recemAceite ? 'Obrigado! A proposta foi aceite.' : 'Proposta aceite'}</strong>
            {aceite ? <span>Aceite por {aceite.nome} a {fmtDataHora(new Date(aceite.em))}. {recemAceite ? `${e.nome || 'A empresa'} já foi avisada e vai entrar em contacto para combinar os próximos passos.` : ''}</span> : null}
          </div></section>
        ) : null}

        {completa && o.apresentacao.trim() ? (
          <section className="pc-sec pc-in pc-carta"><h2>Apresentação</h2><Paragrafos t={o.apresentacao} /></section>
        ) : null}

        {completa && (o.encontramos.trim() || fotosEnc.length) ? (
          <section className="pc-sec pc-in">
            <h2>O que encontrámos</h2>
            {o.encontramos.trim() ? <Paragrafos t={o.encontramos} /> : null}
            {fotosEnc.length ? <div className="pc-fotos">{fotosEnc.map((n) => <img key={n} src={fotoUrls[n]} alt={`Fotografia ${n} da obra`} loading="lazy" />)}</div> : null}
          </section>
        ) : null}

        <section className="pc-sec pc-in">
          <h2>Trabalhos incluídos</h2>
          <div className="pc-caps">
            {o.capitulos.map((c, ci) => (
              <article key={c.id || ci} className="pc-cap">
                <header>
                  <span className="pc-n">{String(ci + 1).padStart(2, '0')}</span>
                  <h3>{c.nome}</h3>
                  <strong className="pc-cap-v">{fmtEUR(completa ? valorCapitulo(c, o, e) : subtotal(c))}</strong>
                </header>
                {c.descricao ? <p className="pc-desc">{c.descricao}</p> : null}
                {completa && (variasFases || c.prazo) ? <p className="pc-meta">{[variasFases ? `Fase ${c.fase || 1}` : '', c.prazo ? `prazo indicativo: ${c.prazo}` : ''].filter(Boolean).join(' · ')}</p> : null}
                {completa && c.estado.length ? <><p className="pc-lab">Estado atual</p><ul>{c.estado.map((x) => <li key={x}><Rico t={x} /></li>)}</ul></> : null}
                <details className="pc-linhas" open={!completa}>
                  <summary>{c.linhas.length} {c.linhas.length === 1 ? 'trabalho' : 'trabalhos'}</summary>
                  <table>
                    <tbody>
                      {c.linhas.map((l) => (
                        <tr key={l.id}>
                          <td>{l.descricao}</td>
                          <td className="num">{fmtQ(l.quantidade)} {l.unidade}</td>
                          {detalhado ? <td className="num">{fmtEUR(totalLinha(l))}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                {completa && semIva(c.nao_incluido).length ? <p className="pc-nao"><b>Não incluído:</b> {semIva(c.nao_incluido).join('; ')}.</p> : null}
              </article>
            ))}
          </div>
          <div className="pc-totais">
            {T.imp ? <p><span>Imprevistos ({fmtQ(T.pct)}%)</span><span>{fmtEUR(T.imp)}</span></p> : null}
            <p><span>Total sem IVA</span><span>{fmtEUR(T.semIva)}</span></p>
            {T.ivas.map((x) => <p key={x.taxa}><span>IVA {fmtQ(x.taxa)}%</span><span>{fmtEUR(x.valor)}</span></p>)}
            <p className="pc-total"><span>Total com IVA</span><span>{fmtEUR(T.total)}</span></p>
          </div>
        </section>

        {variasFases ? (
          <section className="pc-sec pc-in">
            <h2>Execução em {fases.length} fases</h2>
            <ol className="pc-fases">{fases.map((f) => <li key={f.n}><b>Fase {f.n}{f.titulo ? ` · ${f.titulo}` : ''}</b>{f.descricao ? <span>{f.descricao}</span> : null}<span className="pc-meta">Capítulo{f.capitulos.length > 1 ? 's' : ''} {f.capitulos.join(', ')} · {fmtEUR(f.valor)} + IVA</span></li>)}</ol>
          </section>
        ) : null}

        <section className="pc-sec pc-in">
          <h2>Condições</h2>
          <dl className="pc-cond">
            {pagamentos.length ? <><dt>Pagamentos</dt><dd><ul>{pagamentos.map((p) => <li key={p.momento}>{p.momento}: {fmtEUR(p.valor)} + IVA</li>)}</ul>{e.pagamento && !/^[\d\s,.;%/+e-]*$/i.test(e.pagamento) ? <p>{e.pagamento}</p> : null}</dd></> : null}
            {snap.meta.prazo || e.prazo ? <><dt>Prazo</dt><dd>{snap.meta.prazo || e.prazo}</dd></> : null}
            <dt>Validade</dt><dd>{val.dias} dias, até {fmtData(val.ate)}.</dd>
            {e.garantia || e.garantia_texto ? <><dt>Garantia</dt><dd>{[e.garantia, e.garantia_texto].filter(Boolean).join('. ')}</dd></> : null}
            {e.seguro ? <><dt>Seguro</dt><dd>{[e.seguro, e.seguro_apolice ? `apólice n.º ${e.seguro_apolice}` : '', e.seguro_validade ? `válida até ${e.seguro_validade}` : ''].filter(Boolean).join(', ')}</dd></> : null}
            {naoIncl.length ? <><dt>Não incluído</dt><dd><ul>{naoIncl.map((x) => <li key={x}>{x}</li>)}</ul></dd></> : null}
            {semIva(o.pressupostos).length ? <><dt>Pressupostos</dt><dd><ul>{semIva(o.pressupostos).map((x) => <li key={x}>{x}</li>)}</ul></dd></> : null}
            {o.a_confirmar.length ? <><dt>A confirmar</dt><dd><ul>{o.a_confirmar.map((x) => <li key={x}>{x}</li>)}</ul></dd></> : null}
            {e.condicoes_texto ? <><dt>Condições gerais</dt><dd><ul>{e.condicoes_texto.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul></dd></> : null}
            {completa && e.iban ? <><dt>Pagamento por transferência</dt><dd>{[e.banco, `IBAN ${e.iban}`, e.bic ? `BIC ${e.bic}` : ''].filter(Boolean).join(' · ')}</dd></> : null}
          </dl>
        </section>

        {e.apresentacao.trim() ? (
          <section className="pc-sec pc-in pc-sobre"><h2>Sobre {e.nome ? `a ${e.nome}` : 'nós'}</h2><Paragrafos t={e.apresentacao} /></section>
        ) : null}

        <section id="aceitar" className="pc-sec pc-in">
          <h2>Aceitar a proposta</h2>
          {aceite ? (
            <p>Esta proposta já foi aceite por {aceite.nome} a {fmtDataHora(new Date(aceite.em))}.</p>
          ) : val.expirada ? (
            <p>Esta proposta expirou a {fmtData(val.ate)}. Fale com {e.nome || 'a empresa'} para receber uma proposta atualizada.</p>
          ) : (
            <form className="pc-form" action={`/p/${token}/aceitar`} method="post">
              {erro ? <p className="pc-erro" role="alert">{erro}</p> : null}
              <label><span>O seu nome completo</span><input name="nome" required minLength={3} maxLength={120} autoComplete="name" defaultValue={snap.pedido.dono} /></label>
              <label><span>Nota para a empresa (opcional)</span><textarea name="nota" rows={2} maxLength={1000} placeholder="Ex.: podemos começar a partir de 15 de janeiro." /></label>
              <label className="pc-check"><input type="checkbox" name="confirmo" value="1" required /><span>Li e aceito a proposta{numero ? ` n.º ${numero}` : ''}, pelo valor global de {fmtEUR(T.semIva)} + IVA, nas condições descritas.</span></label>
              <button className="pc-btn" type="submit">Aceitar proposta</button>
              <p className="pc-nota">{e.nome || 'A empresa'} recebe o seu nome e a data da aceitação, e entra em contacto para combinar os próximos passos.</p>
            </form>
          )}
        </section>
      </main>

      <footer className="pc-pe">
        <div className="pc-in">
          <p><strong>{e.nome}</strong>{[e.nif ? `NIF ${e.nif}` : '', e.alvara ? `Alvará ${e.alvara}` : '', e.morada, e.telefone, e.email].filter(Boolean).map((x) => <span key={x}> · {x}</span>)}</p>
          <p className="pc-prumo">Proposta preparada com <a href="/" target="_blank" rel="noopener">{PRODUTO}</a></p>
        </div>
      </footer>
    </div>
  );
}
