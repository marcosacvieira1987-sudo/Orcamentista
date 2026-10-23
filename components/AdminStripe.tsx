'use client';
// Administração (CONTAS_ADMIN): ver o estado do Stripe e criar produtos, preços, IVA, portal e webhook.
import { useEffect, useState } from 'react';

type Estado = { modo: 'teste' | 'real'; precos: { chave: string; ok: boolean }[]; iva: boolean; portal: boolean; webhook: boolean };

export default function AdminStripe() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [msg, setMsg] = useState('A verificar o Stripe…');
  const [segredo, setSegredo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const erro = (j: { code?: string; mensagem?: string }) => j.code === 'sem_chave' ? 'Falta STRIPE_SECRET_KEY no Vercel.' : `Erro do Stripe${j.mensagem ? `: ${j.mensagem}` : ''}.`;
  useEffect(() => {
    fetch('/api/pagamentos/configurar').then(async (r) => { const j = await r.json(); if (r.ok) { setEstado(j); setMsg(''); } else setMsg(erro(j)); }).catch(() => setMsg('Sem ligação.'));
  }, []);

  async function configurar() {
    setOcupado(true); setMsg('A criar no Stripe…');
    try {
      const r = await fetch('/api/pagamentos/configurar', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setMsg(erro(j)); return; }
      setEstado(j.estado); setSegredo(j.segredoWebhook || ''); setMsg('Feito.');
    } catch { setMsg('Sem ligação.'); } finally { setOcupado(false); }
  }

  const ok = estado && estado.precos.every((p) => p.ok) && estado.iva && estado.portal && estado.webhook;
  const v = (b: boolean) => (b ? '✓' : '✗');
  return (
    <section className="sheet admin-stripe" aria-labelledby="adm-h">
      <div className="sh-h"><h2 id="adm-h">Administração do Stripe</h2>{estado ? <span className={'estado ' + (estado.modo === 'real' ? 'enviado' : 'rascunho')}>{estado.modo === 'real' ? 'Modo real' : 'Modo de teste'}</span> : null}</div>
      <div className="sh-f">
        {estado ? (
          <ul className="small">
            <li>{v(estado.precos.every((p) => p.ok))} Preços: {estado.precos.filter((p) => p.ok).length} de {estado.precos.length}{estado.precos.some((p) => !p.ok) ? ` (faltam: ${estado.precos.filter((p) => !p.ok).map((p) => p.chave).join(', ')})` : ''}</li>
            <li>{v(estado.iva)} Taxa de IVA de 23 %</li>
            <li>{v(estado.portal)} Portal do cliente</li>
            <li>{v(estado.webhook)} Webhook para este endereço</li>
          </ul>
        ) : null}
        {msg ? <p className="small muted">{msg}</p> : null}
        {segredo ? (
          <div className="callout warn small">
            <strong>Webhook criado. Copie já este segredo: não volta a aparecer.</strong>
            <code className="segredo">{segredo}</code>
            <span>No Vercel → Settings → Environment Variables, crie <b>STRIPE_WEBHOOK_SECRET</b> com este valor e faça Redeploy.</span>
          </div>
        ) : null}
        {estado && !ok ? <button className="btn primary" onClick={configurar} disabled={ocupado}>Criar o que falta no Stripe</button> : null}
      </div>
    </section>
  );
}
