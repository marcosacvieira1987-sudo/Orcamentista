'use client';
import { useEffect, useRef, useState } from 'react';

// Filme "A Linha" do hero: toca uma vez quando aparece no ecrã e para no último fotograma.
// As cartas desse fotograma passam a ser a interface: os links ficam por cima, em código,
// nas posições das cartas (medidas no filme de 1080×1920).
type Props = { mp4: string; poster?: string; mostrarEm: number; desde: string };

export default function HeroFilme({ mp4, poster, mostrarEm, desde }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ui, setUi] = useState(false);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const irFim = () => {
      const ir = () => { try { v.currentTime = Math.max(0, (v.duration || 0) - 0.05); } catch { /* sem metadados ainda */ } };
      if (v.readyState >= 1) ir(); else v.addEventListener('loadedmetadata', ir, { once: true });
    };
    const acabou = () => { setUi(true); setFim(true); };
    const tempo = () => { if (v.currentTime >= mostrarEm) setUi(true); };
    v.addEventListener('timeupdate', tempo);
    v.addEventListener('ended', acabou);
    let reserva: number | undefined;
    const comecar = () => {
      // se o telemóvel não deixar tocar (poupança de bateria), mostra a última imagem com as cartas
      reserva = window.setTimeout(() => { if (v.paused || v.readyState < 3) { irFim(); acabou(); } }, (mostrarEm + 4) * 1000);
      if (calmo) { irFim(); acabou(); return; }
      v.play().catch(() => { irFim(); acabou(); });
    };
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); comecar(); } }, { threshold: 0.35 });
    io.observe(v);
    return () => {
      io.disconnect();
      v.removeEventListener('timeupdate', tempo);
      v.removeEventListener('ended', acabou);
      if (reserva) window.clearTimeout(reserva);
    };
  }, [mostrarEm]);

  const deNovo = () => {
    const v = ref.current;
    if (!v) return;
    setUi(false);
    setFim(false);
    v.currentTime = 0;
    v.play().catch(() => { /* fica parado */ });
  };

  const foco = ui ? 0 : -1;
  return (
    <div className="lp-filme">
      <video ref={ref} src={mp4} poster={poster} muted playsInline preload="auto" aria-hidden="true" />
      <div className={'lp-filme-ui' + (ui ? ' on' : '')} aria-hidden={!ui}>
        <a href="#como" className="lp-carta c1" tabIndex={foco}><span>Seis passos</span><strong>Como funciona</strong></a>
        <a href="#planos" className="lp-carta c2" tabIndex={foco}><span>Desde {desde} por mês + IVA</span><strong>Ver os planos</strong></a>
        <a href="/registar" className="lp-pilula" tabIndex={foco}>Experimentar 14 dias grátis</a>
      </div>
      {fim ? (
        <button type="button" className="lp-filme-repete" onClick={deNovo} aria-label="Ver o filme de novo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4h4" /></svg>
        </button>
      ) : null}
    </div>
  );
}
