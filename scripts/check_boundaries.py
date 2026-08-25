#!/usr/bin/env python3
"""Toolkit boundary guard: toolkit packages are shared BETWEEN repos, so a
portable package may not import the adh VOCABULARY tier, and no package source
may import a consumer app's aliases (`@/...`).

## The rule

Two tiers, one direction:

  * MECHANISM — every package whose npm name is `@agentic-toolkit/<x>` for some
    `<x>` that is not `adh`/`adh-*`. Portable verbatim to another product.
  * VOCABULARY — `@agentic-toolkit/adh` and its `@agentic-toolkit/adh-*`
    siblings: adh's site registry, concept taxonomy, brand and legal copy.

Vocabulary may import mechanism. Mechanism may NEVER import vocabulary — that
import resolves fine inside adh's workspace and fails, or silently ships adh's
vocabulary, in any other consumer.

## Why the banned set is DISCOVERED, not listed

The predecessors of this guard hardcoded `@adh-shared/` and `@adh/`. Both
namespaces were folded into `@agentic-toolkit/adh*` on 2026-07-30, three days
after the guards were written. From that moment the guards walked the whole
tree, matched nothing that could exist, and printed "clean" unconditionally —
for months, while the drift they existed to catch accumulated. A guard that
cannot fail is worse than no guard, because it reads as coverage.

So the banned set is derived from the tree: any package whose `package.json`
name starts with `@agentic-toolkit/adh` IS the vocabulary tier, and is thereby
also what mechanism packages may not import. Add `adh-foo` tomorrow and it is
banned the same day, with no edit here. `check_boundaries_test.py` plants a
violation and asserts this script reports it — the property that a "clean"
result is meaningful.

(When the tiered directory layout lands, `_is_vocabulary` becomes "lives under
the vocabulary tier directory" and even the name convention stops mattering.)

## The one exemption

A vocabulary package importing its own tier is not a violation — having one is
the whole point of the tier. Nothing else is exempt. `site-templates/` used to
be: consumer-style scaffolding that was *supposed* to look like an app, so a
`@/` self-alias read as legitimate there. That lineage was deleted (`8e6c123`),
and the exemption went with it on the standing ground that every package under
`packages/` is library code, so neither a consumer alias nor another product's
vocabulary has any business in one.

Catches the ban in EVERY import form — `from '…'` (default/named import +
re-export), a side-effect `import '…'`, a dynamic `import('…')`, and a
`require('…')`. stdlib-only, Python-3.9-safe."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from boundary_exemptions import EXEMPT_FILES

DEFAULT_ROOT = Path(__file__).resolve().parent.parent / "packages"

#  The vocabulary tier's name prefix. `_is_vocabulary` compares on a name
#  BOUNDARY, never a bare prefix, so a future `@agentic-toolkit/adhesive` would
#  be mechanism — as it should be — rather than silently banned.
VOCAB_PREFIX = "@agentic-toolkit/adh"

# Any import/require form immediately followed by a quoted specifier. Group 1 is
# the specifier itself, so each match can be judged against the discovered
# vocabulary set and the `@/` rule:
#   from '…' / export … from '…'   default/named import + re-export
#   import '…'                      side-effect import (no binding)
#   import('…')                     dynamic import
#   require('…')                    CommonJS require
SPEC_RE = re.compile(
    r"(?:from\s+['\"]|import\s+['\"]|import\s*\(\s*['\"]|require\s*\(\s*['\"])"
    r"([^'\"]+)"
)

SRC_SUFFIXES = (".ts", ".tsx")
#  `dist` is scanned only under --include-dist, which adh's CI passes. The
#  toolkit COMMITS `adh/dist`, and every consumer's `import`/`types` export
#  conditions resolve straight to it — a repo that checks out the pin without
#  building never reads src/ at all. Skipping dist would exempt the only
#  artifact that actually ships from the one gate whose whole premise is "what
#  does a consumer resolve?": a stale or hand-added dist file carrying a
#  vocabulary specifier would pass here and ship. The toolkit's own `lint` skips
#  it because dist is gitignored there and rebuilt from the src this same run
#  already checked.
DIST_SUFFIXES = (".js", ".jsx", ".mjs")

PRUNE = {"node_modules", ".turbo", ".next", ".git"}


def _is_vocabulary(name: str) -> bool:
    """True for `@agentic-toolkit/adh` and `@agentic-toolkit/adh-*`, false for
    `@agentic-toolkit/adhesive`. Matching on a boundary rather than a bare
    prefix is what keeps the derived ban from over-reaching."""
    return name == VOCAB_PREFIX or name.startswith(VOCAB_PREFIX + "-")


def vocabulary_packages(root: Path) -> dict[str, Path]:
    """Discover the vocabulary tier: npm name -> package directory.

    Walks for `package.json` rather than globbing a fixed depth, so nesting a
    package one level deeper (as `features/*` already does) cannot hide it."""
    found: dict[str, Path] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in PRUNE and d != "dist"]
        if "package.json" not in filenames:
            continue
        try:
            name = json.loads((Path(dirpath) / "package.json").read_text()).get("name", "")
        except (ValueError, OSError):
            continue
        if _is_vocabulary(name):
            found[name] = Path(dirpath)
    return found


def imports_vocabulary(specifier: str, vocab: "dict[str, Path] | set" ) -> str | None:
    """The vocabulary package `specifier` reaches, or None.

    Compares on a package boundary — exact name, or name followed by `/` for a
    subpath export — so `@agentic-toolkit/adh-registry` is not matched by the
    `@agentic-toolkit/adh` entry, and neither is a same-prefix stranger."""
    for name in vocab:
        if specifier == name or specifier.startswith(name + "/"):
            return name
    return None


def is_comment_line(line: str) -> bool:
    """A line whose CODE is a comment (a `//` line comment or a `/* … */` /
    JSDoc `*` continuation): example-import snippets in doc blocks are not real
    imports and must not trip the guard — the toolkit's own JSDoc shows
    consumers importing packages by name, and a guard that matched those could
    never go green. A real import/require statement never starts with a comment
    marker, so skipping these cannot hide a violation. Only whole comment LINES
    are skipped, never a trailing comment after code: a guard that under-reports
    is worse than one that occasionally over-reports."""
    return line.lstrip().startswith(("//", "*", "/*"))


def source_files(root: Path, include_dist: bool = False) -> list[Path]:
    """Every source file under a `src/` directory (plus `dist/` when asked),
    pruning `node_modules` DURING traversal (in-place `dirnames[:]`) so it is
    never enumerated — rather than rglob-then-filter, which walks node_modules
    first."""
    suffixes = SRC_SUFFIXES + (DIST_SUFFIXES if include_dist else ())
    roots = {"src", "dist"} if include_dist else {"src"}
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in PRUNE]
        parts = Path(dirpath).relative_to(root).parts
        if not roots & set(parts):
            continue
        for name in filenames:
            if name.endswith(suffixes):
                files.append(Path(dirpath) / name)
    return sorted(files)  # stable CI output; os.walk order is filesystem order


def find_violations(root: Path, include_dist: bool = False) -> list[tuple[Path, int, str, str]]:
    """(path, lineno, specifier, why) for every boundary violation under root."""
    vocab = vocabulary_packages(root)
    exempt_dirs = list(vocab.values())
    violations: list[tuple[Path, int, str, str]] = []

    for path in source_files(root, include_dist):
        #  A vocabulary package importing its own tier is the whole point of the
        #  tier; only MECHANISM packages are constrained. This is the only
        #  exemption there is — see the module docstring.
        in_vocab = any(d == path.parent or d in path.parents for d in exempt_dirs)

        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for lineno, line in enumerate(lines, 1):
            if is_comment_line(line):
                continue
            for spec in SPEC_RE.findall(line):
                if spec.startswith("@/"):
                    violations.append((path, lineno, spec, "consumer-app self-alias"))
                    continue
                if in_vocab:
                    continue
                hit = imports_vocabulary(spec, vocab)
                if hit:
                    violations.append((path, lineno, spec, f"adh vocabulary tier ({hit})"))
    return violations


def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                    help="packages/ directory to scan (default: this toolkit's)")
    ap.add_argument("--include-dist", action="store_true",
                    help="also scan committed dist/ output (adh CI passes this)")
    ap.add_argument("--exempt", action="append", default=None,
                    help="repo-relative path exempted from the adh-vocabulary ban "
                         "(may repeat); defaults to boundary_exemptions.EXEMPT_FILES "
                         "when omitted, so a test can inject its own list")
    args = ap.parse_args(argv)
    exemptions = frozenset(args.exempt) if args.exempt is not None else EXEMPT_FILES

    if not args.root.is_dir():
        print(f"packages root not found: {args.root}", file=sys.stderr)
        return 2

    vocab = vocabulary_packages(args.root)
    if not vocab:
        #  A guard whose banned set is empty cannot fail. That is the exact
        #  failure this script was rewritten to end, so it is an error, not a
        #  pass: either the tree moved or the naming convention changed, and
        #  both need a human.
        print(
            f"no vocabulary-tier packages found under {args.root} — the guard would "
            f"scan {len(source_files(args.root, args.include_dist))} files and be "
            "incapable of reporting a violation. Refusing to report clean.",
            file=sys.stderr,
        )
        return 2

    violations = find_violations(args.root, args.include_dist)

    def repo_rel(path: Path) -> str:
        """Path relative to the repo root (the parent of the scanned packages/
        directory), matching the form EXEMPT_FILES is written in."""
        try:
            return path.relative_to(args.root.parent).as_posix()
        except ValueError:
            return path.as_posix()

    matched_paths = {repo_rel(path) for path, _, _, _ in violations}
    suppressed = [v for v in violations if repo_rel(v[0]) in exemptions]
    reported = [v for v in violations if repo_rel(v[0]) not in exemptions]

    #  An exemption that matches nothing is a stale entry — either the
    #  underlying violation was fixed (great: shrink the list) or the entry
    #  was typo'd/never real. Either way it is a lie the guard must not keep
    #  telling, so it fails loudly rather than silently forgiving a path that
    #  poses no risk.
    stale = sorted(exemptions - matched_paths)
    if stale:
        for path in stale:
            print(f"stale exemption: {path}", file=sys.stderr)
        return 1

    for path, lineno, spec, why in reported:
        print(f"{path}:{lineno}: imports {spec!r} — {why}", file=sys.stderr)
    if reported:
        print(
            f"\n{len(reported)} boundary violation(s). A portable "
            "@agentic-toolkit package must not import the adh vocabulary tier "
            f"({', '.join(sorted(vocab))}); inject the value through a seam instead.",
            file=sys.stderr,
        )
        return 1

    if suppressed:
        exempt_file_count = len({repo_rel(v[0]) for v in suppressed})
        print(
            f"check_boundaries: {len(suppressed)} violation(s) suppressed across "
            f"{exempt_file_count} exempt file(s)"
        )
    print(f"boundary check OK ({len(source_files(args.root, args.include_dist))} files, "
          f"{len(vocab)} vocabulary packages banned to mechanism tier)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
