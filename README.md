# Prumo Orçamentista

Orçamentos de obras a partir de fotos. O profissional fotografa a obra, responde a umas perguntas, a IA monta um esboço com quantidades e preços do seu preçário, o profissional revê e gera a proposta em PDF com a sua marca.

> Nome provisório: a marca está num só sítio, `lib/marca.ts`.

## O que está feito (MVP)

| Funcionalidade | Onde |
|---|---|
| Registo, entrada, recuperação da palavra-passe | `app/(auth)`, `components/AuthForm.tsx`, `app/auth/*` |
| Empresa: nome, NIF, contactos, logótipo, cor, condições, preçário | `app/configuracao`, `components/ConfigForm.tsx` |
| Orçamento em 6 passos: pedido e fotos → leitura das fotos → perguntas → medidas → revisão → PDF | `components/Editor.tsx`, `components/editor/*` |
| Esboço pela IA (Claude API, só no servidor) | `app/api/ia/route.ts`, `lib/ia.ts`, `lib/prompts.ts` |
| Revisão das linhas: preços por confirmar, ajustes pela IA, IVA por linha | `components/editor/Revisao.tsx` |
| PDF com a marca do profissional (gerado no telemóvel) e partilha direta (WhatsApp, email) | `lib/pdf.ts` |
| Página de apresentação em `/` para quem não tem sessão: como funciona, páginas de uma proposta de exemplo, planos Pro e Premium, perguntas. Textos em `lib/site.ts` | `components/Landing.tsx`, `lib/site.ts`, `public/landing` |
| Lista de orçamentos em cartões (rascunho / aprovado / enviado, total, custo de IA), resumo de 30 dias e primeiros passos | `app/orcamentos/page.tsx` |
| Dois modelos de proposta: **completa** (capas, carta, resumo por fases, o que encontrámos, um capítulo por página, condições gerais, adjudicação com plano de pagamentos e IBAN) e **rápida** | `lib/pdf.ts`, `lib/prompts.ts` |
| Letra Poppins nos PDF (licença SIL OFL, em `public/fontes`), com Helvetica de reserva | `lib/pdf.ts` |
| Enviar por WhatsApp e email: mensagem preenchida e link seguro do PDF, válido durante a validade da proposta | `components/Editor.tsx` |
| Duplicar orçamento (com cópia das fotos) | `app/orcamentos/[id]/duplicar/route.ts` |
| Numeração sequencial por empresa (ex.: MMGS-2026-001) | `supabase/migrations/0002_proposta_completa.sql` |
| Subscrições Stripe: Essencial, Pro e Premium, mensal ou anual, preço de lançamento por datas e para a beta, limite mensal de orçamentos com IA com contador, 14 dias grátis, garantia de 30 dias, configuração automática do Stripe. Regras em [`docs/decisoes.md`](docs/decisoes.md) | `lib/planos.ts`, `lib/plano.ts`, `lib/stripe.ts`, `app/api/pagamentos/*`, `app/planos` |
| Espaço personalizado (Pro e Premium): cores tiradas do logótipo, 3 modelos de apresentação, textos da marca pela IA a partir de um questionário (com limite mensal), marca no app | `lib/cores.ts`, `lib/modelos.ts`, `app/api/textos`, `components/ConfigForm.tsx`, `lib/marca-app.ts` |
| Página da proposta para o cliente (`/p/<token>`): cópia do que foi enviado, PDF, "Aceitar proposta" com nome e data, registo de visitas, aviso no app e por email (Resend, opcional) | `components/PropostaCliente.tsx`, `app/p`, `lib/proposta.ts`, `lib/avisos.ts` |
| Site e design (fase 4): paleta MMGS (grafite, bronze, off-white), "A Linha" (fio de prumo que liga as secções), vidro só no site e nos ecrãs de entrada e de planos, app sempre claro; vídeo do hero pronto a ligar em `lib/site.ts` (`video`) | `components/landing.css`, `app/globals.css` |
| Termos de utilização, privacidade e Livro de Reclamações; titular do serviço em `lib/site.ts` | `app/termos`, `app/privacidade`, `components/Titular.tsx` |
| Instalar no telemóvel (ícone no ecrã principal) | `app/manifest.ts`, `public/icones`, `app/apple-icon.png` |
| RGPD: isolamento por conta, exportar dados, apagar conta | `supabase/migrations`, `app/api/conta`, `app/privacidade` |

A lógica, os prompts e o desenho vêm do protótipo `Orçamentista` (HTML único): os prompts estão iguais, a normalização das respostas e os cálculos foram passados para `lib/orc.ts`, o PDF para `lib/pdf.ts` e o CSS para `app/globals.css`.

## Arquitetura

- **Next.js 16** (App Router, TypeScript) no **Vercel**.
- **Supabase** (projeto numa região da UE): autenticação, Postgres e Storage privado.
  - Todas as tabelas e ficheiros têm **RLS**: cada profissional só lê e altera os seus dados. Testado em `scripts/testar-rls.mjs`.
  - As fotos ficam no bucket privado `fotos` em `<user_id>/<orçamento>/<foto>.jpg`, e os logótipos em `logos`. O browser vê-as por links assinados de 1 hora.
