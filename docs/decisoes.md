# Decisões do Prumo Orçamentista

Atualizado a 23 out 2026. Fonte: documento "Prumo — Decisões do produto".

## Planos (preços por mês, sem IVA; IVA de 23%)

| Plano | Normal | Lançamento | O que inclui |
|---|---|---|---|
| Essencial | 29 € | 19 € | Proposta rápida; 6 orçamentos com IA por mês; modelos de apresentação prontos |
| Pro (selo "Mais popular") | 59 € | 39 € | Proposta rápida; 12 orçamentos com IA por mês; espaço personalizado; a IA refaz os textos da marca até 3 vezes por mês |
| Premium | 180 € | 119 € | Tudo o que o Pro tem, mais a proposta completa; 36 orçamentos com IA por mês; a IA refaz os textos até 10 vezes por mês |

- Pagamento mensal ou anual. O anual vale 10 meses (2 oferecidos): normal 290, 590 e 1.800 €; lançamento 190, 390 e 1.190 €. O pagamento anual nunca é obrigatório.
- Os limites de orçamentos são valores iniciais e ficam num só sítio do código, para se ajustarem. Base: um orçamento completo pequeno custa em média 0,37 € de IA, por isso estes limites põem a IA à volta de 11% do preço de lançamento.
- Conta como 1 orçamento com IA cada orçamento em que a IA trabalha pela primeira vez nesse mês de calendário. Ajustes ao mesmo orçamento não contam outra vez. Um orçamento duplicado conta como novo quando a IA trabalha nele.
- O limite diário de 80 pedidos à IA (LIMITE_IA_DIA) fica como travão de segurança.
- A app mostra "X de Y orçamentos este mês". Ao chegar ao limite, a IA pausa até ao mês seguinte, com uma mensagem a sugerir subir de plano.

## Lançamento (Black Friday)

- O preço de lançamento está à venda de 27 nov 2026 às 00:00 até 30 nov 2026 às 23:59, hora de Lisboa (UTC+0 nessa altura). As datas ficam em variáveis de ambiente.
- Comunica-se como "preço de lançamento", nunca como desconto.
- Quem compra no lançamento mantém esse preço nas renovações enquanto não cancelar. Se cancelar e voltar, paga o preço normal.
- Os 14 dias grátis, sem cartão, continuam. Quem está a experimentar durante as 72 horas pode comprar ao preço de lançamento.
- Colegas da beta: preço de lançamento sem prazo para aderir e o 1.º mês grátis (lista de emails numa variável de ambiente).
- Garantia de 30 dias com reembolso total, só na primeira compra de cada conta. O reembolso faz-se à mão no Stripe; os termos e a página de planos dizem-no.
- O plano Fundador único de 19 €/mês, do plano de lançamento antigo, deixa de existir.
- A prioridade é ter a app pronta. A data-alvo da venda é a Black Friday, e pode abrir antes.

## Espaço personalizado (Pro e Premium)

- A marca do profissional define-se uma vez e aplica-se na app, nos PDF e na página da proposta que o cliente final abre.
- As cores tiram-se do logótipo em código, sem IA.
- A IA só escreve texto (apresentação da empresa, condições e garantia), a partir de um questionário curto. O resultado fica guardado e reutiliza-se em todas as propostas, sem custo extra por proposta.
- Há 3 modelos de apresentação prontos. Nada de imagens geradas por IA.
- O Essencial usa os modelos prontos, sem os textos pela IA.
- A página da proposta para o cliente final tem o botão "Aceitar proposta", que regista o nome e a data e avisa o profissional. A assinatura digital fica para mais tarde.

## Empresa, faturação e pagamentos

- Vende e fatura a MMGS Unipessoal Lda (já está em lib/site.ts). A confirmar com o contabilista.
- Faturação certificada pela AT: provavelmente o Moloni, ligado ao Stripe. A confirmar com o contabilista.
- IVA no Stripe: taxa fixa de 23% (STRIPE_TAXA_IVA), enquanto só vender em Portugal.
- Conta Stripe: criar já e testar em modo de teste (docs/pagamentos.md).
- MB WAY e Multibanco só se o Stripe os aceitar nas subscrições; senão, cartão e débito direto.
- Domínio próprio com o nome Prumo, registado antes do lançamento, e email de contacto com esse domínio.
- Termos e privacidade revistos por um jurista antes de começar a cobrar.

## Site e design

- Nome definitivo: Prumo Orçamentista.
- Paleta da MMGS: grafite #2B2A28, bronze #A47B4F (bronze claro #B9915F sobre fundo escuro), off-white #F4EFE6, stone #A7A39B. Assinatura "Prumo, por MMGS".
- O título do site mantém-se: "Fotografe a obra. A proposta monta-se."
- Conceito do site "A Linha", aprovado em princípio.
- A demonstração no site usa só obras de exemplo na primeira versão.
- Vídeo do hero (da obra ao estúdio, fundo grafite quente) no site, no ecrã "Entrar" e no ecrã de planos. O Marcos faz o vídeo no CapCut, sem texto; os textos e os números ficam por cima, em código.
- Vidro e brilho só no site e nos ecrãs de entrada e de planos. O resto da app é claro, com bom contraste, legível ao sol.
- Na beta, medir o tempo por orçamento antes e depois do Prumo, para usar no site.
- Nunca inventar testemunhos, números ou preços. Só dados verdadeiros e autorizados.

