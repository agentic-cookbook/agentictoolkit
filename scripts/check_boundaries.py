#!/usr/bin/env python3
"""Toolkit boundary guard: toolkit packages are shared BETWEEN repos, so no
package source may import monorepo-internal code (@adh-shared/*) or a consumer
app's aliases (@/...). See the monorepo's docs/feature-platform.md."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "packages"
BAD = re.compile(r"""from\s+['"](@adh-shared/|@/)""")

def main() -> int:
    offenders: list[str] = []
    checked = 0
    for path in ROOT.rglob("src/**/*.ts*"):
        if "node_modules" in path.parts or path.suffix not in {".ts", ".tsx"}:
            continue
        checked += 1
        for lineno, line in enumerate(path.read_text().splitlines(), 1):
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
