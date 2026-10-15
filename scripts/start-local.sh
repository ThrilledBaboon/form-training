#!/bin/sh
set -eu
FORM_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$FORM_ROOT"
FORM_NODE=$(command -v node || true)
if [ -z "$FORM_NODE" ]; then
  FORM_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$FORM_NODE" ] || [ ! -f node_modules/vite/bin/vite.js ]; then
  printf '%s\n' 'Install Node.js 24 and pnpm 11, then run pnpm install and pnpm build in this folder.'
  exit 1
fi
export PATH="$(dirname "$FORM_NODE"):$PATH"
export BASE_PATH=/
"$FORM_NODE" node_modules/typescript/bin/tsc -b
"$FORM_NODE" node_modules/vite/bin/vite.js build
if curl -fsS http://127.0.0.1:4173/ 2>/dev/null | head -c 1000 | grep -q 'FORM — Personal Training'; then
  open http://127.0.0.1:4173/ 2>/dev/null || true
  printf '%s\n' 'FORM is already running at http://127.0.0.1:4173/'
  exit 0
fi
(sleep 1; open http://127.0.0.1:4173/ 2>/dev/null || true) &
exec "$FORM_NODE" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort
