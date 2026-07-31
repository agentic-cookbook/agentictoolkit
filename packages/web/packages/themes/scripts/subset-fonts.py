#!/usr/bin/env python3
"""Regenerate the self-hosted Iosevka faces in `src/fonts/`.

The `adh` theme — the family default, and the one every production site ships —
dresses sans, serif AND mono in Iosevka. It used to reach for it at runtime:

    @import url('https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/400.css');

which is three problems wearing one hat. The `@import` is a THIRD-PARTY stylesheet
that has to be fetched and parsed before the browser can even discover the `.woff2`
it names, so the font is two chained round trips deep on a connection that has to be
opened from scratch. Those woff2 files are ~1 MB EACH (2.9 MB across the three faces)
because fontsource's "latin" subset trims the cmap but keeps all 29,912 glyphs — a
programming font's entire ligature and stylistic-alternate inventory for 5,706 mapped
characters. And they are served `font-display: swap`, so first paint is guaranteed to
happen in the fallback and every visitor watches the page re-flow when Iosevka lands.

The re-flow is not subtle, because Iosevka is monospace at a flat 0.5 em advance and
the fallbacks are not: `ui-monospace` is SF Mono at 0.618 em (macOS), so body text
arrives 24% wider than it ends up, and `--font-serif`'s `ui-serif`/Georgia fallback
is PROPORTIONAL, so display headings re-wrap entirely.

So the faces are subset here, committed, and served from the site's own origin: ~76 KB
a face instead of ~1 MB, 236 KB for all three instead of 2.9 MB. That plus a
same-origin `<link rel=preload>` is what makes the swap window short; the
metric-matched fallback below (see FALLBACKS) is what makes the swap itself invisible.

This script owns TWO outputs, both committed:

  - `src/fonts/*.woff2` — the subset faces.
  - `src/fonts/metrics.json` — Iosevka's measured metrics, the derived fallback
    overrides, and which faces are worth preloading. `scripts/build-tokens.mjs` reads
    it to emit the theme's `@font-face` block, and `AdhThemeStyle` reads it to emit the
    preloads, so no number here is retyped anywhere downstream.

Run after bumping IOSEVKA_VERSION, then `pnpm build:tokens` to fold the result into
`src/styles/adh.css`. Nothing runs this automatically: the outputs are committed, and a
font that silently re-subsets itself mid-build is a worse problem than a stale one.

    python3 scripts/subset-fonts.py && pnpm build:tokens

Requires `fonttools` and `brotli`; the script provisions its own venv under
`.venv-fonts/` so it needs nothing installed globally.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

IOSEVKA_VERSION = "5.2.5"
CDN = f"https://cdn.jsdelivr.net/npm/@fontsource/iosevka@{IOSEVKA_VERSION}/files"

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
OUT_DIR = PKG / "src" / "fonts"
VENV = PKG / ".venv-fonts"

# upstream basename -> the name we serve it under (see adh.css's @font-face block).
FACES = {
    "iosevka-latin-400-normal": "iosevka-400",
    "iosevka-latin-400-italic": "iosevka-400-italic",
    "iosevka-latin-700-normal": "iosevka-700",
}

# WHOLE Unicode blocks, chosen by whether the family sets type in that block at all.
#
# The rule is deliberately coarse. Cherry-picking individual codepoints would save
# another ~40 KB a face, but it makes the coverage a hand-maintained list that silently
# rots: the day someone writes ⊕ in a recipe, that one character renders in a different
# typeface mid-sentence and nothing fails. Whole blocks make additions WITHIN a block
# free, so only a genuinely new kind of symbol can drift — and that is rare enough to
# notice.
#
# The census behind the choice is the consuming hub repo's
# `frontend/tools/scan-font-coverage.py`, which walks every source and content file
# under `frontend/src/` and counts non-ASCII codepoints by block. It lives there rather
# than here because the corpus is the hub family's, not this package's. Re-run it if the
# family starts setting type in something new; the usage counts below are from that scan
# (3,691 files, 250 distinct non-ASCII codepoints).
UNICODES = ",".join(
    [
        "U+0000-00FF",  # Basic Latin + Latin-1 Sup — ·, ×, «», §, µ, °, é    924 uses
        "U+0100-017F",  # Latin Extended-A — accented names                    18 uses
        "U+2000-206F",  # General Punctuation — the em dash, …, ’ ”        19,268 uses
        "U+20A0-20BF",  # currency — no use today, but a pricing page is one € away
        "U+2100-214F",  # letterlike — ™, №, ℹ; same argument as currency
        "U+2190-21FF",  # arrows — → alone is 2,221 of them               2,692 uses
        "U+2200-22FF",  # maths operators — ≤, ≥, −, ≈, ∈, ≠                 195 uses
        "U+2300-23FF",  # misc technical — ⌘, ⌃, ⌥: the keyboard hints        59 uses
        "U+2500-257F",  # box drawing — rules and pasted tree output      34,858 uses
        "U+2580-259F",  # block elements — ▓, █ in pasted bars               103 uses
        "U+25A0-25FF",  # geometric — ▸, ▼, ●, ◆                             237 uses
        "U+2600-26FF",  # misc symbols — ⚠, ☰, ⚙                              48 uses
        "U+2700-27BF",  # dingbats — ✕, ✓, ✗                                 256 uses
        "U+2800-28FF",  # Braille — the chat typing indicator ANIMATES through ⠋⠙⠹⠸…,
        #                 so a fallback here is not one odd glyph but a spinner that
        #                 changes typeface every frame. 572 bytes for all 256.
        "U+FB00-FB4F",  # alphabetic presentation forms — ﬁ, ﬂ
        "U+FEFF",  # BOM
        "U+FFFD",  # replacement character
    ]
)

# Blocks the scan found NO real use of, and what each would cost the regular face:
# Latin Ext-B +8.5 KB (0 uses), combining diacritics +8.2 KB (0), IPA +7.5 KB (0),
# spacing modifiers +5.4 KB (2), Greek +5.2 KB (3), Cyrillic +13.1 KB (54, all in one
# test fixture), super/subscripts +2.3 KB (0 — ² lives in Latin-1), number forms
# +2.4 KB (0), control pictures +2.5 KB (0), misc symbols & arrows +2.2 KB (12, and
# those are emoji-presentation characters that render from the system emoji font
# regardless). Emoji are absent for that last reason: no monospace text font carries
# colour emoji, so the 53 in the corpus have always come from the platform.

# `calt` is what draws Iosevka's programming ligatures (=>, !=, ->), which is most of
# the reason to pick Iosevka for a site about code. `liga`/`ccmp`/`locl`/`kern`/
# `mark`/`mkmk` are the correctness features — dropping them mis-composes accented
# glyphs. Everything ELSE (the stylistic sets, the ~24k alternate glyphs reachable
# only through `ss01`-`ss20`/`cv##`) is what takes the face from 43 KB to 119 KB, and
# nothing in the family selects any of them.
LAYOUT_FEATURES = "calt,liga,ccmp,locl,kern,mark,mkmk"

# ---------------------------------------------------------------------------
# The metric-matched fallback
# ---------------------------------------------------------------------------
#
# Subsetting shortens the swap window; it does not remove it. Something is painted
# before Iosevka arrives, and if that something has different metrics the page RE-FLOWS
# when it is replaced — which is the reported symptom ("the font changes size after an
# initial load"), and also, before the swap lands, the reason the type looks too big.
#
# The old stack made that as bad as it can get. `--font-sans: 'Iosevka', ui-monospace`
# falls back to SF Mono, whose advance is 0.618 em against Iosevka's 0.500 — so body
# text was painted 24% wider than it ends up. `--font-serif` was worse: it fell back to
# `ui-serif`/Georgia, a PROPORTIONAL face, so every display heading re-wrapped.
#
# The fix is a fallback `@font-face` that is the same width as Iosevka. This is the
# `size-adjust` recipe `next/font` uses, and it works unusually well here because BOTH
# fonts are monospaced: one advance width describes the whole face, so matching it
# matches every glyph exactly rather than on average. `sizeAdjust = 0.5 / fallbackAdv`;
# the ascent/descent/line-gap overrides are Iosevka's own metrics divided by that same
# factor, because `size-adjust` scales them afterwards.
#
# Two fallback families rather than one, because the real fonts cluster at two widths
# and each gets its exact value. They are STACKED (not two faces of one family): a
# family whose every `local()` misses is simply unavailable, so the stack falls through
# deterministically, whereas two same-named faces would depend on the UA's rules for a
# failed `local()`.
#
# Every advance below was measured from the font on disk (see `report_metrics`), except
# where noted. SF Mono is deliberately ABSENT: it is what `ui-monospace` resolves to on
# macOS, but Apple does not expose it to `local()`, so a face naming it would never
# match — Menlo is on every Mac and is 0.3% from Courier New.
FALLBACKS = [
    {
        "family": "Iosevka Fallback Menlo",
        # Menlo 1233/2048 (macOS). DejaVu Sans Mono is the Linux default and is
        # within 0.05% of it, so it rides in the same face rather than a third.
        "advance": 1233 / 2048,
        "locals": ["Menlo", "DejaVu Sans Mono"],
    },
    {
        "family": "Iosevka Fallback Courier",
        # Courier New 1229/2048 — the ONE monospace that ships on both macOS and
        # Windows with identical metrics, which is what makes Windows computable
        # without a Windows machine to measure on. Liberation Mono is its
        # metric-compatible clone and is bundled with most Linux distributions.
        "advance": 1229 / 2048,
        "locals": ["Courier New", "Liberation Mono"],
    },
]


def venv_python() -> Path:
    """Provision `.venv-fonts/` with the subsetter, and return its interpreter."""
    python = VENV / "bin" / "python"
    if not python.exists():
        print(f"subset-fonts: creating {VENV.relative_to(PKG)}")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
        subprocess.run(
            [str(python), "-m", "pip", "install", "--quiet", "fonttools", "brotli"],
            check=True,
        )
    return python


def fetch(name: str, dest: Path) -> None:
    url = f"{CDN}/{name}.woff2"
    print(f"subset-fonts: fetching {url}")
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 - pinned CDN
        dest.write_bytes(response.read())


def report_metrics(python: Path) -> dict:
    """Read Iosevka's own metrics back out of the subset and derive the fallback faces.

    Measured from the built file rather than written down, so the overrides cannot drift
    from the font they are matching: bump IOSEVKA_VERSION to a cut with a different
    advance width and these numbers follow it in the same run.
    """
    script = """
