#!/usr/bin/env bash
# Consumer-side convenience: regenerate the Apple Xcode projects from
# project.yml after pulling a fresh submodule revision.
#
# Apple consumers don't need a package install — they reference
# packages/apple/AgenticToolkit.xcworkspace (or one of its sub-projects)
# from their own workspace. This script just makes sure the generated
# xcodeproj files are in sync with project.yml.

set -euo pipefail
cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null; then
  echo "warn: xcodegen not installed — skipping project regeneration."
  echo "      Install it with: brew install xcodegen"
  exit 0
fi

for proj in packages/apple/AgenticToolkit packages/apple/AIPlugins packages/apple/AgenticToolkitApp; do
  ( cd "$proj" && xcodegen generate )
done
