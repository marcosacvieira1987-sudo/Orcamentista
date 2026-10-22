'use client';
// Botão de ditado por voz (português de Portugal). Usa o reconhecimento de voz do próprio browser:
// Chrome (Android, computador) e Safari (iPhone, Mac). Sem custos de IA. Onde não existe, não aparece.
import { useEffect, useRef, useState } from 'react';

type Reconhecimento = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type Construtor = new () => Reconhecimento;
const construtor = (): Construtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

// Junta o texto ditado ao que já está escrito, com maiúscula no início de cada frase.
function juntar(atual: string, novo: string) {
  const t = novo.trim();
  if (!t) return atual;
  const base = atual.replace(/\s+$/, '');
  const fimFrase = !base || /[.!?:\n]$/.test(base);
  const frase = fimFrase ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  return base ? `${base}${base.endsWith('\n') ? '' : ' '}${frase}` : frase;
}

export default function Ditado({ valor, onValor, rotulo = 'Ditar' }: { valor: string; onValor: (v: string) => void; rotulo?: string }) {
  const [suportado, setSuportado] = useState(false);
  const [aOuvir, setAOuvir] = useState(false);
  const [provisorio, setProvisorio] = useState('');
  const [erro, setErro] = useState('');
  const rec = useRef<Reconhecimento | null>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;

  useEffect(() => { setSuportado(!!construtor()); return () => rec.current?.stop(); }, []);
  if (!suportado) return null;

  function comecar() {
    const C = construtor(); if (!C) return;
    setErro('');
    const r = new C();
    r.lang = 'pt-PT'; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onValor(juntar(valorRef.current, res[0].transcript));
        else interim += res[0].transcript;
      }
      setProvisorio(interim);
    };
    r.onerror = (e) => {
      setErro(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Sem acesso ao microfone: autorize-o nas definições do browser.' : e.error === 'no-speech' ? '' : 'O ditado parou. Toque de novo para continuar.');
    };
    r.onend = () => { setAOuvir(false); setProvisorio(''); };
    rec.current = r;
    try { r.start(); setAOuvir(true); } catch { setAOuvir(false); }
  }
  function parar() { rec.current?.stop(); setAOuvir(false); }

  return (
    <span className="ditado">
      <button type="button" className={'btn sm ditado-btn' + (aOuvir ? ' a-ouvir' : '')} aria-pressed={aOuvir} onClick={aOuvir ? parar : comecar} title={aOuvir ? 'Parar o ditado' : 'Ditar por voz'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        {aOuvir ? 'A ouvir… tocar para parar' : rotulo}
      </button>
      {provisorio ? <span className="ditado-prov small muted">{provisorio}</span> : null}
      {erro ? <span className="small erro">{erro}</span> : null}
    </span>
  );
}
