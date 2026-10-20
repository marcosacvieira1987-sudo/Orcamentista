import { NextResponse } from 'next/server';
import { lerEmpresa } from '@/lib/empresa';
import { ErroIA, perguntarClaude, perguntarJSON } from '@/lib/ia';
import { ivaPadrao, juntarLeituras, normOrc, normPerguntas, type Estado, type Orc } from '@/lib/orc';
import { promptAjuste, promptLeitura, promptMensagem, promptOrcamento, promptPerguntas, type Contexto } from '@/lib/prompts';
import { utilizadorAtual } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LIMITE = Number(process.env.LIMITE_IA_DIA) || 80;
const MAX_FOTOS_POR_PEDIDO = 8;

type Corpo =
  | { acao: 'leitura'; pedido: Contexto['pedido']; fotos: string[]; a: number; total: number }
  | { acao: 'perguntas'; ctx: Contexto }
  | { acao: 'orcamento'; ctx: Contexto }
  | { acao: 'ajuste'; instr: string; orc: Orc; prazo: string }
  | { acao: 'mensagem'; estado: Pick<Estado, 'pedido' | 'meta' | 'orc'> };

export async function POST(req: Request) {
  const u = await utilizadorAtual();
  if (!u) return NextResponse.json({ code: 'session_expired' }, { status: 401 });

  let corpo: Corpo;
  try { corpo = await req.json(); } catch { return NextResponse.json({ code: 'invalid_request' }, { status: 400 }); }

  // Limite diário por utilizador (controlo de custos). As linhas só podem ser lidas e acrescentadas.
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await u.sb.from('uso_ia').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  if ((count || 0) >= LIMITE) return NextResponse.json({ code: 'limite_diario' }, { status: 429 });
  await u.sb.from('uso_ia').insert({ acao: corpo.acao });

  const { data: row } = await u.sb.from('empresas').select('*').eq('user_id', u.id).maybeSingle();
  const empresa = lerEmpresa(row);

  try {
    switch (corpo.acao) {
      case 'leitura': {
        const caminhos = (corpo.fotos || []).slice(0, MAX_FOTOS_POR_PEDIDO);
        if (!caminhos.length || caminhos.some((p) => typeof p !== 'string' || !p.startsWith(u.id + '/'))) throw new ErroIA('image_rejected', 400);
        // Descarrega com a sessão do utilizador: as regras de Storage garantem que só lê as suas fotos.
        const imagens = await Promise.all(caminhos.map(async (p) => {
          const { data, error } = await u.sb.storage.from('fotos').download(p);
          if (error || !data) throw new ErroIA('image_rejected', 400);
          return { media_type: 'image/jpeg' as const, data: Buffer.from(await data.arrayBuffer()).toString('base64') };
        }));
        const a = Math.max(1, Math.round(corpo.a) || 1);
        const r = await perguntarJSON(promptLeitura(corpo.pedido, a, a + imagens.length - 1, Math.max(corpo.total || 0, a + imagens.length - 1)), { imagens, esforco: 'medium' });
        return NextResponse.json({ leitura: juntarLeituras([r]) });
      }
      case 'perguntas': {
        const r = await perguntarJSON(promptPerguntas(corpo.ctx), { esforco: 'low' });
        return NextResponse.json({ perguntas: normPerguntas(r) });
      }
      case 'orcamento': {
        const r = await perguntarJSON(promptOrcamento(corpo.ctx, empresa), { esforco: 'high', maxTokens: 32000 });
        const orc = normOrc(r, empresa.precos, ivaPadrao(empresa));
        if (!orc.capitulos.length) throw new ErroIA('empty_completion');
        return NextResponse.json({ orc });
      }
      case 'ajuste': {
        const instr = String(corpo.instr || '').trim().slice(0, 2000);
        if (!instr || !corpo.orc) throw new ErroIA('invalid_request', 400);
        const r = await perguntarJSON(promptAjuste(instr, corpo.orc, corpo.prazo, empresa), { esforco: 'medium', maxTokens: 32000 });
        const orc = normOrc(r, empresa.precos, ivaPadrao(empresa), corpo.orc);
        if (!orc.capitulos.length) throw new ErroIA('empty_completion');
        return NextResponse.json({ orc });
      }
      case 'mensagem': {
        const texto = await perguntarClaude(promptMensagem(corpo.estado, empresa), { esforco: 'low', maxTokens: 2000 });
        return NextResponse.json({ texto });
      }
      default:
        return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ErroIA) return NextResponse.json({ code: e.code }, { status: e.status });
    console.error('api/ia', e);
    return NextResponse.json({ code: 'unavailable' }, { status: 500 });
  }
}
