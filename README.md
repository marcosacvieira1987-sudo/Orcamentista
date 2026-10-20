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
| Lista de orçamentos (rascunho / aprovado, total) | `app/orcamentos/page.tsx` |
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
2. Aplique o esquema `supabase/migrations/0001_inicial.sql`: cole-o no *SQL Editor* ou use `npx supabase link` + `npx supabase db push`.
3. *Authentication → URL Configuration*:
   - **Site URL**: o endereço da app (ex.: `https://prumo.vercel.app`).
   - **Redirect URLs**: `https://prumo.vercel.app/auth/confirmar` (e `http://localhost:3000/auth/confirmar` para desenvolvimento).
4. *Authentication → Emails*: traduza os modelos para português. Para produção, configure SMTP próprio, porque o envio de email incluído no Supabase tem limites baixos.

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` (local) e defina as mesmas no Vercel (*Settings → Environment Variables*):

| Variável | Onde a obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública (`sb_publishable_…`, ou a antiga `anon`) |
| `SUPABASE_SECRET_KEY` | Chave secreta (`sb_secret_…`, ou a antiga `service_role`). Só serve para apagar contas |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `LIMITE_IA_DIA` | Opcional (80) |

### 3. Vercel
Importe o repositório no Vercel. Não precisa de mais configuração. A rota da IA pede até 300 s (`maxDuration`): o esboço do orçamento pode demorar 1–2 minutos.

### Desenvolvimento local
```bash
npm install
npx supabase start            # Supabase local (Docker); aplica a migração
# copie para .env.local o URL e as chaves que o comando mostra, e a sua ANTHROPIC_API_KEY
npm run dev
node scripts/testar-rls.mjs   # 17 verificações de isolamento entre contas
```

## Depois do MVP
- **Subscrições** (ex.: Stripe Billing): tabela `subscricoes` ligada a `auth.users`, webhook no servidor, e o limite diário da IA passa a depender do plano.
- Política de privacidade e termos revistos por um jurista (a página atual é um rascunho), registo das atividades de tratamento e um contrato de subcontratação (DPA) com Supabase e Anthropic.
- Taxas de IVA das regiões autónomas (Açores, Madeira): a revisão só oferece 23/13/6 %.
- Numeração sequencial das propostas por empresa (hoje é data + iniciais do cliente, editável).