- **Claude API** só no servidor (`ANTHROPIC_API_KEY` nunca chega ao browser). Modelo `claude-opus-5-5`, com o esforço ajustado a cada passo: fotos `medium`, perguntas `low`, orçamento `high`. Tem *fallback* no servidor para pedidos recusados por classificadores de segurança.
  - As fotos não passam pelo browser até à IA: o servidor descarrega-as do Storage com a sessão do utilizador. Assim não esbarra no limite de 4,5 MB por pedido do Vercel.
  - **Limite diário** de pedidos à IA por utilizador (`LIMITE_IA_DIA`, por omissão 80), para controlar custos. O registo não pode ser apagado pelo utilizador.
  - O servidor volta a verificar cada preço marcado como "tabela própria" contra o preçário. Se a IA disser que veio da tabela e não veio, a linha passa a "por confirmar".
- O estado do orçamento guarda-se sozinho (JSON em `orcamentos.dados`), por isso pode continuar noutro dispositivo.

## Pôr a funcionar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com), **região da UE** (ex.: Frankfurt, `eu-central-1`).
2. Aplique as migrações por ordem, no *SQL Editor* (ou com `npx supabase link` + `npx supabase db push`):
   - `supabase/migrations/0001_inicial.sql` — tabelas, regras de acesso e ficheiros;
   - `supabase/migrations/0002_proposta_completa.sql` — proposta completa, numeração sequencial e custo da IA por orçamento.
   - `supabase/migrations/0003_propostas_enviadas.sql` — PDFs enviados por link (WhatsApp e email).
   - `supabase/migrations/0004_assinaturas.sql` — subscrições e período experimental (ver [`docs/pagamentos.md`](docs/pagamentos.md)).
   - `supabase/migrations/0005_planos_lancamento.sql` — plano Essencial, período mensal/anual, preço de lançamento e garantia.
   - `supabase/migrations/0006_espaco_personalizado.sql` — marca, textos, modelo de apresentação e página da proposta para o cliente.
   - `supabase/migrations/0007_propostas_do_dono.sql` — só se publica a proposta de um orçamento da própria conta.
   - `supabase/migrations/0008_reservar_uso_ia.sql` — limite diário da IA reservado antes de cada chamada. **Aplique antes de publicar o código que a usa**: sem ela, a IA responde "indisponível" (falha fechada).
   - Em produção, basta correr `supabase/atualizar-producao.sql`, que junta 0002 a 0008 (seguro de repetir).
3. *Authentication → URL Configuration*:
   - **Site URL**: o endereço da app (ex.: `https://prumo.vercel.app`).
   - **Redirect URLs**: `https://prumo.vercel.app/auth/confirmar` (e `http://localhost:3000/auth/confirmar` para desenvolvimento).
4. *Authentication → Emails → Templates*: cole os textos em português de [`docs/emails-supabase.md`](docs/emails-supabase.md). Para produção, configure SMTP próprio, porque o envio de email incluído no Supabase tem limites baixos.

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` (local) e defina as mesmas no Vercel (*Settings → Environment Variables*):

| Variável | Onde a obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública (`sb_publishable_…`, ou a antiga `anon`) |
| `SUPABASE_SECRET_KEY` | Chave secreta (`sb_secret_…`, ou a antiga `service_role`). Para apagar contas, gravar as subscrições e registar o limite diário da IA |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `LIMITE_IA_DIA` | Opcional (80) |
| `STRIPE_*`, `CONTAS_ADMIN`, `CONTAS_ISENTAS`, `BETA_EMAILS`, `LANCAMENTO_*` | Pagamentos e lançamento: passo a passo em [`docs/pagamentos.md`](docs/pagamentos.md) |

### 3. Vercel
Importe o repositório no Vercel. As funções correm em Frankfurt (`vercel.json`), junto da base de dados. A rota da IA pede até 300 s (`maxDuration`): o esboço do orçamento pode demorar 1–2 minutos.

### Desenvolvimento local
```bash
npm install
npx supabase start            # Supabase local (Docker); aplica a migração
# copie para .env.local o URL e as chaves que o comando mostra, e a sua ANTHROPIC_API_KEY
npm run dev
node scripts/testar-rls.mjs   # 35 verificações de isolamento entre contas
bash tests/e2e/correr.sh      # testes de ponta a ponta (ver tests/e2e/README.md)
```

## Depois do MVP
- Faturação certificada pela AT ligada ao Stripe (ver o fim de [`docs/pagamentos.md`](docs/pagamentos.md)).
- Política de privacidade e termos revistos por um jurista (a página atual é um rascunho), registo das atividades de tratamento e um contrato de subcontratação (DPA) com Supabase e Anthropic.
- Taxas de IVA das regiões autónomas (Açores, Madeira): a revisão só oferece 23/13/6 %.
