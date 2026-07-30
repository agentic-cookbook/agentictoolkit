#!/usr/bin/env python3
"""Validate the concept structure + content catalogs (the JSON source of truth).

Reads `packages/adh-site-config/structure.json` and
`packages/adh-site-config/content/<locale>.json` and fails fast on:

  - duplicate structure ids;
  - structure nodes carrying non-structure (copy) keys, or an invalid `kind`;
  - `related[]` ids that don't resolve to a structure node; empty `docs` slugs;
  - a missing default-locale catalog;
  - default-locale content missing for a structure id (or an empty label/blurb);
  - orphan content keys (a content id with no structure node);
  - content nodes carrying non-content keys;
  - a non-default locale whose keys aren't a subset of the default locale's.

Pure stdlib so it runs in prebuild/CI/Vercel without the JS toolchain. Exits 0 with
a one-line summary on success, or 1 with a bulleted report on stderr.

Checks that need the TS site registry (every `siteId` is a real site, and the
participating-sites set matches the tree) live in the vitest suite
(`packages/adh/src/__tests__/concepts.test.ts`), where the registry is importable.

Lives at the WORKSPACE root's `tools/`, not inside `packages/adh-site-config/`, because
it is a build/CI step of the whole web workspace rather than a published artifact of
that package — `packages/adh`'s `__tests__/content.test.ts` shells out to it from here,
and adh's `frontend/src/tools/build-site.py` runs it as a prebuild step across the
submodule boundary. The data it reads is a sibling package, so the path is an
explicit two-segment descent from the root, never a directory walk.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterator

DEFAULT_LOCALE = "en"
CONCEPTS = Path(__file__).resolve().parents[1] / "packages" / "adh-site-config"

STRUCTURE_KEYS = {"id", "siteId", "accent", "kind", "related", "docs", "children"}
CONTENT_KEYS = {"label", "kicker", "blurb", "detail", "keyPoints", "ctas"}
NODE_KINDS = {"root", "category", "site", "feature"}


def walk(node: dict[str, Any]) -> Iterator[dict[str, Any]]:
    yield node
    for child in node.get("children") or []:
        yield from walk(child)


def validate() -> list[str]:
    errors: list[str] = []

    structure = json.loads((CONCEPTS / "structure.json").read_text())
    nodes = list(walk(structure))
    ids = [n["id"] for n in nodes]
    id_set = set(ids)

    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        errors.append(f"duplicate structure ids: {', '.join(dupes)}")

    for n in nodes:
        extra = set(n) - STRUCTURE_KEYS
        if extra:
            errors.append(f"structure node {n['id']} has non-structure keys: {sorted(extra)}")
        kind = n.get("kind")
        if kind is not None and kind not in NODE_KINDS:
            errors.append(f"structure node {n['id']} has invalid kind: {kind!r}")
        for rid in n.get("related") or []:
            if rid not in id_set:
                errors.append(f"{n['id']} related -> unknown id {rid!r}")
        if "docs" in n and not str(n["docs"]).strip():
            errors.append(f"{n['id']} has an empty docs slug")

    content_dir = CONCEPTS / "content"
    # Concept locale catalogs are `<locale>.json` (en.json, fr.json, …). Other copy
    # co-located in this package — namespaced `<ns>.<locale>.json` files such as
    # auth.en.json (auth UI strings consumed via
    # @agentic-toolkit/adh-site-config/content) — are NOT concept content and must be
    # skipped. Locale codes never contain a dot.
    locale_files = sorted(p for p in content_dir.glob("*.json") if "." not in p.stem)
    locales = [p.stem for p in locale_files]
    if DEFAULT_LOCALE not in locales:
        errors.append(f"missing default locale content: content/{DEFAULT_LOCALE}.json")
        return errors

    default_keys: set[str] = set()
    for path in locale_files:
        locale = path.stem
        catalog = json.loads(path.read_text())
        keys = set(catalog)

        for cid in sorted(keys - id_set):
            errors.append(f"[{locale}] content key {cid!r} has no structure node")

        for cid, copy in catalog.items():
            extra = set(copy) - CONTENT_KEYS
            if extra:
                errors.append(f"[{locale}] content {cid} has non-content keys: {sorted(extra)}")
            if locale == DEFAULT_LOCALE:
                if not str(copy.get("label", "")).strip():
                    errors.append(f"[{locale}] content {cid} missing label")
                if not str(copy.get("blurb", "")).strip():
                    errors.append(f"[{locale}] content {cid} missing blurb")

        if locale == DEFAULT_LOCALE:
            default_keys = keys
            for cid in sorted(id_set - keys):
                errors.append(f"[{locale}] structure id {cid!r} has no content")

    for path in locale_files:
        if path.stem == DEFAULT_LOCALE:
            continue
        keys = set(json.loads(path.read_text()))
        for cid in sorted(keys - default_keys):
            errors.append(f"[{path.stem}] key {cid!r} not present in {DEFAULT_LOCALE}")

    return errors


def main() -> int:
    # A missing data dir must be an ERROR, never a silent pass. `glob` on a directory
    # that no longer exists yields nothing, so every "for each locale" check below
    # would vacuously succeed — exactly the way a stale path survives a move looking
    # green. This package has been relocated once already; pin the assumption.
    if not (CONCEPTS / "structure.json").is_file():
        print(f"content validation FAILED: no structure.json under {CONCEPTS}", file=sys.stderr)
        return 1
    errors = validate()
    if errors:
        print("content validation FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    structure = json.loads((CONCEPTS / "structure.json").read_text())
    count = len(list(walk(structure)))
    locales = sorted(p.stem for p in (CONCEPTS / "content").glob("*.json") if "." not in p.stem)
    print(f"content validation OK: {count} nodes, locales={locales}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
