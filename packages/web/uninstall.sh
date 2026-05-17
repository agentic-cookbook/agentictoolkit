#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Removing shadcn-generated primitives"

if [ -d packages/ui/src/components ]; then
  find packages/ui/src/components -mindepth 1 -maxdepth 1 \
    \( -name '*.tsx' -o -name '*.ts' \) ! -name '.gitkeep' -delete || true
fi

rm -f packages/ui/src/lib/utils.ts

cat <<'EOF'

Generated primitives removed. Committed configuration left intact:
  - packages/ui/components.json
  - packages/ui/src/styles/globals.css
  - exports map and shadcn deps in packages/ui/package.json

Re-run install.sh + shadcn add to repopulate.
EOF