## A confirmar pelo Marcos

- Os limites de orçamentos por plano (6, 12 e 36), quando houver mais custos reais.
- O limite durante os 14 dias grátis. Por omissão: funções do Premium com o limite do Essencial.
- A data final de abertura da venda.

## Fases de implementação

1. Planos e lançamento: plano Essencial (migração, lib/plano.ts, lib/site.ts, página de planos); selo "Mais popular" no Pro; limites mensais por plano, com contador visível; preços mensais e anuais, normais e de lançamento, no Stripe; preço de lançamento só dentro das datas e para a lista da beta; 1.º mês grátis da beta; garantia e preços nos termos.
2. Faturação certificada: ligar o Stripe ao programa de faturação escolhido.
3. Espaço personalizado: marca, cores do logótipo, 3 modelos, textos pela IA com limite, página da proposta com "Aceitar proposta".
4. Site e design: paleta, vídeo do hero, app clara.
5. Antes de abrir: domínio e email, revisão jurídica, Stripe em modo real e um teste completo, do registo ao pagamento.

## Estado (23 out 2026)

- **Fase 1, planos e lançamento:** feita. Falta o Stripe: criar a conta, pôr a chave no Vercel e carregar em "Criar o que falta no Stripe" na página Plano (ver `pagamentos.md`).
- **Fase 2, faturação certificada:** à espera do contabilista (Moloni ligado ao Stripe).
- **Fase 3, espaço personalizado:** feita. Inclui:
  - as cores do logótipo e os 3 modelos de apresentação;
  - os textos pela IA, com limite;
  - a marca no app;
  - a página da proposta com "Aceitar proposta".

  Os avisos por email precisam de `RESEND_API_KEY` e `EMAIL_REMETENTE`; sem eles, o aviso aparece só no app.
- **Fase 4, site e design:** feita, menos o vídeo. Quando houver vídeo, basta pô-lo em `public/landing/` e indicar o caminho em `lib/site.ts` (`video`).
- **Fase 5, antes de abrir:** do lado do Marcos:
  - domínio e email;
  - revisão jurídica;
  - Stripe em modo real;
  - um teste completo, do registo ao pagamento.
- **Base de dados de produção:** correr `supabase/atualizar-producao.sql` (0002 a 0007).

## Decisões tomadas pelo Claude (para rever)

Cada uma passou por duas etapas: a primeira ideia, uma revisão para confirmar se havia dúvida real, e a solução escolhida. Todas se mudam facilmente; diga qual quer diferente.

| Tema | Escolha | Porquê (revisão) |
|---|---|---|
| Funções ainda por fazer nos planos | Marcar como "em breve" até existirem (hoje já não há nenhuma) | Nunca prometer o que o app não faz |
| Limite de montagens | O mesmo orçamento monta-se de raiz até 5 vezes por mês; ajustes sem limite | Impede usar um orçamento como "caixa" para vários e contornar o limite mensal |
| Textos pela IA na experiência | 3 vezes, como no Pro | A experiência tem as funções do Premium com o limite do Essencial; para os textos, o limite mais baixo de quem os tem é o do Pro |
| Beta | Preço de lançamento e 1.º mês grátis só na primeira adesão | Coerente com "se cancelar e voltar, paga o preço normal" |
| Mudar de plano | Feito no app, não no portal do Stripe | O portal podia mudar para o preço normal; no app mantém-se o preço de lançamento |
| Garantia de 30 dias | Conta a partir do primeiro pagamento da conta | "Só na primeira compra de cada conta"; durante os dias grátis ainda não há nada a reembolsar |
| Subscrever durante os 14 dias grátis | Os dias que faltam mantêm-se; a primeira cobrança é no fim da experiência | Não penaliza quem compra cedo (por exemplo, nas 72 horas do lançamento); é a prática habitual e o Stripe suporta-a |
| Orçamento de exemplo | Botão "veja primeiro um orçamento de exemplo": valores fictícios, sem IA, não se envia e não conta nas métricas | Quem experimenta vê logo o resultado final sem gastar o limite |
| Página da proposta | Só Pro, Premium e experiência; o Essencial envia o PDF | Faz parte do espaço personalizado |
| Cor por omissão das empresas novas | Grafite neutro (antes era azul) | Não impõe uma cor de marca a quem ainda não escolheu |
| Visitas à página da proposta | Contadas no browser, não no servidor | A pré-visualização do link no WhatsApp e os verificadores de links do email contavam como "vista" |
| Pré-visualização do link | Título e empresa, sem valores | O valor não aparece a quem vê a conversa |
| Letras do site | Servidas pelo próprio site | Carregar do Google envia o IP dos visitantes (já houve condenações na UE) |
| Tempo antes e depois (beta) | Tempo ativo no editor até à primeira aprovação, e "sem o Prumo, quanto levaria?" em cada orçamento (opcional, 1 toque) | Um único número por empresa seria pouco fiável |
| Aceitação da proposta | Regista o nome, a nota e a data; não é assinatura | A assinatura digital fica para mais tarde, como decidido |
| Contacto no site | `mmgs.geral@gmail.com` (das propostas da MMGS) | Até haver email com o domínio Prumo |
| Testes | No repositório, só com dados fictícios e imagens sintéticas | Os testes antigos tinham dados reais da MMGS e fotografias de uma obra |
