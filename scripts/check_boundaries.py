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


def repo_root_for(root: Path) -> "Path | None":
    """The repository root that `EXEMPT_FILES` keys are written relative to.

    The keys are repo-root-relative (`packages/web/packages/<pkg>/src/<file>`),
    and they have to mean the same thing no matter how deep `--root` points.
    Deriving them from `root.parent` did not: this repo's own lint passes the
    default `<repo>/packages` and got the right key, while adh's CI wrapper
    passes `<repo>/packages/web/packages` — two levels deeper — and every key
    lost its `packages/web/` prefix, so all fifteen entries read as stale and
    the guard returned 1 before reporting or suppressing anything.

    So walk UP from the scanned root to the checkout that contains it. `.git`
    is the marker: a directory in a normal clone, a file in a submodule
    checkout (which is how adh's CI sees this repo), and `Path.exists()`
    covers both. Returning None means "this tree is not in a checkout" — the
    caller turns that into exit 2, because a guard that cannot compute the key
    an exemption is written in cannot judge the exemption list either."""
    resolved = root.resolve()
    for candidate in (resolved, *resolved.parents):
        if (candidate / ".git").exists():
            return candidate
    return None


def package_prefix(repo_rel_path: str) -> "str | None":
    """The package a repo-relative scanned file belongs to, or None.

    `source_files` only ever yields paths under a package's `src/` or `dist/`,
    so the first such component is the package boundary:
    `packages/web/packages/features/teams/{src,dist}/…` -> `…/features/teams`.
    This is what lets ONE exemption cover a module in both trees."""
    parts = repo_rel_path.split("/")
    for i, part in enumerate(parts):
        if part in ("src", "dist"):
            return "/".join(parts[:i])
    return None


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


def accepted_specifiers(
    violations: "list[tuple[Path, int, str, str]]",
    exemptions: "frozenset[str]",
    key,
) -> "dict[str, set[str]]":
    """package -> the specifiers its EXEMPTED src files are allowed to import.

    An exemption names one `src/` module, but tsup externalises workspace
    dependencies, so the identical specifier survives verbatim into that
    package's bundled `dist/` — under a filename (`dist/index.js`) that no
    per-module exemption can name. Without this, `--include-dist` (the one flag
    adh's CI wrapper exists to pass) re-reported all fifteen already-accepted
    violations, and the only way out would have been writing the list twice.

    Deriving the accepted set from the exempted files themselves keeps one
    exemption meaning "this import is accepted for this module": a NEW
    specifier appearing in dist is still reported, because nothing in that
    package's exempted src accepts it."""
    accepted: dict[str, set[str]] = {}
    for path, _, spec, _ in violations:
        rel = key(path)
        if rel not in exemptions:
            continue
        pkg = package_prefix(rel)
        if pkg is not None:
            accepted.setdefault(pkg, set()).add(spec)
    return accepted


def is_exempt(rel: str, spec: str, exemptions: "frozenset[str]",
              accepted: "dict[str, set[str]]") -> bool:
    """Whether one violation is covered — directly, or as the dist echo of an
    exempted src module in the same package (see `accepted_specifiers`)."""
    if rel in exemptions:
        return True
    pkg = package_prefix(rel)
    if pkg is None or not rel.startswith(pkg + "/dist/"):
        return False
    return spec in accepted.get(pkg, ())


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
    ap.add_argument("--no-exempt", action="store_true",
                    help="suppress nothing: report every violation, including the "
                         "ones EXEMPT_FILES covers. This is how you re-derive the "
                         "exemption list instead of trusting it -- run it, and the "
                         "output should name exactly the paths that file lists")
    args = ap.parse_args(argv)
    if args.no_exempt:
        #  `--exempt` appends, so it cannot express the empty set: passing no
        #  flag means "use the defaults", and there is no value that means
        #  "use none". Without this flag the only way to see the unsuppressed
        #  list is to import find_violations() and call it by hand, which is
        #  what a reviewer had to do. An exemption list nobody can re-derive
        #  from the command line is a list you have to take on faith, and this
        #  guard exists precisely so that nothing here rests on faith.
        exemptions: "frozenset[str]" = frozenset()
    elif args.exempt is not None:
        exemptions = frozenset(args.exempt)
    else:
        exemptions = EXEMPT_FILES

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

    repo_root = repo_root_for(args.root)
    if repo_root is None:
        #  Without a checkout root there is no way to build the key an
        #  exemption is written in, so every entry would read as stale and the
        #  guard would blame the list for its own ignorance. Exit 2: could not
        #  check, not "clean" and not "violation".
        print(
            f"cannot locate the repository root above {args.root} (no .git in any "
            "parent) — EXEMPT_FILES keys are repo-root-relative and cannot be "
            "computed. Refusing to judge the exemption list.",
            file=sys.stderr,
        )
        return 2

    violations = find_violations(args.root, args.include_dist)

    def repo_rel(path: Path) -> str:
        """Path relative to the repo root, matching the form EXEMPT_FILES is
        written in — the same key whatever depth `--root` points at."""
        try:
            return path.resolve().relative_to(repo_root).as_posix()
        except ValueError:
            return path.as_posix()

    matched_paths = {repo_rel(path) for path, _, _, _ in violations}
    accepted = accepted_specifiers(violations, exemptions, repo_rel)
    suppressed = [v for v in violations if is_exempt(repo_rel(v[0]), v[2], exemptions, accepted)]
    reported = [v for v in violations if not is_exempt(repo_rel(v[0]), v[2], exemptions, accepted)]

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
            f"{exempt_file_count} file(s) covered by {len(exemptions)} exemption(s)"
        )
    print(f"boundary check OK ({len(source_files(args.root, args.include_dist))} files, "
          f"{len(vocab)} vocabulary packages banned to mechanism tier)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
