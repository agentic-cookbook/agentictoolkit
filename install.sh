#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Apple platform: regenerate XcodeGen-backed Xcode projects from project.yml
if command -v xcodegen >/dev/null; then
  echo "==> Regenerating Apple Xcode projects from project.yml"
  for proj in packages/apple/AgenticToolkit packages/apple/AIPlugins packages/apple/AgenticToolkitApp; do
    echo "    $proj"
    ( cd "$proj" && xcodegen generate )
  done
else
  echo "warn: xcodegen not installed — skipping Apple project regeneration."
  echo "      Install it with: brew install xcodegen"
fi

# Web platform: pnpm workspace
if command -v pnpm >/dev/null && command -v node >/dev/null; then
  echo "==> Installing web workspace deps in packages/web/"
  ( cd packages/web && pnpm install )
else
  echo "warn: node and pnpm are required for the web workspace — skipping."
  echo "      Install them and re-run ./install.sh to bootstrap packages/web/."
fi

cat <<'EOF'

Workspace ready.

Apple:
    open packages/apple/AgenticToolkit.xcworkspace
    # full xcodebuild commands: see .claude/CLAUDE.md

Web:
    cd packages/web && pnpm test
    cd packages/web && pnpm build         # populates dist/ for npm publish

Demo site (websites/site/):
    cd websites/site && npm install && npm run dev
EOF
