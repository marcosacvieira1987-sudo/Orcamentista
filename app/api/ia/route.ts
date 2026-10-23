import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lerEmpresa } from '@/lib/empresa';
import { ErroIA, perguntarClaude, perguntarJSON, type Uso } from '@/lib/ia';
import { ivaPadrao, juntarLeituras, normOrc, normPerguntas, type Empresa, type Estado, type Modelo, type Orc } from '@/lib/orc';
import { promptAjuste, promptLeitura, promptMensagem, promptOrcamento, promptPerguntas, type Contexto } from '@/lib/prompts';
import { lerAcesso } from '@/lib/plano';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LIMITE = Number(process.env.LIMITE_IA_DIA) || 80;
const MAX_FOTOS_POR_PEDIDO = 8;

type Corpo = { orcamentoId?: string } & (
  | { acao: 'leitura'; pedido: Contexto['pedido']; fotos: string[]; a: number; total: number }
  | { acao: 'perguntas'; ctx: Contexto }
  | { acao: 'orcamento'; ctx: Contexto; modelo?: Modelo }
  | { acao: 'ajuste'; instr: string; orc: Orc; prazo: string; modelo?: Modelo }
  | { acao: 'mensagem'; estado: Pick<Estado, 'pedido' | 'meta' | 'orc'> });

export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return NextResponse.json({ code: 'session_expired' }, { status: 401 });

  let corpo: Corpo;
  try { corpo = await req.json(); } catch { return NextResponse.json({ code: 'invalid_request' }, { status: 400 }); }

  // Plano: sem plano ativo a IA para; a proposta completa é só do Premium.
  const acesso = await lerAcesso(u.sb, u.id, u.email);
  if (!acesso.plano) return NextResponse.json({ code: 'sem_plano' }, { status: 402 });
  if (acesso.plano === 'pro' && (corpo.acao === 'orcamento' || corpo.acao === 'ajuste') && corpo.modelo === 'completo') return NextResponse.json({ code: 'so_premium' }, { status: 403 });

  // Limite diário por utilizador (controlo de custos). As linhas só podem ser lidas e acrescentadas.
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await u.sb.from('uso_ia').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  if ((count || 0) >= LIMITE) return NextResponse.json({ code: 'limite_diario' }, { status: 429 });

  const { data: row } = await u.sb.from('empresas').select('*').eq('user_id', u.id).maybeSingle();
  const empresa = lerEmpresa(row);

  // Soma o consumo das chamadas deste pedido, para registar o custo ligado ao orçamento.
  const uso: Uso = { tokens_in: 0, tokens_out: 0, custo_usd: 0 };
  const onUso = (x: Uso) => { uso.tokens_in += x.tokens_in; uso.tokens_out += x.tokens_out; uso.custo_usd = Math.round((uso.custo_usd + x.custo_usd) * 10000) / 10000; };
  const orcamentoId = typeof corpo.orcamentoId === 'string' && /^[0-9a-f-]{36}$/i.test(corpo.orcamentoId) ? corpo.orcamentoId : null;

  let resposta: NextResponse;
  try {
    resposta = NextResponse.json(await executar(corpo, u.sb, u.id, empresa, onUso));
  } catch (e) {
    if (e instanceof ErroIA) resposta = NextResponse.json({ code: e.code }, { status: e.status });
    else { console.error('api/ia', e); resposta = NextResponse.json({ code: 'unavailable' }, { status: 500 }); }
  }

  const { error } = await u.sb.from('uso_ia').insert({ acao: corpo.acao, orcamento_id: orcamentoId, ...uso });
  // base de dados ainda sem a migração 0002: regista pelo menos o pedido, para o limite diário
  if (error) await u.sb.from('uso_ia').insert({ acao: corpo.acao });
  return resposta;
}

async function executar(corpo: Corpo, sb: SupabaseClient, userId: string, empresa: Empresa, onUso: (u: Uso) => void) {
  switch (corpo.acao) {
    case 'leitura': {
      const caminhos = (corpo.fotos || []).slice(0, MAX_FOTOS_POR_PEDIDO);
      if (!caminhos.length || caminhos.some((p) => typeof p !== 'string' || !p.startsWith(userId + '/'))) throw new ErroIA('image_rejected', 400);
      // Descarrega com a sessão do utilizador: as regras de Storage garantem que só lê as suas fotos.
      const imagens = await Promise.all(caminhos.map(async (p) => {
        const { data, error } = await sb.storage.from('fotos').download(p);
        if (error || !data) throw new ErroIA('image_rejected', 400);
        return { media_type: 'image/jpeg' as const, data: Buffer.from(await data.arrayBuffer()).toString('base64') };
      }));
      const a = Math.max(1, Math.round(corpo.a) || 1);
      const r = await perguntarJSON(promptLeitura(corpo.pedido, a, a + imagens.length - 1, Math.max(corpo.total || 0, a + imagens.length - 1)), { imagens, esforco: 'medium', onUso });
      return { leitura: juntarLeituras([r]) };
    }
    case 'perguntas': {
      const r = await perguntarJSON(promptPerguntas(corpo.ctx), { esforco: 'low', onUso });
      return { perguntas: normPerguntas(r) };
    }
    case 'orcamento': {
      const r = await perguntarJSON(promptOrcamento(corpo.ctx, empresa, corpo.modelo), { esforco: 'high', maxTokens: 48000, onUso });
      const orc = normOrc(r, empresa.precos, ivaPadrao(empresa));
      if (!orc.capitulos.length) throw new ErroIA('empty_completion');
      return { orc };
    }
    case 'ajuste': {
      const instr = String(corpo.instr || '').trim().slice(0, 2000);
      if (!instr || !corpo.orc) throw new ErroIA('invalid_request', 400);
      const r = await perguntarJSON(promptAjuste(instr, corpo.orc, corpo.prazo, empresa, corpo.modelo), { esforco: 'medium', maxTokens: 48000, onUso });
      const orc = normOrc(r, empresa.precos, ivaPadrao(empresa), corpo.orc);
      if (!orc.capitulos.length) throw new ErroIA('empty_completion');
      return { orc };
    }
    case 'mensagem': {
      const texto = await perguntarClaude(promptMensagem(corpo.estado, empresa), { esforco: 'low', maxTokens: 2000, onUso });
      return { texto };
    }
    default:
      throw new ErroIA('invalid_request', 400);
  }
}
