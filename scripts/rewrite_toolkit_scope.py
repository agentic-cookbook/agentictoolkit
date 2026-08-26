#!/usr/bin/env python3
"""Rewrite the eight moved package names from the private scope to the public one.

Deliberately narrow: it rewrites a fixed list of eight names and refuses to touch
anything else, because a scope rename that guesses is a scope rename that silently
repoints a package which never moved.

Word-boundary anchored so `model` cannot match `modelling`.
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

MOVED = ("ui", "landing", "markdown", "search", "editing", "controls", "model", "themes")
OLD_SCOPE = "@agentic-toolkit"
NEW_SCOPE = "@agenticdevelopertoolkit"

SPEC_RE = re.compile(
    rf"{re.escape(OLD_SCOPE)}/({'|'.join(MOVED)})(?![a-z0-9-])"
)

SOURCE_SUFFIXES = {".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".css"}
SKIP_DIRS = {"node_modules", "dist", ".git", ".turbo", ".next"}


def candidate_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name == "package.json" or path.suffix in SOURCE_SUFFIXES:
            yield path


def rewrite_source(text: str) -> tuple[str, int]:
    new_text, count = SPEC_RE.subn(rf"{NEW_SCOPE}/\1", text)
    return new_text, count


def rewrite_manifest(text: str, manifest: Path, link_target: Path | None) -> tuple[str, int]:
    data = json.loads(text)
    count = 0
    for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        deps = data.get(field)
        if not isinstance(deps, dict):
            continue
        for name in list(deps):
            match = SPEC_RE.fullmatch(name)
            if not match:
                continue
            value = deps.pop(name)
            pkg = match.group(1)
            if link_target and isinstance(value, str) and value.startswith(("link:", "file:", "workspace:")):
                # `workspace:` becomes `link:`. A moved package is no longer a
                # member of THIS workspace, and pnpm cannot nest workspaces, so
                # `workspace:*` on a name that now lives in the vendored toolkit
                # is unresolvable — install fails naming the package, not the
                # cause. `link:` is the shape every already-crossed dependency
                # in this repo uses (see bitbag's and persona's manifests).
                prefix = value.split(":", 1)[0]
                if prefix == "workspace":
                    prefix = "link"
                # Computed per manifest, never a fixed string: a package at
                # packages/web/packages/<pkg> climbs four levels to reach the
                # submodule and one at packages/web/packages/features/<pkg>
                # climbs five, while adh's flat sites climb two. One shared
                # prefix is wrong for at least one of them by construction.
                rel = os.path.relpath(link_target / pkg, manifest.parent)
                value = f"{prefix}:{rel}"
            deps[f"{NEW_SCOPE}/{pkg}"] = value
            count += 1
    if count == 0:
        # Nothing structural changed; still rewrite any string mentions (comment: fields).
        return rewrite_source(text)
    return json.dumps(data, indent=2) + "\n", count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--link-target", type=Path, default=None,
                        help="path to the destination packages/ directory; each manifest's "
                             "own link:/file: value is computed relative to it")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.root.is_dir():
        print(f"error: root not found: {args.root}", file=sys.stderr)
        return 2

    changed = []
    total = 0
    for path in candidate_files(args.root):
        original = path.read_text(encoding="utf-8")
        if OLD_SCOPE not in original:
            continue
        try:
            if path.name == "package.json":
                link_target = args.link_target.resolve() if args.link_target else None
                updated, count = rewrite_manifest(original, path.resolve(), link_target)
            else:
                updated, count = rewrite_source(original)
        except json.JSONDecodeError as err:
            print(f"error: {path}: {err}", file=sys.stderr)
            return 2
        if count == 0 or updated == original:
            continue
        changed.append((path, count))
        total += count
        if not args.dry_run:
            path.write_text(updated, encoding="utf-8")

    for path, count in changed:
        print(f"{path}: {count}")
    verb = "would rewrite" if args.dry_run else "rewrote"
    print(json.dumps({"action": verb, "files": len(changed), "references": total}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
