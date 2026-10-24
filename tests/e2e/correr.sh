#!/usr/bin/env bash
# Testes de ponta a ponta: app compilada + Supabase local + imitações do Claude (porta 4010) e do Stripe (12111).
# Uso: bash tests/e2e/correr.sh   (precisa de: npx supabase start, .env.local com as chaves locais, Chromium)
set -uo pipefail
cd "$(dirname "$0")/../.."
SAIDA=tests/e2e/saida; mkdir -p "$SAIDA"
[ -f .env.local ] || { echo "Falta .env.local (ver tests/e2e/README.md)"; exit 1; }
curl -s -o /dev/null http://127.0.0.1:54321/auth/v1/health || { echo "Supabase local parado: npx supabase start"; exit 1; }

node tests/e2e/mock-claude.mjs > "$SAIDA/mock-claude.log" 2>&1 & MC=$!
node tests/e2e/mock-stripe.mjs > "$SAIDA/mock-stripe.log" 2>&1 & MS=$!
NX=""
arrancar() { # $1 = variáveis extra
  [ -n "$NX" ] && kill "$NX" 2>/dev/null && sleep 1
  env ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=teste \
    STRIPE_SECRET_KEY=sk_test_imitacao STRIPE_API_BASE=http://127.0.0.1:12111 STRIPE_WEBHOOK_SECRET=whsec_teste \
    CONTAS_ADMIN=admin@prumo.teste BETA_EMAILS=beta@prumo.teste $1 \
    node node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1 > "$SAIDA/next.log" 2>&1 & NX=$!
  for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3000/ && return 0; sleep 1; done
  echo "A app não arrancou (ver $SAIDA/next.log)"; return 1
}
trap 'kill $MC $MS $NX 2>/dev/null' EXIT

echo "== compilar"; npm run build > "$SAIDA/build.log" 2>&1 || { echo "Falhou a compilação (ver $SAIDA/build.log)"; exit 1; }
arrancar "" || exit 1
falhas=0
corre() { echo "== $*"; if node "$@" 2>&1 | tee "$SAIDA/ultimo.log" | grep -v '^OK'; then :; fi; grep -qE '^FALHA|Error|falha\(s\)|ERROS NA CONSOLA' "$SAIDA/ultimo.log" && falhas=$((falhas+1)); }
corre tests/e2e/fluxo.mjs "$SAIDA"
corre tests/e2e/planos.mjs "$SAIDA"
corre tests/e2e/planos-portal.mjs normal "$SAIDA"
corre tests/e2e/marca.mjs "$SAIDA"
corre tests/e2e/acessibilidade.mjs
echo "== janela de lançamento aberta"; arrancar "LANCAMENTO_INICIO=2020-01-01T00:00:00Z" || exit 1
corre tests/e2e/planos-portal.mjs lancamento "$SAIDA"
echo "== isolamento entre contas (RLS)"; node scripts/testar-rls.mjs | tail -1 | grep -q 'Tudo isolado' || { node scripts/testar-rls.mjs | grep FALHA; falhas=$((falhas+1)); }
echo; [ "$falhas" = 0 ] && echo "TUDO CERTO" || echo "$falhas conjunto(s) com falhas"
exit "$falhas"
