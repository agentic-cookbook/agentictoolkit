#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../packaging"
exec pnpm --filter agentic-web-toolkit-site dev
