# Ativar os pagamentos (Stripe)

O código já está pronto. Faltam três coisas que só podem ser feitas por si: a conta Stripe, a base de dados e as chaves no Vercel. Faça tudo primeiro em **modo de teste** (interruptor "Test mode" no Stripe) e só depois repita em modo real.

## Como funciona

- Conta nova: **14 dias grátis**, com tudo incluído e sem cartão. Contas que já existiam: **30 dias**, contados a partir do passo 1.
- Depois disso, sem plano: os orçamentos e os PDF continuam acessíveis, mas a IA fica em pausa.
- **Pro (59 € + IVA)**: só a proposta rápida. **Premium (180 € + IVA)**: também a proposta completa.
- Subscrever: menu **Plano** → página de pagamento do Stripe (cartão ou débito direto, com NIF e morada para a fatura).
- Mudar de plano, trocar o cartão, ver faturas ou cancelar: botão **Gerir subscrição** (portal do Stripe). O cancelamento tem efeito no fim do mês já pago.
- O Stripe avisa o app de cada pagamento, renovação, falha ou cancelamento (webhook). Uma conta não consegue mudar o próprio plano.
- Apagar a conta cancela a subscrição no Stripe.

## 1. Base de dados (Supabase)

Supabase → **SQL Editor** → New query → cole todo o conteúdo de `supabase/migrations/0004_assinaturas.sql` → **Run**. Deve aparecer "Subscrições prontas". Pode correr mais do que uma vez sem problemas.

## 2. Stripe

1. Crie a conta em stripe.com com os dados da empresa (Portugal, IBAN para receber).
2. **Produtos** → Adicionar produto:
   - "Prumo Pro": preço recorrente mensal de **59,00 €**, com o imposto **excluído** do preço.
   - "Prumo Premium": preço recorrente mensal de **180,00 €**, também com o imposto excluído.
   - Copie o ID de cada preço (começa por `price_`).
3. **IVA**, escolha uma das opções:
   - simples: Mais → Impostos → Taxas de imposto → criar "IVA 23 %", Portugal, **exclusiva**. Copie o ID (`txr_...`);
   - automática: ative o **Stripe Tax** (registo em Portugal). Calcula sozinho o IVA e a autoliquidação para empresas de outros países da UE, mas tem um custo por transação.
4. **Portal do cliente** (Definições → Faturação → Portal do cliente):
   - ative a atualização do método de pagamento, o histórico de faturas e o cancelamento no fim do período;
   - em "Mudar de plano", junte os dois produtos (Pro e Premium);
   - guarde.
5. **Webhook** (Programadores → Webhooks → Adicionar destino):
   - URL: `https://orcamentista-coral.vercel.app/api/pagamentos/webhook` (ou o seu domínio);
   - eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused` e `customer.subscription.resumed`;
   - depois de criar, copie o **segredo de assinatura** (`whsec_...`).
6. **Programadores → Chaves de API**: copie a **chave secreta** (`sk_test_...` em teste, `sk_live_...` em real).

## 3. Vercel

Projeto → Settings → **Environment Variables**. Acrescente (nunca as cole no chat nem as ponha no código):

| Nome | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | chave secreta do passo 2.6 |
| `STRIPE_WEBHOOK_SECRET` | segredo do webhook do passo 2.5 |
| `STRIPE_PRECO_PRO` | `price_...` do Pro |
| `STRIPE_PRECO_PREMIUM` | `price_...` do Premium |
| `STRIPE_TAXA_IVA` | `txr_...` (se escolheu a taxa simples) |
| `STRIPE_IVA_AUTOMATICO` | `1` (só se ativou o Stripe Tax; nesse caso deixe a anterior vazia) |
| `CONTAS_ISENTAS` | o email com que entra no app (acesso total sem pagar); vários separados por vírgulas |

Depois: Deployments → no último, **⋯ → Redeploy**, para as variáveis entrarem em vigor.

## 4. Testar (modo de teste)

1. Entre no app com uma conta que **não** esteja em `CONTAS_ISENTAS` → menu **Plano** → Subscrever o Pro.
2. Pague com o cartão de teste `4242 4242 4242 4242`, uma data futura e qualquer CVC.
3. Ao voltar deve ver "Pagamento recebido" e "Plano Pro ativo". Num orçamento, a opção "Completa" aparece como Premium.
4. Gerir subscrição → mude para Premium. Ao voltar, o plano deve mostrar Premium.
5. No Stripe → Webhooks → o seu destino: os eventos devem aparecer com resposta 200.

Quando estiver tudo bem, ative o modo real no Stripe e repita os passos 2 e 3 com os IDs e chaves reais (os de teste não servem em modo real).

## Faturas em Portugal

As faturas do Stripe não são emitidas por software certificado pela AT. Para cumprir a lei, ligue o Stripe a um programa de faturação certificado que tenha integração com o Stripe (por exemplo InvoiceXpress, Moloni ou Vendus): cada pagamento gera a fatura certificada e comunica-a à AT. Confirme a solução com o seu contabilista.
