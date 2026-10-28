# Lista para abrir a venda

Por ordem. O código está pronto e testado; estes passos só podem ser feitos por si, porque pedem contas, chaves ou decisões legais. Nunca cole chaves no chat.

## Já (cerca de 30 minutos)

- [ ] **Base de dados.** Supabase → SQL Editor → colar `supabase/atualizar-producao.sql` → Run. Deve aparecer "Base de dados atualizada (0002 a 0007)". Sem isto:
  - o envio continua só com o link do PDF;
  - a parte "A sua marca" na página Empresa não fica guardada.
- [ ] **A sua conta sem limites.** Vercel → Settings → Environment Variables:
  - `CONTAS_ISENTAS` = o email com que entra no app;
  - `CONTAS_ADMIN` = o mesmo email, para ver a administração do Stripe e as métricas em `/admin`.

  Depois: Deployments → ⋯ → Redeploy.
- [ ] **Colegas da beta.** No Vercel, `BETA_EMAILS` = os emails deles, separados por vírgulas. Têm o preço de lançamento sem prazo e o 1.º mês grátis.

## Stripe em modo de teste (cerca de 1 hora)

- [ ] Criar a conta Stripe com os dados da MMGS e copiar a chave `sk_test_...` para `STRIPE_SECRET_KEY` no Vercel → Redeploy.
- [ ] No app: **Plano** → **Administração do Stripe** → **Criar o que falta no Stripe**.
- [ ] Copiar o segredo do webhook que aparece para `STRIPE_WEBHOOK_SECRET` no Vercel → Redeploy.
- [ ] Testar com uma conta que não seja a sua: subscrever com o cartão `4242 4242 4242 4242`, mudar de plano, passar a anual e cancelar. Passo a passo em `pagamentos.md`.

## Antes de cobrar a sério

- [ ] **Contabilista:** confirmar a MMGS como vendedora e o Moloni, ou outro programa certificado, ligado ao Stripe para as faturas.
- [ ] **Jurista:** rever `/termos` e `/privacidade`, que ainda dizem "Versão provisória". Quando estiverem revistos, eu tiro essa nota.
- [ ] **Domínio próprio:** registar o domínio com o nome Prumo. No Vercel, em Settings → Domains, juntá-lo e pôr `SITE_URL=https://o-dominio`. No Supabase, em Authentication → URL Configuration, trocar o Site URL e os Redirect URLs.
- [ ] **Email com o domínio:** criar o contacto (ex.: `ola@dominio`) e, se quiser avisos por email quando um cliente aceita, criar conta no Resend com o domínio verificado e pôr `RESEND_API_KEY` e `EMAIL_REMETENTE` no Vercel. Depois diga-me o email de contacto público, para eu o trocar no site (hoje está `mmgs.geral@gmail.com`).
- [ ] **Stripe em modo real:** chave `sk_live_...` no Vercel e repetir "Criar o que falta no Stripe" e o segredo do webhook.
- [ ] **Teste completo:** do registo ao primeiro pagamento real (pode reembolsar a seguir).

## Quando tiver

- [x] **Vídeo do hero:** o filme "A Linha" está no site, no ecrã Entrar e no ecrã de planos (`public/landing/a-linha.mp4` e `a-linha-ato3.mp4`).
- [ ] **Os seus negócios de gestão:** nome, frase, 3 ou 4 serviços e contacto, para ativar essa secção no site.
- [ ] **Números da beta:** ao fim de algumas semanas, ver `/admin` (tempo antes e depois, custo de IA). Só passam para o site números verdadeiros e com amostra suficiente.
