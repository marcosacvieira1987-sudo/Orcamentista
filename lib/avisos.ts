import 'server-only';

// Avisos por email (Resend), só se RESEND_API_KEY e EMAIL_REMETENTE estiverem definidos.
// Sem eles, o profissional vê o aviso no app (lista de orçamentos e passo da proposta).
export async function avisarPorEmail(para: string, assunto: string, texto: string) {
  const chave = process.env.RESEND_API_KEY, de = process.env.EMAIL_REMETENTE;
  if (!chave || !de || !para) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, text: texto }),
    });
    if (!r.ok) console.error('aviso por email', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('aviso por email', e);
    return false;
  }
}
