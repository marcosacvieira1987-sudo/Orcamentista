'use client';
// Peças pequenas do assistente de orçamento.
import { useEffect, useRef, useState } from 'react';
import type { Medida } from '@/lib/orc';
import { fmtN, num, r2 } from '@/lib/util';

export const ICON = {
  seta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  voltar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  mais: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  baixar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  partilhar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>,
  copiar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>,
  carregar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 19h14" /></svg>,
  fechar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
};

// Campo numérico em formato português (vírgula decimal) que não reformata enquanto se escreve.
export function CampoNum({ valor, onValor, formata, className, id, label, inputMode = 'decimal' }: {
  valor: number; onValor: (n: number) => void; formata: (n: number) => string; className?: string; id?: string; label?: string; inputMode?: 'decimal' | 'numeric';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [txt, setTxt] = useState(formata(valor));
  useEffect(() => {
    if (document.activeElement !== ref.current) setTxt(formata(valor));
  }, [valor, formata]);
  return (
    <input
      ref={ref} id={id} className={className} inputMode={inputMode} aria-label={label} value={txt}
      onChange={(e) => { setTxt(e.target.value); onValor(r2(num(e.target.value))); }}
      onBlur={() => setTxt(formata(valor))}
    />
  );
}

// Textarea que cresce com o texto (field-sizing não existe em todos os browsers).
export function AreaTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports?.('field-sizing', 'content')) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}

export function Plano({ m }: { m: Medida }) {
  const c = num(m.comp), l = num(m.larg);
  const ok = !m.estimar && c > 0 && l > 0;
  let w = 150, h = 108;
  if (ok) { const s = Math.min(170 / c, 120 / l); w = c * s; h = l * s; }
  const x0 = Math.round((300 - w) / 2 - 12), y0 = 40, xr = x0 + w, yb = y0 + h, dy = 22, dx = xr + 24;
  const tk = (x: number, y: number) => <path className="tk" d={`M${x - 4} ${y + 4}L${x + 4} ${y - 4}`} />;
  const lc = ok ? fmtN(c) : '?', ll = ok ? fmtN(l) : '?';
  const area = ok ? `${fmtN(r2(c * l))} m²` : m.estimar ? 'estimar pelas fotos' : 'sem medidas';
  return (
    <svg viewBox={`0 0 300 ${Math.ceil(yb + 14)}`} role="img" aria-label={ok ? `Planta com ${lc} m por ${ll} m, área ${area}` : 'Planta ainda sem medidas'}>
      <line className="ext" x1={x0} y1={dy} x2={x0} y2={y0} /><line className="ext" x1={xr} y1={dy} x2={xr} y2={y0} />
      <line className="dim" x1={x0} y1={dy} x2={xr} y2={dy} />{tk(x0, dy)}{tk(xr, dy)}
      <text className="lbl" x={(x0 + xr) / 2} y={dy - 7} textAnchor="middle">{lc}</text>
      <line className="ext" x1={xr} y1={y0} x2={dx} y2={y0} /><line className="ext" x1={xr} y1={yb} x2={dx} y2={yb} />
      <line className="dim" x1={dx} y1={y0} x2={dx} y2={yb} />{tk(dx, y0)}{tk(dx, yb)}
      <text className="lbl" x={dx + 8} y={(y0 + yb) / 2 + 4}>{ll}</text>
      <rect className={'sala' + (ok ? '' : ' vazia')} x={x0} y={y0} width={w} height={h} />
      <text className={'area' + (ok ? '' : ' vazia')} x={x0 + w / 2} y={y0 + h / 2 + 4} textAnchor="middle">{area}</text>
    </svg>
  );
}
