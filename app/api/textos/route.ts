import { NextResponse } from 'next/server';
import { lerEmpresa } from '@/lib/empresa';
import { ErroIA, perguntarJSON, type Uso } from '@/lib/ia';
import type { Questionario } from '@/lib/orc';
import { lerAcesso, textosNoMes } from '@/lib/plano';
import { promptTextos } from '@/lib/prompts';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const CAMPOS = ['anos', 'zona', 'especialidades', 'diferenca', 'equipa', 'tom', 'garantia', 'condicoes'] as const;
const LIMITE_DIA = Number(process.env.LIMITE_IA_DIA) || 80;

// A IA escreve os textos fixos da marca (apresentação, condições, garantia, slogan) a partir do questionário.
// Não grava nada: o profissional revê e guarda na página Empresa. Limite mensal por plano.
export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return NextResponse.json({ code: 'session_expired' }, { status: 401 });
  let corpo: { questionario?: Record<string, unknown> };
  try { corpo = await req.json(); } catch { return NextResponse.json({ code: 'invalid_request' }, { status: 400 }); }
  const q: Questionario = {};
  for (const k of CAMPOS) { const v = corpo.questionario?.[k]; if (typeof v === 'string' && v.trim()) q[k] = v.trim().slice(0, 600); }

  const [acesso, usados, { data: row }] = await Promise.all([lerAcesso(u.sb, u.id, u.email), textosNoMes(u.sb), u.sb.from('empresas').select('*').eq('user_id', u.id).maybeSingle()]);
  if (!acesso.plano) return NextResponse.json({ code: 'sem_plano' }, { status: 402 });
  if (!acesso.marca) return NextResponse.json({ code: 'so_pro' }, { status: 403 });
  if (usados >= acesso.limiteTextos) return NextResponse.json({ code: 'limite_textos', limite: acesso.limiteTextos }, { status: 402 });
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await u.sb.from('uso_ia').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  if ((count || 0) >= LIMITE_DIA) return NextResponse.json({ code: 'limite_diario' }, { status: 429 });

  const uso: Uso = { tokens_in: 0, tokens_out: 0, custo_usd: 0 };
  let resposta: NextResponse;
  try {
    const r = await perguntarJSON(promptTextos(q, lerEmpresa(row)), { esforco: 'medium', maxTokens: 4000, onUso: (x) => { uso.tokens_in += x.tokens_in; uso.tokens_out += x.tokens_out; uso.custo_usd += x.custo_usd; } }) as Record<string, unknown>;
    const t = (k: string, max: number) => String(r?.[k] ?? '').trim().slice(0, max);
    resposta = NextResponse.json({ apresentacao: t('apresentacao', 1500), condicoes: t('condicoes', 1500), garantia: t('garantia', 600), slogan: t('slogan', 80), usados: usados + 1, limite: acesso.limiteTextos });
  } catch (e) {
    if (e instanceof ErroIA) resposta = NextResponse.json({ code: e.code }, { status: e.status });
    else { console.error('api/textos', e); resposta = NextResponse.json({ code: 'unavailable' }, { status: 500 }); }
  }
  await u.sb.from('uso_ia').insert({ acao: 'textos', ...uso, custo_usd: Math.round(uso.custo_usd * 10000) / 10000 });
  return resposta;
}
