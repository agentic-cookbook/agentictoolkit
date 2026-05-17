#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v xcodegen >/dev/null || {
  echo "error: xcodegen is required (brew install xcodegen)"
  exit 1
}

echo "==> Regenerating Apple Xcode projects from project.yml"
for proj in packages/apple/AgenticToolkit packages/apple/AIPlugins packages/apple/AgenticToolkitApp; do
  echo "    $proj"
  ( cd "$proj" && xcodegen generate )
done

cat <<'EOF'

Workspace ready.

Open in Xcode:
    open packages/apple/AgenticToolkit.xcworkspace

Build from the command line (see .claude/CLAUDE.md for full commands):
    DD=~/Library/Developer/Xcode/DerivedData/AgenticToolkit-managed
    xcodebuild -workspace packages/apple/AgenticToolkit.xcworkspace \
               -scheme AgenticToolkitMacOS \
               -destination 'platform=macOS,arch=arm64' \
               -derivedDataPath "$DD" build
EOF
