'use client';
// Configuração da empresa: dados, marca no PDF, condições e preçário. Herdada do protótipo.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { lerPreco } from '@/lib/empresa';
import { dadosExemplo } from '@/lib/exemplo';
import { bytesDe, prepararLogo, urlsAssinadas } from '@/lib/fotos';
import { PRODUTO } from '@/lib/marca';
import { LISTA_BASE, type Empresa } from '@/lib/orc';
import { carregarFontes, descarregar, gerarPDF, nomeFicheiro } from '@/lib/pdf';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtPreco, num, un } from '@/lib/util';
import { ICON } from './editor/pecas';

type LinhaP = { descricao: string; unidade: string; preco: string };
type Campo = Exclude<keyof Empresa, 'precos' | 'logo_path' | 'rodape' | 'iva' | 'validade' | 'imprevistos' | 'pag_adjudicacao' | 'pag_inicio' | 'pag_conclusao' | 'modelo' | 'mostrar_precos'>;
type CampoPct = 'iva' | 'validade' | 'imprevistos' | 'pag_adjudicacao' | 'pag_inicio' | 'pag_conclusao';

export default function ConfigForm({ inicial, userId, email }: { inicial: Empresa; userId: string; email: string }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [e, setE] = useState({
    ...inicial, iva: String(inicial.iva), validade: String(inicial.validade), imprevistos: String(inicial.imprevistos || ''),
    pag_adjudicacao: String(inicial.pag_adjudicacao), pag_inicio: String(inicial.pag_inicio), pag_conclusao: String(inicial.pag_conclusao)
  });
  const [precos, setPrecos] = useState<LinhaP[]>(inicial.precos.map((p) => ({ descricao: p.descricao, unidade: un(p.unidade), preco: p.preco === null ? '' : fmtPreco(p.preco) })));
  const [logoPath, setLogoPath] = useState(inicial.logo_path);
  const [logoUrl, setLogoUrl] = useState('');
  const [sujo, setSujo] = useState(false);
  const [estado, setEstado] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!logoPath) { setLogoUrl(''); return; }
    urlsAssinadas(sb, 'logos', [logoPath]).then((u) => setLogoUrl(u[logoPath] || ''));
  }, [logoPath, sb]);
  useEffect(() => {
    const avisar = (ev: BeforeUnloadEvent) => { if (sujo) ev.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);

  const set = (k: keyof typeof e, v: string | boolean) => { setE((x) => ({ ...x, [k]: v })); setSujo(true); };
  const cf = (k: Campo, lab: string, ph = '', mode?: 'numeric' | 'tel' | 'email', cls?: string) => (
    <label className="f"><span className="lab">{lab}</span><input className={cls} value={String(e[k] ?? '')} placeholder={ph} inputMode={mode} autoComplete="off" onChange={(ev) => set(k, ev.target.value)} /></label>
  );
  const cfU = (k: CampoPct, lab: string, u: string, ph: string, mode: 'decimal' | 'numeric') => (
    <label className="f"><span className="lab">{lab}</span><span className="inl"><input value={e[k]} placeholder={ph} inputMode={mode} autoComplete="off" onChange={(ev) => set(k, ev.target.value)} /><span className="u">{u}</span></span></label>
  );
  const ct = (k: Campo, lab: string, ph = '') => (
    <label className="f"><span className="lab">{lab}</span><textarea rows={2} value={String(e[k] ?? '')} placeholder={ph} onChange={(ev) => set(k, ev.target.value)} /></label>
  );

  function empresaFinal(): Empresa {
    const out = { ...inicial } as Empresa;
    for (const k of Object.keys(e) as (keyof typeof e)[]) {
      const v = e[k];
      (out as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() : v;
    }
    const iva = num(e.iva);
    out.iva = iva > 0 && iva <= 30 ? iva : 23;
    out.validade = Math.min(365, Math.max(1, Math.round(num(e.validade)) || 30));
    out.imprevistos = Math.min(50, Math.max(0, num(e.imprevistos)));
    out.pag_adjudicacao = Math.min(100, Math.max(0, num(e.pag_adjudicacao)));
    out.pag_inicio = Math.min(100, Math.max(0, num(e.pag_inicio)));
    out.pag_conclusao = Math.min(100, Math.max(0, num(e.pag_conclusao)));
    out.prefixo = e.prefixo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    out.cor = /^#[0-9a-f]{6}$/i.test(e.cor) ? e.cor : '#1F3F8F';
    out.logo_path = logoPath;
    out.precos = precos.filter((p) => p.descricao.trim()).map((p) => lerPreco(p));
    return out;
  }

  async function guardar() {
    setAGuardar(true); setEstado('');
    const f = empresaFinal();
    const { precos: lista, ...resto } = f;
    // .select() confirma que a linha foi gravada: com a sessão expirada o Supabase não dá erro, só não altera nada
    const { data, error } = await sb.from('empresas').update({ ...resto, precos: lista }).eq('user_id', userId).select('user_id');
    setAGuardar(false);
    if (error) {
      console.error('guardar empresa', error);
      // colunas novas em falta: a migração 0002 ainda não foi aplicada no Supabase
      setEstado(/column|schema cache/i.test(error.message)
        ? `Falta atualizar a base de dados (migração 0002 no Supabase). Nada foi guardado. (${error.message})`
        : /check constraint/i.test(error.message)
          ? `Há um valor fora dos limites (IVA, validade, imprevistos ou percentagens). Nada foi guardado. (${error.message})`
          : `Não foi possível guardar. (${error.message})`);
      return;
    }
    if (!data || !data.length) {
      setEstado('A sua sessão expirou: nada foi guardado. Abra a app noutro separador, entre de novo e volte a carregar em Guardar aqui.');
      return;
    }
    setSujo(false); setEstado('Configuração guardada.');
    setPrecos(lista.map((p) => ({ descricao: p.descricao, unidade: un(p.unidade), preco: p.preco === null ? '' : fmtPreco(p.preco) })));
    router.refresh();
  }

  async function carregarLogo(file: File) {
    try {
      const blob = await prepararLogo(file);
      const path = `${userId}/logo-${Date.now()}.png`;
      const { error } = await sb.storage.from('logos').upload(path, blob, { contentType: 'image/png' });
      if (error) throw error;
      const antigo = logoPath;
      setLogoPath(path); setSujo(true);
      // guarda já o caminho novo, para o ficheiro não ficar órfão
      await sb.from('empresas').update({ logo_path: path }).eq('user_id', userId);
      if (antigo) await sb.storage.from('logos').remove([antigo]);
    } catch (err) {
      setEstado(err instanceof Error && err.message === 'logo_grande' ? 'O logótipo é pesado demais. Use uma imagem mais simples.' : 'Não consegui carregar essa imagem. Use PNG ou JPEG.');
    }
  }
  async function removerLogo() {
    if (!logoPath) return;
    await sb.storage.from('logos').remove([logoPath]);
    await sb.from('empresas').update({ logo_path: null }).eq('user_id', userId);
    setLogoPath(null);
  }

  async function pdfExemplo() {
    setEstado('A gerar o PDF de exemplo…');
    try {
      const emp = empresaFinal();
      const logo = logoPath ? await bytesDe(sb, 'logos', logoPath) : null;
      const { bytes } = await gerarPDF({ ...dadosExemplo(emp, logo), fontes: await carregarFontes() });
      descarregar(bytes, nomeFicheiro(emp.nome, '', true));
      setEstado('PDF de exemplo descarregado.');
    } catch (err) { console.error(err); setEstado('Não foi possível gerar o PDF de exemplo.'); }
  }

  // RGPD: portabilidade (exportar) e apagamento (apagar a conta).
  async function exportar() {
    const [{ data: emp }, { data: orcs }] = await Promise.all([sb.from('empresas').select('*').single(), sb.from('orcamentos').select('*')]);
    const blob = new Blob([JSON.stringify({ exportado_em: new Date().toISOString(), conta: email, empresa: emp, orcamentos: orcs }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dados-${PRODUTO.replace(/\s+/g, '-')}.json`; a.click();
  }
  async function apagarConta() {
    const conf = window.prompt('Isto apaga a conta, a empresa, todos os orçamentos e todas as fotos, sem volta. Para confirmar, escreva APAGAR.');
    if (conf !== 'APAGAR') return;
    setEstado('A apagar…');
    const r = await fetch('/api/conta', { method: 'DELETE' });
    if (!r.ok) { setEstado('Não foi possível apagar a conta. Tente de novo ou contacte-nos.'); return; }
    window.location.href = '/entrar';
  }

  const cor = /^#[0-9a-f]{6}$/i.test(e.cor || '') ? e.cor : '#1F3F8F';
  const mudarP = (i: number, k: keyof LinhaP, v: string) => { setPrecos((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p))); setSujo(true); };

  return (
    <div className="cfg">
      <section className="intro"><span className="eyebrow">Só você vê esta área</span><h1>Empresa</h1><p className="lead">Estes dados entram em todas as propostas.</p></section>
      <section className="sheet" aria-labelledby="cfg-h-emp">
        <div className="sh-h"><h2 id="cfg-h-emp">Dados da empresa</h2></div>
        {cf('nome', 'Nome comercial')}
        {cf('slogan', 'Slogan', 'Opcional. Ex.: Fundado na família. Feito para durar.')}
        <div className="f-grid">{cf('nif', 'NIF', 'Por preencher', 'numeric', 'mono')}{cf('telefone', 'Telefone', 'Por preencher', 'tel', 'mono')}</div>
        {cf('morada', 'Morada', 'Rua, número, código postal e localidade')}
        <div className="f-grid">{cf('email', 'Email', 'Por preencher', 'email')}{cf('site', 'Site', 'Opcional')}</div>
        {cf('alvara', 'Alvará ou registo no IMPIC', 'Por preencher')}
        <div className="f-grid">{cf('assinante', 'Quem assina as propostas', 'Nome e apelido')}{cf('prefixo', 'Prefixo das propostas', 'Ex.: MMGS', undefined, 'mono')}</div>
        <p className="sh-f small muted">As propostas são numeradas em sequência: {(e.prefixo || 'PREFIXO').toUpperCase()}-{new Date().getFullYear()}-001, -002…</p>
      </section>
      <section className="cfg-brand" aria-label="Marca no PDF">
        <div className="logo-tile">
          {logoUrl ? (
            <><div className="card logo-box"><img src={logoUrl} alt="Logótipo" /></div><div className="row"><label className="link">Trocar<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) carregarLogo(f); ev.target.value = ''; }} /></label><button className="link danger" onClick={removerLogo}>Remover</button></div></>
          ) : (
            <label className="btn dashed">{ICON.carregar} Carregar logótipo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) carregarLogo(f); ev.target.value = ''; }} /></label>
          )}
        </div>
        <label className="card cor-tile"><span className="lab">Cor da marca no PDF</span><span className="cor-row"><input type="color" value={cor} onChange={(ev) => set('cor', ev.target.value)} /><span className="mono small">{cor.toUpperCase()}</span></span></label>
      </section>
      <section className="sheet" aria-labelledby="cfg-h-gar">
        <div className="sh-h"><h2 id="cfg-h-gar">Garantia e seguro</h2></div>
        <div className="f-grid">{cf('garantia', 'Garantia', 'Ex.: 3 anos')}{cf('seguro', 'Seguradora (responsabilidade civil)', 'Ex.: Allianz Portugal')}</div>
        <div className="f-grid">{cf('seguro_apolice', 'N.º da apólice', '', undefined, 'mono')}{cf('seguro_validade', 'Apólice válida até', 'Ex.: 20/10/2027')}</div>
        {ct('garantia_texto', 'O que a garantia cobre', 'Ex.: Garantimos durante 3 anos todos os trabalhos executados nas zonas intervencionadas: qualquer defeito de execução é corrigido sem custos.')}
      </section>
      <section className="sheet" aria-labelledby="cfg-h-pag">
        <div className="sh-h"><h2 id="cfg-h-pag">Pagamentos</h2></div>
        <div className="f-grid c3">{cfU('pag_adjudicacao', 'Na adjudicação', '%', '20', 'decimal')}{cfU('pag_inicio', 'No início (de cada fase)', '%', '40', 'decimal')}{cfU('pag_conclusao', 'Na conclusão (de cada fase)', '%', '40', 'decimal')}</div>
        {Math.abs(num(e.pag_adjudicacao) + num(e.pag_inicio) + num(e.pag_conclusao) - 100) > 0.01 ? <p className="sh-f small erro">As três percentagens devem somar 100% (agora somam {num(e.pag_adjudicacao) + num(e.pag_inicio) + num(e.pag_conclusao)}%). Ao gerar a proposta são ajustadas na proporção.</p> : null}
        {ct('pagamento', 'Notas sobre pagamento', 'Ex.: Pagamentos por transferência bancária.')}
        <div className="f-grid c3">{cf('banco', 'Banco')}{cf('iban', 'IBAN', 'PT50 …', undefined, 'mono')}{cf('bic', 'BIC/SWIFT', '', undefined, 'mono')}</div>
      </section>
      <section className="sheet" aria-labelledby="cfg-h-mod">
        <div className="sh-h"><h2 id="cfg-h-mod">Modelo das propostas</h2></div>
        <div className="f"><span className="lab" id="lab-mod-cfg">Modelo por omissão</span>
          <div className="chips" role="radiogroup" aria-labelledby="lab-mod-cfg">{([['completo', 'Completa: carta, capítulos, fases e adjudicação'], ['rapido', 'Rápida: resumo e mapa de preços']] as const).map(([v, t]) => <button key={v} type="button" className="chip" role="radio" aria-checked={e.modelo === v} onClick={() => set('modelo', v)}>{t}</button>)}</div>
        </div>
        <div className="f"><span className="lab" id="lab-pr-cfg">Na proposta completa, mostrar os preços</span>
          <div className="chips" role="radiogroup" aria-labelledby="lab-pr-cfg">{([['capitulo', 'Só o valor de cada capítulo'], ['detalhado', 'Detalhados, linha a linha']] as const).map(([v, t]) => <button key={v} type="button" className="chip" role="radio" aria-checked={e.mostrar_precos === v} onClick={() => set('mostrar_precos', v)}>{t}</button>)}</div>
        </div>
      </section>
      <section className="sheet" aria-labelledby="cfg-h-cond">
        <div className="sh-h"><h2 id="cfg-h-cond">Condições da proposta</h2></div>
        <div className="f-grid c3">{cfU('iva', 'IVA', '%', '23', 'decimal')}{cfU('validade', 'Validade', 'dias', '30', 'numeric')}{cfU('imprevistos', 'Imprevistos', '%', '0', 'decimal')}</div>
        {ct('prazo', 'Prazo habitual', 'Ex.: início até 15 dias após a adjudicação')}
        {ct('nunca_inclui', 'Nunca incluído', 'Ex.: licenças, projeto, mobiliário, eletrodomésticos')}
        {ct('extras', 'Deslocação e entulho', 'Ex.: deslocação incluída; entulho a vazadouro incluído')}
        <div className="f"><label className="check"><input type="checkbox" checked={!!e.rodape} onChange={(ev) => set('rodape', ev.target.checked)} /> Mostrar “Preparado com {PRODUTO}” no rodapé do PDF</label></div>
      </section>
      <section className="sheet" id="precario" aria-labelledby="cfg-h-precos">
        <div className="sh-h"><h2 id="cfg-h-precos">Preçário</h2><span className="lab">€ sem IVA</span></div>
        <p className="sh-f small muted">A IA usa estes preços tal como estão. Linhas sem preço não contam: nesses trabalhos ela estima e pede confirmação na revisão.</p>
        <div className="ptable">
          {precos.length ? precos.map((p, i) => (
            <div className="prow" key={i}>
              <textarea rows={1} aria-label={`Descrição do trabalho ${i + 1}`} placeholder="Trabalho" value={p.descricao} onChange={(ev) => mudarP(i, 'descricao', ev.target.value)} />
              <input data-pf="unidade" aria-label={`Unidade do trabalho ${i + 1}`} placeholder="un" value={p.unidade} onChange={(ev) => mudarP(i, 'unidade', ev.target.value)} />
              <input className="pr" inputMode="decimal" aria-label={`Preço do trabalho ${i + 1}, em euros sem IVA`} placeholder="—" value={p.preco} onChange={(ev) => mudarP(i, 'preco', ev.target.value)} />
              <button type="button" className="icon-btn ghost" aria-label={`Remover o trabalho ${i + 1}`} onClick={() => { setPrecos((ps) => ps.filter((_, j) => j !== i)); setSujo(true); }}>{ICON.fechar}</button>
            </div>
          )) : <p className="sh-f small muted">Ainda sem linhas.</p>}
        </div>
        <div className="sh-f row">
          <button className="btn dashed sm" onClick={() => { setPrecos((ps) => [...ps, { descricao: '', unidade: 'un', preco: '' }]); setSujo(true); }}>{ICON.mais} Adicionar linha</button>
          {precos.length ? null : <button className="btn sm" onClick={() => { setPrecos(LISTA_BASE.map(([d, u]) => ({ descricao: d, unidade: un(u), preco: '' }))); setSujo(true); }}>Usar lista base de trabalhos (sem preços)</button>}
        </div>
      </section>
      <section className="card ms">
        <span className="lab">Testar o PDF</span>
        <p className="small muted">“PDF de exemplo” gera uma proposta com valores fictícios, marcada como exemplo, para ver a capa, o logótipo e as condições sem usar a IA.</p>
      </section>
      <section className="sheet perigo" aria-labelledby="cfg-h-dados">
        <div className="sh-h"><h2 id="cfg-h-dados">Os seus dados</h2></div>
        <div className="sh-f" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="small muted">Conta: {email}. Pode descarregar todos os seus dados ou apagar a conta a qualquer momento (RGPD).</p>
          <div className="row"><button className="btn sm" onClick={exportar}>Descarregar os meus dados</button><button className="btn sm danger" onClick={apagarConta}>Apagar conta</button></div>
        </div>
      </section>
      <div className="actions actions-col">
        {estado ? <p className={'small ' + (/guardada|descarregado/i.test(estado) ? 'ok-msg' : /A gerar/.test(estado) ? 'muted' : 'erro')} role="status">{estado}</p> : null}
        <div className="row"><button className="btn lg" onClick={pdfExemplo}>PDF de exemplo</button><button className="btn primary lg grow" disabled={aGuardar} onClick={guardar}>{aGuardar ? 'A guardar…' : sujo ? 'Guardar' : 'Guardado'}</button></div>
      </div>
    </div>
  );
}