import json, sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1], lazy=True)
upm = font['head'].unitsPerEm
hhea = font['hhea']
advances = {font['hmtx'].metrics[font.getBestCmap()[c]][0] for c in (0x41, 0x69, 0x20)}
if len(advances) != 1:
    raise SystemExit(f'expected a monospaced face, got advances {sorted(advances)}')
json.dump({
    'unitsPerEm': upm,
    'advance': advances.pop() / upm,
    'ascent': hhea.ascent / upm,
    'descent': abs(hhea.descent) / upm,
    'lineGap': hhea.lineGap / upm,
}, sys.stdout)
"""
    out = subprocess.run(
        [str(python), "-c", script, str(OUT_DIR / "iosevka-400.woff2")],
        check=True,
        capture_output=True,
        text=True,
    )
    iosevka = json.loads(out.stdout)

    fallbacks = []
    for entry in FALLBACKS:
        size_adjust = iosevka["advance"] / entry["advance"]
        fallbacks.append(
            {
                "family": entry["family"],
                "locals": entry["locals"],
                # Rounded to 3 dp: the residual is under a thousandth of an em, which
                # is far below a device pixel at any font size the family sets.
                "sizeAdjust": round(size_adjust * 100, 3),
                "ascentOverride": round(iosevka["ascent"] / size_adjust * 100, 3),
                "descentOverride": round(iosevka["descent"] / size_adjust * 100, 3),
                "lineGapOverride": round(iosevka["lineGap"] / size_adjust * 100, 3),
            }
        )

    faces = [
        {"file": f"{served}.woff2", "weight": weight, "style": style, "preload": preload}
        for served, weight, style, preload in (
            ("iosevka-400", 400, "normal", True),
            ("iosevka-700", 700, "normal", True),
            # Italic is set only by `<em>` and the odd pull quote. It carries no page's
            # layout, so it is fetched on demand rather than competing with the two
            # faces that do.
            ("iosevka-400-italic", 400, "italic", False),
        )
    ]
    return {
        "_comment": (
            "AUTO-GENERATED by scripts/subset-fonts.py — do not edit. This file is the "
            "font manifest: scripts/build-tokens.mjs reads it to emit the adh theme's "
            "@font-face block, src/fonts.ts re-exports the preload list from it, and the "
            "hub's next-config-base.mjs reads publicPath to copy the woff2 into each "
            "site's public/. Three consumers, one fact each."
        ),
        "iosevkaVersion": IOSEVKA_VERSION,
        "family": "Iosevka",
        # Where the faces are SERVED from, as an absolute same-origin URL prefix. The
        # theme CSS is inlined into <head> as a string (see AdhThemeStyle), so a relative
        # `src:` would resolve against the PAGE url and break on every nested route — the
        # URL has to be absolute, which makes this prefix shared knowledge between the
        # CSS that references it, the preload that fetches it, and the build step that
        # puts the bytes there. It lives here so those three cannot disagree.
        "publicPath": "/fonts",
        "iosevka": iosevka,
        "faces": faces,
        "fallbacks": fallbacks,
    }


def main() -> int:
    python = venv_python()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    work = PKG / ".fonts-src"
    work.mkdir(exist_ok=True)

    for upstream, served in FACES.items():
        source = work / f"{upstream}.woff2"
        if not source.exists():
            fetch(upstream, source)
        target = OUT_DIR / f"{served}.woff2"
        subprocess.run(
            [
                str(python),
                "-m",
                "fontTools.subset",
                str(source),
                f"--output-file={target}",
                "--flavor=woff2",
                f"--unicodes={UNICODES}",
                f"--layout-features={LAYOUT_FEATURES}",
                # The name table is what `local()` in the metric-matched fallback would
                # match against, and what shows up in devtools; keep it legible.
                "--name-IDs=1,2,3,4,6",
                # Preserve the OS/2 + hhea metrics the fallback overrides in
                # `build-tokens.mjs` are computed from — a subsetter that recalculated
                # them would silently invalidate those numbers.
                "--no-prune-unicode-ranges",
            ],
            check=True,
        )
        before = source.stat().st_size
        after = target.stat().st_size
        print(
            f"subset-fonts: {served}.woff2  {before:,} -> {after:,} bytes "
            f"({before / after:.1f}x smaller)"
        )
    metrics = report_metrics(python)
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    for fallback in metrics["fallbacks"]:
        print(
            f"subset-fonts: fallback {fallback['family']:24} "
            f"size-adjust {fallback['sizeAdjust']}%  "
            f"asc/desc/gap {fallback['ascentOverride']}%/"
            f"{fallback['descentOverride']}%/{fallback['lineGapOverride']}%"
        )
    print(
        f"subset-fonts: wrote {len(FACES)} faces + metrics.json -> "
        f"{OUT_DIR.relative_to(PKG)}/  (run `pnpm build:tokens` to fold them into adh.css)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
