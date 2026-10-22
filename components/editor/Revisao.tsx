'use client';
// Passo 5: revisão das linhas, preços por confirmar, totais e aprovação.
import { useEffect, useRef, useState } from 'react';
import type { Capitulo, Empresa, Estado, Linha } from '@/lib/orc';
import { confianca, descObra, ivaPadrao, linhas, pendentes, subtotal, totais, totalLinha } from '@/lib/orc';
import { fmtC, fmtEUR, fmtInput, fmtN, fmtPreco, fmtQ, maiuscula, num, pad, r2, uid, un } from '@/lib/util';
import { AreaTexto, CampoNum, ICON } from './pecas';

type Upd = (fn: (d: Estado) => void) => void;
type Props = {
  S: Estado; upd: Upd; empresa: Empresa; ocupado: boolean; custoIa: number | null;
  onAjuste: (instr: string) => Promise<boolean>; onAprovar: () => void; onVoltar: () => void; toast: (msg: string, desfazer?: () => void) => void;
};

const acharLinha = (d: Estado, id: string) => {
  for (const c of d.orc?.capitulos || []) { const i = c.linhas.findIndex((l) => l.id === id); if (i >= 0) return { c, l: c.linhas[i], i }; }
  return null;
};

export default function Revisao({ S, upd, empresa, ocupado, custoIa, onAjuste, onAprovar, onVoltar, toast }: Props) {
  const completa = S.modelo === 'completo';
  const [outro, setOutro] = useState<string | null>(null);
  const [outroTxt, setOutroTxt] = useState('');
  const [ajuste, setAjuste] = useState('');
  const o = S.orc!;
  const ls = linhas(o), p = pendentes(o), t = totais(o, empresa);
  const conf = ls.length - p.length;
  const podeAprovar = ls.length > 0 && p.length === 0 && S.revisto;
  const numLinha = (id: string) => { const r = acharLinha(S, id); return r ? `${o.capitulos.indexOf(r.c) + 1}.${r.i + 1}` : ''; };
  const mudarLinha = (id: string, fn: (l: Linha) => void) => upd((d) => { const r = acharLinha(d, id); if (r) fn(r.l); });
  const mudarCap = (id: string, fn: (c: Capitulo) => void) => upd((d) => { const c = d.orc!.capitulos.find((x) => x.id === id); if (c) fn(c); });

  function fixar(id: string) { mudarLinha(id, (l) => { l.fixado = true; }); if (outro === id) setOutro(null); }
  function usarPreco(id: string) {
    const v = r2(num(outroTxt));
    if (!(v > 0)) { toast('Escreva um preço maior que zero.'); return; }
    mudarLinha(id, (l) => { l.preco = v; l.fixado = true; });
    setOutro(null);
  }
  function removerLinha(id: string) {
    const r = acharLinha(S, id); if (!r) return;
    const capIdx = o.capitulos.indexOf(r.c), linha = r.l, pos = r.i, cap = r.c;
    upd((d) => {
      const x = acharLinha(d, id); if (!x) return;
      x.c.linhas.splice(x.i, 1);
      if (!x.c.linhas.length) d.orc!.capitulos = d.orc!.capitulos.filter((c) => c !== x.c);
    });
    toast('Linha removida.', () => upd((d) => {
      const c = d.orc!.capitulos.find((k) => k.id === cap.id);
      if (c) c.linhas.splice(pos, 0, linha);
      else d.orc!.capitulos.splice(capIdx, 0, { ...cap, linhas: [linha] });
    }));
  }
  function addLinha(capId: string) {
    upd((d) => {
      const c = d.orc!.capitulos.find((x) => x.id === capId); if (!c) return;
      c.linhas.push({ id: uid('L'), descricao: '', unidade: 'un', quantidade: 1, calculo: '', qtd_origem: 'medida', preco: 0, fonte: 'estimativa', ref: '', faixa_min: null, faixa_max: null, confirmar: false, nota: 'Linha acrescentada pelo profissional.', iva: ivaPadrao(empresa), fixado: true });
    });
  }

  /* ---------- totais ---------- */
  const rows: [string, string, string?][] = [];
  if (t.imp) { rows.push(['Trabalhos', fmtEUR(t.base)]); rows.push([`Imprevistos ${fmtN(t.pct, 0)}%`, fmtEUR(t.imp)]); }
  rows.push(['Sem IVA', fmtEUR(t.semIva), 'strong']);
  t.ivas.forEach((x) => rows.push([t.ivas.length > 1 ? `IVA ${fmtN(x.taxa, 0)}% sobre ${fmtEUR(x.base)}` : `IVA ${fmtN(x.taxa, 0)}%`, fmtEUR(x.valor)]));
  const totalBox = (
    <section className="card total" id="sumbar" aria-label="Totais">
      <div className="tot-main"><span className="lab">Total com IVA</span><span className="tot-big num">{fmtEUR(t.total)}</span></div>
      <dl className="tot-rows">{rows.map(([k, v, c]) => <div key={k} className={c || ''}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
      <div className="conf">
        <div className="conf-h"><span className="lab">Preços confirmados</span><span className="pend">{conf} de {ls.length}</span></div>
        {ls.length <= 24
          ? <div className="seg" aria-hidden="true">{ls.map((l, i) => <span key={i} className={i < conf ? 'on' : ''} />)}</div>
          : <div className="seg cont" aria-hidden="true"><i style={{ width: `${ls.length ? Math.round((conf / ls.length) * 100) : 0}%` }} /></div>}
      </div>
    </section>
  );

  /* ---------- pendentes ---------- */
  const pendBox = !p.length ? (
    <div className="grp-h ok"><span className="n">{ls.length}</span><h2>Preços confirmados</h2><span className="aside">Todas as linhas têm preço da sua tabela ou confirmado por si.</span></div>
  ) : (
    <>
      <div className="grp-h"><span className="n">{p.length}</span><h2>Por confirmar</h2><span className="aside">Estimativas da IA. Confirme o valor proposto ou indique outro.</span></div>
      <div className="pend-list">
        {p.map((l) => {
          const temFaixa = l.faixa_min !== null && l.faixa_max !== null && l.faixa_max > l.faixa_min;
          const pos = temFaixa ? Math.max(0, Math.min(100, ((l.preco - l.faixa_min!) / (l.faixa_max! - l.faixa_min!)) * 100)) : 0;
          return (
            <article className="pc" key={l.id}>
              <div className="pc-desc"><span className="pc-n">{numLinha(l.id)}</span><div className="pc-t"><span className="d">{l.descricao || 'Linha sem descrição'}</span><div className="qp"><span className="c">{fmtQ(l.quantidade)} {un(l.unidade)} × {fmtEUR(l.preco)}</span><strong className="num">{fmtEUR(totalLinha(l))}</strong></div></div></div>
              {temFaixa ? (
                <div className="range"><div className="bar" aria-hidden="true"><span className="dot" style={{ left: `${pos.toFixed(1)}%` }} /></div><div className="ends"><span>{fmtC(l.faixa_min!)}</span><span>{un(l.unidade) === 'vg' ? 'faixa estimada' : 'faixa por ' + un(l.unidade)}</span><span>{fmtC(l.faixa_max!)}</span></div></div>
              ) : <div className="range"><div className="ends"><span>Sem faixa de referência</span></div></div>}
              <div className="pc-act">
                <button className="btn outline" onClick={() => fixar(l.id)}>Confirmar {fmtC(l.preco)}</button>
                <button className="link" aria-expanded={outro === l.id} onClick={() => { if (outro === l.id) setOutro(null); else { setOutro(l.id); setOutroTxt(fmtPreco(l.preco)); } }}>Outro preço</button>
              </div>
              {outro === l.id ? (
                <div className="pc-outro">
                  <label className="ul"><span className="sr-only">Outro preço unitário, sem IVA, para {l.descricao}</span>
                    <input autoFocus inputMode="decimal" value={outroTxt} onChange={(e) => setOutroTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usarPreco(l.id); } else if (e.key === 'Escape') setOutro(null); }} />
                    <span className="u">€ / {un(l.unidade)}</span></label>
                  <button className="btn ink sm" onClick={() => usarPreco(l.id)}>Usar este preço</button>
                  <button className="link muted" onClick={() => setOutro(null)}>Cancelar</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );

  /* ---------- capítulos ---------- */
  const linhaEl = (c: Capitulo, l: Linha, ci: number, i: number) => {
    const pend = confianca(l) === 'baixa';
    const fonte = l.fixado ? ['conf', 'Preço confirmado'] : l.fonte === 'propria' ? ['ok', 'Tabela própria'] : ['pend', 'Por confirmar'];
    const n = `${ci + 1}.${i + 1}`;
    return (
      <article className={'ln' + (pend ? ' pend' : '')} key={l.id}>
        <div className="ln-top">
          <span className="ln-n">{n}</span>
          <AreaTexto className="ln-desc" rows={1} value={l.descricao} aria-label={`Descrição da linha ${n}`} onChange={(e) => mudarLinha(l.id, (x) => { x.descricao = e.target.value; })} />
          <button type="button" className="icon-btn ghost ln-rm" aria-label={`Remover a linha ${n}`} title="Remover linha" onClick={() => removerLinha(l.id)}>{ICON.fechar}</button>
        </div>
        <div className="ln-nums">
          <CampoNum className="nin q" valor={l.quantidade} formata={fmtInput} label={`Quantidade da linha ${n}`} onValor={(v) => mudarLinha(l.id, (x) => { x.quantidade = v; })} />
          <input className="nin u" value={un(l.unidade)} aria-label={`Unidade da linha ${n}`} onChange={(e) => mudarLinha(l.id, (x) => { x.unidade = e.target.value; })} />
          <span className="x" aria-hidden="true">×</span>
          <CampoNum className="nin p" valor={l.preco} formata={fmtPreco} label={`Preço unitário da linha ${n}, em euros sem IVA`} onValor={(v) => mudarLinha(l.id, (x) => { x.preco = v; if (x.fonte === 'estimativa') x.fixado = true; })} />
          <span className="x" aria-hidden="true">€</span>
          <strong className="ln-tot num">{fmtEUR(totalLinha(l))}</strong>
        </div>
        <div className="ln-meta">
          <span className="ln-src"><span className={'src ' + fonte[0]}><i aria-hidden="true" />{fonte[1]}</span>{l.qtd_origem === 'medida' ? null : <span>Qtd. estimada</span>}</span>
          <label className="mini"><input type="checkbox" checked={l.confirmar} onChange={(e) => mudarLinha(l.id, (x) => { x.confirmar = e.target.checked; })} /> Confirmar na visita</label>
          <label className="mini">IVA <select value={l.iva} onChange={(e) => mudarLinha(l.id, (x) => { x.iva = num(e.target.value); })}>{[23, 13, 6].map((x) => <option key={x} value={x}>{x}%</option>)}</select></label>
        </div>
        {l.calculo ? <p className="ln-calc">{l.calculo}</p> : null}
        {l.nota ? <p className="ln-calc">{l.nota}</p> : null}
      </article>
    );
  };

  const lista = (titulo: string, k: 'nao_incluido' | 'pressupostos' | 'a_confirmar', ph: string) => (
    <label className="f"><span className="lab">{titulo} <em>· uma por linha</em></span>
      <ListaTexto valor={o[k]} placeholder={ph} rows={Math.max(2, Math.min(6, o[k].length + 1))} onValor={(v) => upd((d) => { d.orc![k] = v; })} />
    </label>
  );

  let info: React.ReactNode;
  if (!ls.length) info = <span className="r">O orçamento está vazio.</span>;
  else if (p.length) info = <><span className="r">{p.length === 1 ? 'Falta 1 preço' : `Faltam ${p.length} preços`}</span><span className="s">Confirme-os para gerar o PDF</span></>;
  else info = <><label className="check"><input type="checkbox" checked={S.revisto} onChange={(e) => upd((d) => { d.revisto = e.target.checked; })} /> Revi quantidades e preços</label><span className="s">{S.revisto ? 'Tudo revisto. Pode gerar o PDF.' : 'Marque que reviu para gerar o PDF.'}</span></>;

  const meta = [S.meta.numero ? 'Proposta ' + S.meta.numero : '', S.pedido.localidade, S.pedido.dono].filter(Boolean).join(' · ');
  const nl = ls.length;

  return (
    <>
      <section className="intro intro-row">
        <div className="intro-t"><span className="eyebrow">Passo 5 de 6 · Revisão</span><h1>{maiuscula(descObra(S.pedido.tipo))}</h1>{meta ? <span className="meta-line">{meta}</span> : null}</div>
        <button className="btn sm" onClick={onVoltar}>{ICON.voltar} Voltar às medidas</button>
      </section>
      <div className="rev">
        <div className="rev-main">
          <section className="rev-pend" aria-label="Preços por confirmar">{pendBox}</section>
          {completa ? (
            <section className="sheet rev-textos" aria-label="Textos da proposta">
              <div className="sh-h"><h2>Apresentação ao cliente</h2><span className="lab">Escrita pela IA · reveja</span></div>
              <label className="f"><span className="lab">Carta <em>· **negrito** entre asteriscos</em></span><AreaTexto rows={8} value={o.apresentacao} placeholder="Exmo. Senhor …" onChange={(e) => upd((d) => { d.orc!.apresentacao = e.target.value; })} /></label>
              <label className="f"><span className="lab">O que encontrámos</span><AreaTexto rows={3} value={o.encontramos} onChange={(e) => upd((d) => { d.orc!.encontramos = e.target.value; })} /></label>
              <div className="f"><span className="lab">Fases da obra</span>
                {o.fases.map((f, i) => (
                  <div className="fase-ed" key={i}>
                    <span className="mono small muted">Fase {i + 1}</span>
                    <input value={f.titulo} placeholder="Ex.: Fechar as entradas de água" aria-label={`Título da fase ${i + 1}`} onChange={(e) => upd((d) => { d.orc!.fases[i].titulo = e.target.value; })} />
                    <input value={f.descricao} placeholder="Uma frase sobre o que inclui" aria-label={`Descrição da fase ${i + 1}`} onChange={(e) => upd((d) => { d.orc!.fases[i].descricao = e.target.value; })} />
                    {o.fases.length > 1 ? <button className="link danger" onClick={() => upd((d) => { d.orc!.fases.splice(i, 1); d.orc!.capitulos.forEach((c) => { if (c.fase > i + 1) c.fase -= 1; else if (c.fase === i + 1) c.fase = Math.max(1, i); }); })}>Remover</button> : null}
                  </div>
                ))}
                <div><button className="btn dashed sm" onClick={() => upd((d) => { d.orc!.fases.push({ titulo: '', descricao: '' }); })}>{ICON.mais} Adicionar fase</button></div>
              </div>
            </section>
          ) : null}
          <section className="rev-caps" aria-labelledby="mapa-t">
            <div className="grp-h plain"><h2 id="mapa-t">Mapa de quantidades</h2><span className="aside mono">{o.capitulos.length} {o.capitulos.length === 1 ? 'capítulo' : 'capítulos'} · {nl} {nl === 1 ? 'linha' : 'linhas'}</span></div>
            {o.capitulos.map((c, ci) => (
              <section className="cap" key={c.id}>
                <header className="cap-h"><span className="cap-n">{pad(ci + 1)}</span>
                  <AreaTexto className="cap-nome" rows={1} value={c.nome} aria-label={`Nome do capítulo ${ci + 1}`} onChange={(e) => upd((d) => { const x = d.orc!.capitulos.find((k) => k.id === c.id); if (x) x.nome = e.target.value; })} />
                  <span className="cap-sub num">{fmtEUR(subtotal(c))}</span></header>
                {completa ? (
                  <details className="card cap-texto">
                    <summary>Texto e fase do capítulo</summary>
                    <label className="f"><span className="lab">Onde <em>· opcional</em></span><input value={c.subtitulo} placeholder="Ex.: Escritório, piso 1 e piso 2" onChange={(e) => mudarCap(c.id, (x) => { x.subtitulo = e.target.value; })} /></label>
                    <label className="f"><span className="lab">Porque é preciso e como se faz</span><AreaTexto rows={3} value={c.descricao} onChange={(e) => mudarCap(c.id, (x) => { x.descricao = e.target.value; })} /></label>
                    <label className="f"><span className="lab">Estado atual <em>· um por linha</em></span><ListaTexto valor={c.estado} rows={Math.max(2, Math.min(6, c.estado.length + 1))} placeholder="Ex.: telhas com musgo e algumas partidas" onValor={(v) => mudarCap(c.id, (x) => { x.estado = v; })} /></label>
                    <label className="f"><span className="lab">Não incluído neste capítulo <em>· um por linha</em></span><ListaTexto valor={c.nao_incluido} rows={Math.max(2, Math.min(5, c.nao_incluido.length + 1))} placeholder="Ex.: substituição integral do telhado" onValor={(v) => mudarCap(c.id, (x) => { x.nao_incluido = v; })} /></label>
                    <div className="f-grid">
                      <label className="f"><span className="lab">Fase</span><select value={c.fase || 1} onChange={(e) => mudarCap(c.id, (x) => { x.fase = num(e.target.value) || 1; })}>{Array.from({ length: Math.max(1, o.fases.length) }, (_, i) => <option key={i} value={i + 1}>Fase {i + 1}{o.fases[i]?.titulo ? ` · ${o.fases[i].titulo}` : ''}</option>)}</select></label>
                      <label className="f"><span className="lab">Prazo indicativo</span><input value={c.prazo} placeholder="Ex.: 2 semanas" onChange={(e) => mudarCap(c.id, (x) => { x.prazo = e.target.value; })} /></label>
                    </div>
                  </details>
                ) : null}
                {c.linhas.map((l, i) => linhaEl(c, l, ci, i))}
                <div className="cap-f"><button className="btn dashed sm" onClick={() => addLinha(c.id)}>{ICON.mais} Acrescentar linha</button></div>
              </section>
            ))}
          </section>
          <section className="sheet rev-listas" aria-label="Condições da proposta">
            {lista('Não incluído', 'nao_incluido', 'Ex.: licenças e taxas camarárias')}
            {lista('Pressupostos', 'pressupostos', 'Ex.: água e eletricidade disponíveis na obra')}
            {lista('A confirmar na visita', 'a_confirmar', 'Ex.: estado da canalização embutida')}
          </section>
        </div>
        <div className="rev-side">
          {totalBox}
          <section className="sheet rev-meta" aria-label="Dados da proposta">
            <div className="f"><span className="lab" id="lab-mod">Modelo do PDF</span>
              <div className="chips" role="radiogroup" aria-labelledby="lab-mod">{([['completo', 'Completa'], ['rapido', 'Rápida']] as const).map(([v, t]) => <button key={v} type="button" className="chip" role="radio" aria-checked={S.modelo === v} onClick={() => upd((d) => { d.modelo = v; })}>{t}</button>)}</div>
              {completa && !o.apresentacao ? <span className="small muted">Este orçamento foi montado no modelo rápido: para ter a carta e os textos dos capítulos, peça um ajuste à IA ou volte a montar o orçamento.</span> : null}
            </div>
            {completa ? (
              <div className="f"><span className="lab" id="lab-pr">Preços no PDF</span>
                <div className="chips" role="radiogroup" aria-labelledby="lab-pr">{([['capitulo', 'Valor por capítulo'], ['detalhado', 'Detalhados']] as const).map(([v, t]) => <button key={v} type="button" className="chip" role="radio" aria-checked={S.mostrar_precos === v} onClick={() => upd((d) => { d.mostrar_precos = v; })}>{t}</button>)}</div>
              </div>
            ) : null}
            {completa ? <label className="f"><span className="lab">Título da obra</span><input value={o.titulo} placeholder={maiuscula(descObra(S.pedido.tipo))} onChange={(e) => upd((d) => { d.orc!.titulo = e.target.value; })} /></label> : null}
            <label className="f"><span className="lab">Proposta n.º</span><input className="mono" value={S.meta.numero} onChange={(e) => upd((d) => { d.meta.numero = e.target.value; })} /></label>
            <div className="f-grid">
              <label className="f"><span className="lab">Validade</span><span className="inl"><input inputMode="numeric" value={S.meta.validade} onChange={(e) => upd((d) => { d.meta.validade = Math.round(num(e.target.value)) || ''; })} /><span className="u">dias</span></span></label>
              <label className="f"><span className="lab">Prazo indicativo</span><input value={S.meta.prazo} onChange={(e) => upd((d) => { d.meta.prazo = e.target.value; })} /></label>
            </div>
          </section>
          <section className="card rev-ajuste">
            <label htmlFor="f-ajuste">Pedir ajuste à IA</label>
            <textarea id="f-ajuste" rows={3} value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="Ex.: tira a pintura do teto; acrescenta a substituição da porta." />
            <button className="btn ink sm" disabled={ocupado} onClick={async () => {
              if (!ajuste.trim()) { toast('Escreva primeiro o ajuste que quer.'); return; }
              if (await onAjuste(ajuste.trim())) setAjuste('');
            }}>Pedir ajuste</button>
          </section>
          {custoIa !== null ? <p className="small muted rev-custo">Custo de IA deste orçamento: {custoIa.toFixed(2).replace('.', ',')} US$</p> : null}
          <div className="aprovar"><div className="apr-info">{info}</div><button className="btn primary lg" disabled={!podeAprovar} onClick={onAprovar}>Aprovar e gerar PDF</button></div>
        </div>
      </div>
    </>
  );
}

// Lista editável "uma por linha": guarda o texto tal como está e só limpa linhas vazias ao sair do campo.
function ListaTexto({ valor, onValor, placeholder, rows }: { valor: string[]; onValor: (v: string[]) => void; placeholder: string; rows: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [txt, setTxt] = useState(valor.join('\n'));
  const junto = valor.join('\n');
  // atualizado de fora (ex.: ajuste pela IA) enquanto o campo não está em uso
  useEffect(() => { if (document.activeElement !== ref.current) setTxt(junto); }, [junto]);
  const limpar = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  return <textarea ref={ref} rows={rows} placeholder={placeholder} value={txt} onChange={(e) => { setTxt(e.target.value); onValor(limpar(e.target.value)); }} />;
}
