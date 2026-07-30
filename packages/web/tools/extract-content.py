#!/usr/bin/env python3
"""Translation on-ramp for the concept content catalogs.

The copy lives in `packages/adh-site-config/content/<locale>.json`, flat-keyed
by node id — already the format a translator (or a TMS) wants. This helper manages
the locale lifecycle around it:

  extract-content.py new <locale>     scaffold content/<locale>.json, seeded from the
                                      default locale so every key is present with the
                                      English source as the starting text to translate.
  extract-content.py coverage         per-locale report: translated / total, the keys
                                      still missing, and the keys still identical to
                                      the default (likely untranslated).
  extract-content.py flatten <locale> emit a flat { "<id>.<field>": "text" } map on
                                      stdout for handoff to an external TMS.

After translating, register the locale in code (one edit): add it to the `Locale`
union in `packages/adh/src/concepts/types.ts` and to `catalogs` in
`packages/adh/src/concepts/content/index.ts`. Assembly falls back to the default
locale for anything a locale omits, and the sibling `validate-content.py` enforces
that a locale's keys are a subset of the default's. Wiring `getLocale()` (in
`packages/adh/src/concepts/assemble.ts`) to the request locale and adding `[locale]`
routing is the remaining, deferred step.

Lives at the WORKSPACE root's `tools/` for the same reason `validate-content.py`
does: it is workspace tooling over a sibling data package, not a published artifact
of it. The one path it needs is stated explicitly below rather than walked to.

Pure stdlib.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

DEFAULT_LOCALE = "en"
CONTENT = Path(__file__).resolve().parents[1] / "packages" / "adh-site-config" / "content"
LOCALE_RE = __import__("re").compile(r"^[a-z]{2}(-[a-z]{2})?$", __import__("re").IGNORECASE)

# Per-node fields that hold translatable text (mirrors NodeContent).
STRING_FIELDS = ("label", "kicker", "blurb")
LIST_FIELDS = ("keyPoints",)


def load(locale: str) -> dict[str, Any]:
    return json.loads((CONTENT / f"{locale}.json").read_text())


def dump(locale: str, data: dict[str, Any]) -> None:
    (CONTENT / f"{locale}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def locales() -> list[str]:
    """Concept locale catalogs only — `en.json`, `fr.json`, … and never the namespaced
    `<ns>.<locale>.json` copy (auth.en.json, help.en.json) that shares this directory.
    Locale slugs never contain a dot, which is the same discriminator
    `validate-content.py` uses; `cmd_new` enforces it on the way in via LOCALE_RE.
    Without this filter `coverage` reports every namespaced file as a 0%-translated
    locale, because none of them are keyed by concept id."""
    return sorted(p.stem for p in CONTENT.glob("*.json") if "." not in p.stem)


def cmd_new(locale: str) -> int:
    if not LOCALE_RE.match(locale):
        print(f"invalid locale slug: {locale!r}", file=sys.stderr)
        return 2
    if locale == DEFAULT_LOCALE:
        print(f"{DEFAULT_LOCALE} is the default locale (already the source)", file=sys.stderr)
        return 2
    dest = CONTENT / f"{locale}.json"
    if dest.exists():
        print(f"content/{locale}.json already exists — translate it in place", file=sys.stderr)
        return 1
    dump(locale, load(DEFAULT_LOCALE))  # seed with the English source to translate
    print(f"created content/{locale}.json seeded from {DEFAULT_LOCALE} ({len(load(locale))} nodes)")
    print(f"next: translate it, then register {locale!r} in types.ts + content/index.ts")
    return 0


def cmd_coverage() -> int:
    base = load(DEFAULT_LOCALE)
    base_keys = set(base)
    others = [l for l in locales() if l != DEFAULT_LOCALE]
    if not others:
        print(f"only the default locale ({DEFAULT_LOCALE}) exists — nothing to report")
        return 0
    for locale in others:
        data = load(locale)
        keys = set(data)
        missing = sorted(base_keys - keys)
        untranslated = sorted(
            k
            for k in keys & base_keys
            if isinstance(data[k], dict) and data[k].get("label") == base[k].get("label")
        )
        done = len(base_keys) - len(missing)
        pct = round(100 * done / max(1, len(base_keys)))
        print(f"[{locale}] {done}/{len(base_keys)} keys ({pct}%)")
        if missing:
            print(f"    missing: {', '.join(missing)}")
        if untranslated:
            print(f"    label still matches {DEFAULT_LOCALE}: {', '.join(untranslated)}")
    return 0


def cmd_flatten(locale: str) -> int:
    data = load(locale)
    flat: dict[str, str] = {}
    for nid, copy in data.items():
        for f in STRING_FIELDS:
            if copy.get(f):
                flat[f"{nid}.{f}"] = copy[f]
        for f in LIST_FIELDS:
            for i, item in enumerate(copy.get(f) or []):
                flat[f"{nid}.{f}.{i}"] = item
    json.dump(flat, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, *rest = argv
    if cmd == "new" and rest:
        return cmd_new(rest[0])
    if cmd == "coverage":
        return cmd_coverage()
    if cmd == "flatten" and rest:
        return cmd_flatten(rest[0])
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
