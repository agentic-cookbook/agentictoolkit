#!/usr/bin/env bash
# Consumer-side convenience. Run this from your consumer repo after
# pulling a fresh revision of this submodule.
#
# Behavior depends on where you invoke it from:
#
#   • From a directory containing package.json:
#       runs `npm install` there so the file: refs into this submodule
#       (e.g. file:./vendor/agentictoolkit/packages/web/packages/<name>)
#       get re-linked. This is the web-consumer flow.
#
#   • Always (regardless of cwd):
#       regenerates the Apple Xcode projects from project.yml inside the
#       submodule so `packages/apple/*.xcodeproj` matches the freshly
#       pulled `project.yml`. This is the Apple-consumer flow.
#
# Run it from anywhere — it'll do whichever of the two flows apply to
# you. Both flows are safe to run together; neither writes outside its
# own scope.

set -euo pipefail

# Where the user invoked the script from (preserve cwd before we move).
consumer_dir="$PWD"
# Where this script lives (the submodule root).
submodule_dir="$(cd "$(dirname "$0")" && pwd)"

# --- Web consumer flow ---------------------------------------------------
if [ -f "$consumer_dir/package.json" ]; then
  echo "==> Running 'npm install' in $consumer_dir"
  ( cd "$consumer_dir" && npm install )
elif [ "$consumer_dir" != "$submodule_dir" ]; then
  echo "info: no package.json in $consumer_dir — skipping npm install."
  echo "      If you're a web consumer, run this from the directory that"
  echo "      contains your app's package.json (e.g. websites/myapp/),"
  echo "      not its parent."
fi

# --- Apple consumer flow -------------------------------------------------
if command -v xcodegen >/dev/null; then
  echo "==> Regenerating Apple Xcode projects in $submodule_dir/packages/apple/"
  for proj in AgenticToolkit AIPlugins AgenticToolkitApp; do
    ( cd "$submodule_dir/packages/apple/$proj" && xcodegen generate )
  done
else
  echo "info: xcodegen not installed — skipping Apple project regeneration."
  echo "      Apple consumers can install it with: brew install xcodegen"
fi
