#!/usr/bin/env python3
"""Toolkit boundary guard: toolkit packages are shared BETWEEN repos, so no
package source may import monorepo-internal code (@adh-shared/*) or a consumer
app's aliases (@/...). See the monorepo's docs/feature-platform.md.

Catches the ban in EVERY import form — `from '…'` (default/named import +
re-export), a side-effect `import '…'`, a dynamic `import('…')`, and a
`require('…')` — for both banned specifier prefixes. Both bans are absolute:
every package under `packages/` is library code, so neither a consumer alias
nor monorepo-internal code has any business in one. stdlib-only,
Python-3.9-safe."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "packages"

# Any import/require form immediately followed by a quoted banned specifier.
# A match is a violation outright — there is no per-match decision to make, so
# nothing here captures:
#   from '…' / export … from '…'   default/named import + re-export
#   import '…'                      side-effect import (no binding)
#   import('…')                     dynamic import
#   require('…')                    CommonJS require
BAD = re.compile(
    r"(?:from\s+['\"]|import\s+['\"]|import\s*\(\s*['\"]|require\s*\(\s*['\"])(?:@adh-shared/|@/)"
)


def is_comment_line(line: str) -> bool:
    """A line whose CODE is a comment (a `//` line comment or a `/* … */` /
    JSDoc `*` continuation): example-import snippets in doc blocks are not real
    imports and must not trip the guard. A real import/require statement never
    starts with a comment marker, so skipping these cannot hide a violation."""
    stripped = line.lstrip()
    return stripped.startswith(("//", "*", "/*"))


def source_files() -> list[Path]:
    """Every `.ts`/`.tsx` file under a `src/` directory, pruning `node_modules`
    DURING traversal (in-place `dirnames[:]`) so it is never enumerated — rather
    than rglob-then-filter, which walks node_modules first."""
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d != "node_modules"]
        if "src" not in Path(dirpath).relative_to(ROOT).parts:
            continue
        for name in filenames:
            if name.endswith((".ts", ".tsx")):
                files.append(Path(dirpath) / name)
    return files


def main() -> int:
    offenders: list[str] = []
    checked = 0
    for path in source_files():
        checked += 1
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if is_comment_line(line):
                continue
            if BAD.search(line):
                offenders.append(f"{path.relative_to(ROOT.parent)}:{lineno}: {line.strip()}")
    if offenders:
        print("BOUNDARY VIOLATIONS (toolkit must not import consumer-repo code):")
        print("\n".join(offenders))
        return 1
    print(f"boundary check OK ({checked} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
