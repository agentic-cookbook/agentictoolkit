#!/usr/bin/env python3
"""Assert that `'use client'` sits on the client entry and nowhere else.

Why this exists as a check rather than a comment: the package's client modules
live behind `src/client.ts`, but esbuild-plugin-preserve-directives propagates a
chunk's directive to every entry that imports it. When NavChrome was exported
from `src/index.ts`, `dist/index.js` itself began with
`'use client'` — turning the deck, the screen and all nineteen blocks into
Client Components. The page still rendered, `tsc` and ESLint were clean, the 37
vitest tests passed, and `next build` succeeded, because a Client Component is
a legal thing to be. Every signal a developer would normally trust said the
build was fine.

The only observable difference is the first line of a built file, so that is
what this asserts.

Run from the package root (the `build` script does):
    python3 tools/check-directives.py
"""
from __future__ import annotations

import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
DIST = PKG / "dist"
DIRECTIVE = "use client"

# entry -> whether dist/<entry>.js must carry the directive on its first line.
EXPECTED: dict[str, bool] = {
    "index": False,  # server-safe barrel: deck, screens, blocks
    "client": True,  # the drawer and the clip — everything that holds state
}


def first_directive(path: Path) -> str | None:
    """Return the leading directive of a built ESM file, if it has one."""
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        if len(line) > 1 and line[0] in "'\"":
            quote = line[0]
            end = line.find(quote, 1)
            if end != -1:
                return line[1:end]
        return None
    return None


def main() -> int:
    if not DIST.is_dir():
        sys.exit(f"dist/ is missing at {DIST} — run the build first.")

    failures: list[str] = []
    for entry, must_have in EXPECTED.items():
        built = DIST / f"{entry}.js"
        if not built.is_file():
            failures.append(f"{entry}.js was not built (expected at {built})")
            continue

        found = first_directive(built) == DIRECTIVE
        if found and not must_have:
            failures.append(
                f"dist/{entry}.js starts with '{DIRECTIVE}' and must not.\n"
                f"      Something re-exported a client module from src/{entry}.ts, so the\n"
                f"      directive was hoisted onto the whole bundle and every export in it\n"
                f"      is now a Client Component. Move that export to src/client.ts."
            )
        elif must_have and not found:
            failures.append(
                f"dist/{entry}.js does NOT start with '{DIRECTIVE}' and must.\n"
                f"      Without it React will not treat the drawer as a Client Component\n"
                f"      and its useState will fail in a server render."
            )

    # A directive anywhere else in dist/ means a chunk escaped both entries.
    for stray in sorted(DIST.glob("*.js")):
        if stray.stem in EXPECTED:
            continue
        if first_directive(stray) == DIRECTIVE:
            failures.append(
                f"dist/{stray.name} carries '{DIRECTIVE}' but is not a declared entry.\n"
                f"      A shared chunk picked up the directive; the two builds in\n"
                f"      tsup.config.ts are no longer independent."
            )

    if failures:
        print("directives: FAILED", file=sys.stderr)
        for f in failures:
            print(f"  ✗ {f}", file=sys.stderr)
        return 1

    # Spelled from EXPECTED rather than written out, so renaming an entry cannot
    # leave the success line naming one that no longer exists — which it did
    # once, still reading "chrome" a build after src/chrome.ts became client.ts.
    summary = ", ".join(
        f"{entry}.js {'has' if must_have else 'has no'} '{DIRECTIVE}'"
        for entry, must_have in EXPECTED.items()
    )
    print(f"directives: ok ({len(EXPECTED)} entries — {summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
