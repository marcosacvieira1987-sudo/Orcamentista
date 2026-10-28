# Ativar os pagamentos (Stripe)

As regras de negócio estão em [`decisoes.md`](decisoes.md). O código está pronto: falta criar a conta Stripe, correr o SQL e pôr as chaves no Vercel. Faça tudo primeiro em **modo de teste** e só depois repita em modo real.

## Como funciona

- **Planos:** Essencial, Pro e Premium. Pagamento mensal ou anual, que vale 10 meses. Preços, limites e datas estão num só ficheiro, `lib/planos.ts`.
- **Conta nova:** 14 dias grátis, sem cartão, com as funções do Premium e 2 orçamentos com IA para os 14 dias todos (`LIMITE_EXPERIMENTAL`; não volta a zero no dia 1). Ajustes ao mesmo orçamento não contam outra vez.
- **Subscrever durante os 14 dias:** os dias grátis que faltam mantêm-se e a primeira cobrança é no fim (se faltarem mais de 2 dias, porque o Stripe pede pelo menos 48 h). Até ao primeiro pagamento continua com o limite da experiência (2 orçamentos com IA); na página Plano, "Começar já" acaba os dias grátis, cobra nesse momento e liberta o plano todo. Os colegas da beta ficam de fora: têm o plano todo no 1.º mês grátis.
- **Limite mensal:** "X de Y orçamentos com IA este mês" aparece na lista e na página Plano. Ao chegar ao limite, a IA pausa para orçamentos novos até dia 1. Os ajustes a orçamentos já começados continuam.
- **Preço de lançamento:**
  - à venda só entre `LANCAMENTO_INICIO` e `LANCAMENTO_FIM`;
  - os emails em `BETA_EMAILS` têm-no sempre, com o 1.º mês grátis, na primeira adesão;
  - quem o compra mantém-no nas renovações e ao mudar de plano. Se cancelar e voltar, paga o normal.
- **Mudar de plano ou de período:** faz-se na página Plano. A diferença é cobrada ou creditada na hora.
- **Portal do Stripe:** o botão "Pagamento, faturas e cancelamento" abre-o, para mudar o cartão, ver faturas ou cancelar. O cancelamento tem efeito no fim do período pago.
- **Sem plano:** os orçamentos e os PDF ficam acessíveis, mas a IA para.
- **Garantia de 30 dias:** só na primeira compra de cada conta, a contar do primeiro pagamento. A data fica guardada e a página Plano mostra até quando vale. O reembolso faz-se à mão (ver abaixo).

## 1. Base de dados (Supabase)

Supabase → **SQL Editor** → New query → cole todo o conteúdo de `supabase/atualizar-producao.sql` → **Run**. Deve aparecer "Base de dados atualizada (0002 a 0008)".

Este ficheiro junta as migrações 0002 a 0008 e pode correr mais do que uma vez: o que já existir fica como está.

## 2. Conta Stripe

1. Crie a conta em stripe.com com os dados da MMGS (Portugal, IBAN para receber).
2. Com o interruptor **Test mode** ligado: Programadores → Chaves de API → copie a **chave secreta** (`sk_test_...`).
3. **Métodos de pagamento** (Definições → Pagamentos → Métodos de pagamento): ative **Cartões** e **Débito direto SEPA**.
   - Que saibamos, o Multibanco e o MB WAY só servem para pagamentos únicos e não aparecem nas subscrições. Confirme no painel: se lá aparecerem como disponíveis para subscrições, pode ativá-los.

## 3. Vercel

Projeto → Settings → **Environment Variables**. Nunca cole chaves no chat nem no código.

| Nome | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | a chave secreta do passo 2.2 |
| `CONTAS_ADMIN` | o seu email de entrada no app (vê a administração do Stripe) |
| `CONTAS_ISENTAS` | o seu email de entrada (acesso total, sem limite) |
| `BETA_EMAILS` | emails dos colegas da beta, separados por vírgulas |
| `LANCAMENTO_INICIO` e `LANCAMENTO_FIM` | opcional. Por omissão, `2026-11-27T00:00:00Z` e `2026-11-30T23:59:59Z`. Para abrir mais cedo, mude o início |

Depois: Deployments → no último, **⋯ → Redeploy**.

## 4. Criar produtos, preços, IVA, portal e webhook (um botão)

1. Entre no app com o email de `CONTAS_ADMIN` → menu **Plano** → no fim da página, **Administração do Stripe**.
2. Clique em **Criar o que falta no Stripe**. O botão cria:
   - 3 produtos (Prumo Essencial, Pro e Premium);
   - 12 preços: mensal e anual, normal e lançamento, cada um com uma chave como `prumo_pro_anual_lancamento`;
   - a taxa de IVA de 23 %;
   - a configuração do portal do cliente;
   - o webhook para este endereço.
3. Aparece o **segredo do webhook** (`whsec_...`) **uma única vez**. Copie-o para o Vercel como `STRIPE_WEBHOOK_SECRET` e faça **Redeploy**.
4. Volte à página Plano: as quatro linhas devem estar com ✓.

Se um dia mudar um preço em `lib/planos.ts`, volte a clicar no botão. Cria o preço novo com a mesma chave, e quem já subscreveu mantém o preço antigo.

## 5. Testar (modo de teste)

1. Crie uma conta de teste com um email que **não** esteja em `CONTAS_ISENTAS` → menu **Plano** → escolha Mensal ou Anual → Subscrever.
2. Pague com o cartão `4242 4242 4242 4242`, uma data futura e qualquer CVC.
3. Ao voltar deve ver "Pagamento recebido" e o plano ativo, com o contador "0 de 6/12/36".
4. Experimente "Mudar para o Premium" e "Passar a anual".
5. No Stripe → Programadores → Webhooks → o seu destino: os eventos devem ter resposta 200.
6. Para testar o lançamento antes de 27 nov, ponha no Vercel um `LANCAMENTO_INICIO` no passado, faça Redeploy e volte a pôr a data certa no fim.

## 6. Passar a modo real

Desligue o Test mode no Stripe e copie a chave `sk_live_...` para `STRIPE_SECRET_KEY` no Vercel. Faça Redeploy e repita o passo 4: os produtos, preços e webhook de teste não passam para o modo real.

## Reembolso da garantia de 30 dias

A página Plano do cliente mostra até quando vale a garantia. Para reembolsar:

1. Stripe → **Pagamentos** → abra o pagamento → **Reembolsar** (valor total).
2. Stripe → **Clientes** → a subscrição → **Cancelar** (de imediato).

## Faturas em Portugal

As faturas do Stripe não são certificadas pela AT. A decisão provável é o **Moloni** ligado ao Stripe: cada pagamento gera a fatura certificada e comunica-a à AT. Confirme com o contabilista; esta é a fase 2 do plano.
