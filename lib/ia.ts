import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const MODELO = 'claude-opus-5-5';

// Erros com um código que o cliente traduz para português (ver ERROS em components/Editor.tsx).
export class ErroIA extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}

type Esforco = 'low' | 'medium' | 'high';
type Imagem = { media_type: 'image/jpeg'; data: string };

let cliente: Anthropic | null = null;
const claude = () => (cliente ??= new Anthropic());

// Uma chamada ao Claude. Em streaming para pedidos longos (o orçamento pode demorar 1–2 minutos).
// Fallback no servidor: se um classificador de segurança recusar o pedido, outro modelo continua.
export async function perguntarClaude(prompt: string, { esforco = 'medium', imagens = [], maxTokens = 16000 }: { esforco?: Esforco; imagens?: Imagem[]; maxTokens?: number } = {}) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...imagens.map((im): Anthropic.Beta.BetaContentBlockParam => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })),
    { type: 'text', text: prompt }
  ];
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await claude()
      .beta.messages.stream({
        model: MODELO,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: esforco },
        messages: [{ role: 'user', content }]
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('rate_limited', 429);
    if (e instanceof Anthropic.BadRequestError) {
      console.error('Claude 400', e.message);
      throw new ErroIA(/too long|too large|exceed/i.test(e.message) ? 'prompt_too_large' : 'image_rejected', 400);
    }
    if (e instanceof Anthropic.AuthenticationError) { console.error('ANTHROPIC_API_KEY inválida'); throw new ErroIA('unavailable', 503); }
    if (e instanceof Anthropic.APIError) { console.error('Claude', e.status, e.message); throw new ErroIA('unavailable', 503); }
    console.error('Claude ligação', e);
    throw new ErroIA('unavailable', 503);
  }
  if (msg.stop_reason === 'refusal') throw new ErroIA('refused', 422);
  const texto = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  if (!texto) throw new ErroIA('empty_completion');
  if (msg.stop_reason === 'max_tokens') console.warn('Claude: resposta cortada em max_tokens');
  return texto;
}

export async function perguntarJSON(prompt: string, opts?: Parameters<typeof perguntarClaude>[1]): Promise<unknown> {
  const texto = await perguntarClaude(prompt, opts);
  const limpo = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new ErroIA('invalid_json');
  try { return JSON.parse(limpo.slice(ini, fim + 1)); }
  catch { throw new ErroIA('invalid_json'); }
}
