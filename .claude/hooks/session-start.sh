#!/bin/bash
# Sessões na nuvem do Claude Code: instala as dependências para o "npm run lint" (tsc) e os testes funcionarem.
# Os testes de ponta a ponta precisam ainda do Supabase local (npx supabase start, com Docker): ver tests/e2e/README.md.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install (não npm ci): aproveita o estado em cache do contentor entre sessões
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
