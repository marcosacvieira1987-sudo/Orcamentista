# Testes de ponta a ponta

Correm a app compilada contra o Supabase local, com imitações da API do Claude e do Stripe. Não gastam IA nem fazem pagamentos.

Todos os dados são fictícios ("Silva & Filhos Remodelações", "Maria Fernandes"), e as imagens em `fixtures/` são sintéticas.

## Preparar (uma vez)

```bash
npm install
npx supabase start            # Docker; aplica as migrações de supabase/migrations
# .env.local com o URL e as chaves que o comando mostra (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY)
```

O browser é o Chromium do sistema (`CHROMIUM_PATH`; por omissão `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).

## Correr

```bash
bash tests/e2e/correr.sh
```

Compila, arranca as imitações e a app, e corre:

| Ficheiro | O que testa |
|---|---|
| `fluxo.mjs` | registo, empresa, orçamento completo com fotos, revisão, PDF, envio por WhatsApp e email, duplicar |
| `planos.mjs` | administração do Stripe (produtos e preços), limites mensais, Essencial anual, mudar para Premium, beta com 1.º mês grátis, webhook |
| `planos-portal.mjs normal` | Pro mensal, passar a anual, portal, apagar conta cancela a subscrição |
| `planos-portal.mjs lancamento` | preços de lançamento com a janela aberta (a app arranca com `LANCAMENTO_INICIO` no passado) |
| `marca.mjs` | cores do logótipo, modelos, textos pela IA e limite, marca no app, página da proposta, visitas (os robôs não contam), "Aceitar proposta", proposta expirada, Essencial |
| `scripts/testar-rls.mjs` | isolamento entre contas (RLS) |

As capturas de ecrã e os registos ficam em `tests/e2e/saida/`, que o git ignora.
