#!/usr/bin/env python3
"""Convert a LEGACY theme stylesheet into the full-palette form the site switcher needs.

## Why this exists

`src/styles/` holds two generations of theme.

The **legacy** generation (the site themes carried over from agentic-web-toolkit) declares
a ~13-token palette in two blocks — `:root` for light, `:root.dark` for the dark override —
and nothing else. That was the whole token vocabulary when they were authored.

The **full-palette** generation (signal, nord, gruvbox, …) declares the 49 literal M3
color roles that the current chrome actually reads (`--color-primary`, `--color-on-surface`,
`--color-surface-container-*`, …), in two blocks scoped `html:root` for dark and
`html:root[data-color-mode]:not(.dark)` for light.

A legacy theme therefore CANNOT be offered as a switcher theme as-is, and the failure is
silent rather than loud:

  * `adh.css` (always on, `:root`) defines the legacy names as compat aliases of the roles
    — `--color-text-primary: var(--color-on-surface)` and so on. A legacy theme overrides
    the ALIAS with a literal, so the role underneath keeps adh's value and every component
    that reads the role directly stays adh-coloured: a half-reskin, not a theme.
  * `html:root` (0-1-1) is what clears the base `:root` (0-1-0), and only
    `html:root[data-color-mode]:not(.dark)` (0-3-1) clears `color-mode-light.css`
    (`:root[data-color-mode]:not(.dark)`, 0-3-0). A theme at plain `:root` loses both.

This script rewrites the token blocks into that form. It touches ONLY the blocks — every
one of these themes keeps all its mode-dependent values in them, so the structural CSS
below (body / .prose / .persona-chat / …) is copied through byte-for-byte.

## The role recipe, and where it comes from

The 49 roles are derived from the theme's OWN palette. Nothing is invented per theme: the
recipe below was calibrated against the 14 hand-authored full-palette themes, which carry
both a palette and a role layer and so show how a good role layer sits relative to one.
For each role, an anchor pair was chosen for what the role MEANS, then the mix ratio fitted
across all 28 samples (14 themes x 2 modes) in OKLab. Over half the roles came out as exact
identities (`--color-outline` IS the palette's `border`, unanimously); the mixes landed at a
median OKLab error of 0.016-0.066, i.e. at or near the ~0.02 just-noticeable difference.

Two deliberate departures from the raw fit, both noted at their entries: `warning-container`
follows the other containers instead of the fit's success-tinted anchor, and the six
`on-*-container` foregrounds use one uniform tint rule instead of three-tinted /
three-plain, because one rule is one piece of knowledge and both sit inside the same error
band.

AUTHORED VALUES ALWAYS WIN. The recipe only fills what the theme never declared, so a
theme's own palette, chat (`--pc-*`) and font tokens survive verbatim and stay hand-editable
afterwards. This is a ONE-SHOT conversion, not a build step — the rewritten CSS is the
source of truth from here on, and the script refuses a file it has already converted.

Usage:
    python3 scripts/convert-legacy-theme.py src/styles/terminal.css [...]
    python3 scripts/convert-legacy-theme.py --check src/styles/*.css   # report, write nothing
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------- colour

Rgb = tuple[float, float, float]
Rgba = tuple[float, float, float, float]
Lab = tuple[float, float, float]


def parse_rgba(value: str) -> Rgba | None:
    """sRGB 0..1 + alpha from #rgb / #rrggbb / #rrggbbaa / rgb() / rgba(). None for any
    other form (var(), colour functions, keywords) — those are passed through untouched
    rather than guessed at."""
    v = value.strip()
    if m := re.fullmatch(r"#([0-9a-fA-F]{3,8})", v):
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        if len(h) not in (6, 8):
            return None
        ch = [int(h[i : i + 2], 16) / 255 for i in range(0, len(h), 2)]
        return (ch[0], ch[1], ch[2], ch[3] if len(ch) == 4 else 1.0)
    if m := re.fullmatch(r"rgba?\(([^)]*)\)", v):
        parts = [p for p in re.split(r"[,\s/]+", m.group(1).strip()) if p]
        if len(parts) not in (3, 4):
            return None
        try:
            n = [float(p[:-1]) / 100 if p.endswith("%") else float(p) for p in parts]
        except ValueError:
            return None
        a = n[3] if len(parts) == 4 else 1.0
        return (n[0] / 255, n[1] / 255, n[2] / 255, a)
    return None


def parse_color(value: str) -> Rgb | None:
    """Opaque sRGB only. None when the value carries alpha, so callers that need a solid
    colour must go through `over()` and say what it composites onto."""
    c = parse_rgba(value)
    return None if c is None or c[3] < 1.0 else c[:3]


def over(value: str, backdrop: Rgb) -> Rgb | None:
    """`value` composited onto an opaque `backdrop` — the colour it actually RENDERS as.
    A theme that writes `rgba(0, 255, 65, 0.35)` for its border means "35% green over the
    page", so this is the right input to any mix, and the right value for a role that has
    to be a solid (a menu can't be see-through). Returns `value` unchanged when already
    opaque, None when it isn't a colour at all."""
    c = parse_rgba(value)
    if c is None:
        return None
    r, g, b, a = c
    return (
        r * a + backdrop[0] * (1 - a),
        g * a + backdrop[1] * (1 - a),
        b * a + backdrop[2] * (1 - a),
    )


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(c: float) -> float:
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def to_oklab(rgb: Rgb) -> Lab:
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (v ** (1 / 3) if v > 0 else -((-v) ** (1 / 3)) for v in (l, m, s))
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def from_oklab(lab: Lab) -> Rgb:
    L, a, b = lab
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = (v**3 for v in (l_, m_, s_))
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(min(1.0, max(0.0, _linear_to_srgb(c))) for c in (r, g, bb))  # type: ignore[return-value]


def to_hex(rgb: Rgb) -> str:
    return "#" + "".join(f"{round(c * 255):02x}" for c in rgb)


def mix(a: Rgb, b: Rgb, t: float) -> str:
    """`a` and `b` interpolated in OKLab at `t` (0 = a, 1 = b), as #rrggbb. OKLab because
    sRGB interpolation darkens and hue-shifts through the midpoint; OKLab keeps the
    perceived lightness ramp even, which is what makes a 0.18 tint read as a 0.18 tint."""
    la, lb = to_oklab(a), to_oklab(b)
    return to_hex(from_oklab(tuple(x + t * (y - x) for x, y in zip(la, lb))))  # type: ignore[arg-type]


# ---------------------------------------------------------------------------- recipe

# The palette a legacy theme authors, and the only input the recipe may read.
CORE = (
    "--color-surface",
    "--color-surface-raised",
    "--color-surface-hover",
    "--color-border",
    "--color-border-subtle",
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-dim",
    "--color-accent",
    "--color-accent-dim",
    "--color-success",
    "--color-error",
    "--color-info",
)

# `@bg` is the theme's EFFECTIVE background: `--color-surface` when that is opaque, else the
# first opaque surface below it. Two themes (green-matrix-glass, old-school-terminal) set
# `--color-surface: transparent` on purpose so the page floats over olylo's matrix rain —
# taken literally that would make every `on-*` foreground invisible and every surface shade
# see-through. `@bg` is what those roles need; `--color-surface` itself stays as authored,
# so the float-over-rain effect survives while menus and text stay solid.
BG = "@bg"

# role -> ("=", anchor) to take an anchor verbatim, ("over", anchor) to composite it onto
# @bg (for roles that must be solid), ("mix", a, b, t) to interpolate, or ("lit", value).
# Order is adh.css's own role order, so a converted file diffs cleanly against the
# reference themes.
RECIPE: dict[str, tuple] = {
    "--color-primary": ("=", "--color-accent"),
    # Every M3 "on-<X>" foreground is the background colour: unanimous across the reference
    # themes, and what adh.css itself does (on-primary IS its surface).
    "--color-on-primary": ("=", BG),
    "--color-primary-container": ("mix", BG, "--color-accent", 0.18),
    "--color-on-primary-container": ("mix", "--color-text-primary", "--color-accent", 0.18),
    "--color-inverse-primary": ("mix", "--color-text-primary", "--color-accent", 0.78),
    "--color-primary-bright": ("mix", "--color-text-primary", "--color-accent", 0.78),
    # Pass-through, not a mix: accent-dim is already the palette's translucent accent
    # (an rgba()), and the point of primary-dim is exactly that value.
    "--color-primary-dim": ("=", "--color-accent-dim"),
    "--color-secondary": ("=", "--color-text-secondary"),
    "--color-on-secondary": ("=", BG),
    "--color-secondary-container": ("over", "--color-surface-raised"),
    "--color-on-secondary-container": ("=", "--color-text-primary"),
    # No legacy palette has a third accent hue, so tertiary rides the informational blue —
    # the loosest fit in the set (worst case 0.33 OKLab on cobalt2, whose tertiary is its
    # own hue), and the only non-inventing choice available.
    "--color-tertiary": ("=", "--color-info"),
    "--color-on-tertiary": ("=", BG),
    "--color-tertiary-container": ("mix", BG, "--color-info", 0.18),
    "--color-on-tertiary-container": ("mix", "--color-text-primary", "--color-info", 0.18),
    "--color-error": ("=", "--color-error"),
    "--color-on-error": ("=", BG),
    "--color-error-container": ("mix", BG, "--color-error", 0.18),
    "--color-on-error-container": ("mix", "--color-text-primary", "--color-error", 0.18),
    "--color-surface": ("=", BG),
    # surface-dim and container-lowest sit BELOW surface, and a legacy palette holds
    # nothing darker than surface to mix toward. The reference themes mostly collapse them
    # onto surface too (t=0 in 19-20 of 28 samples), so they collapse here rather than
    # inventing a shade. Cards keep their edge from outline, not from these.
    "--color-surface-dim": ("=", BG),
    "--color-surface-bright": ("over", "--color-border"),
    "--color-surface-container-lowest": ("=", BG),
    "--color-surface-container-low": ("mix", BG, "--color-surface-raised", 0.51),
    "--color-surface-container": ("over", "--color-surface-raised"),
    "--color-surface-container-high": ("over", "--color-surface-hover"),
    "--color-surface-container-highest": ("mix", "--color-surface-hover", "--color-border", 0.77),
    "--color-on-surface": ("=", "--color-text-primary"),
    "--color-on-surface-variant": ("=", "--color-text-secondary"),
    "--color-text-dim": ("=", "--color-text-dim"),
    "--color-outline": ("=", "--color-border"),
    "--color-outline-variant": ("=", "--color-border-subtle"),
    "--color-outline-strong": ("mix", "--color-border", "--color-text-primary", 0.37),
    "--color-inverse-surface": ("=", "--color-text-primary"),
    "--color-inverse-on-surface": ("=", BG),
    # A scrim is a dark overlay and a shadow is cast light in BOTH modes — adh.css uses
    # black for both and color-mode-light.css does not override them.
    "--color-scrim": ("lit", "#000000"),
    "--color-shadow": ("lit", "#000000"),
    "--color-success": ("=", "--color-success"),
    "--color-on-success": ("=", BG),
    "--color-success-container": ("mix", BG, "--color-success", 0.18),
    "--color-on-success-container": ("mix", "--color-text-primary", "--color-success", 0.18),
    # No legacy palette has a warning hue either. Mixing the theme's own green and red
    # lands between them, which is where the reference themes put warning as well.
    "--color-warning": ("mix", "--color-success", "--color-error", 0.46),
    "--color-on-warning": ("=", BG),
    # Departure from the raw fit (which read this as surface tinted toward SUCCESS, an
    # artefact of warning not being an anchor): it follows its own hue at the same ratio as
    # every other container.
    "--color-warning-container": ("mix", BG, "--color-warning", 0.18),
    "--color-on-warning-container": ("mix", "--color-text-primary", "--color-warning", 0.18),
    "--color-info": ("=", "--color-info"),
    "--color-on-info": ("=", BG),
    "--color-info-container": ("mix", BG, "--color-info", 0.18),
    "--color-on-info-container": ("mix", "--color-text-primary", "--color-info", 0.18),
}

# The compat aliases adh.css defines as var() of a role. Restating them as var() of the
# role keeps ONE authoritative value per colour: edit the role, both names follow.
ALIASES: dict[str, str] = {
    "--color-surface-raised": "--color-surface-container",
    "--color-surface-hover": "--color-surface-container-high",
    "--color-border": "--color-outline",
    "--color-border-subtle": "--color-outline-variant",
    "--color-border-strong": "--color-outline-strong",
    "--color-text-primary": "--color-on-surface",
    "--color-text-secondary": "--color-on-surface-variant",
    "--color-accent": "--color-primary",
    "--color-accent-bright": "--color-primary-bright",
    "--color-accent-dim": "--color-primary-dim",
    "--color-link": "--color-primary",
    "--color-link-hover": "--color-primary-bright",
    "--color-surface-tint": "--color-primary",
    # The settings topic rail. adh.css leaves it to the Tailwind @theme literal in dark,
    # but color-mode-light.css pins a warm cream at 0-3-0 — so a theme that stays silent
    # keeps a cream rail in light mode no matter its palette. A raised surface is what the
    # rail is. (Only 3 of the 14 reference themes set it, too few to calibrate against.)
    "--color-apt-nav": "--color-surface-container-high",
}

DARK_SELECTOR = "html:root"
LIGHT_SELECTOR = "html:root[data-color-mode]:not(.dark)"


# ---------------------------------------------------------------------------- parsing

Decls = list[tuple[str, str]]


def find_block(css: str, selector: str) -> tuple[int, int, Decls] | None:
    """(start, end, declarations) for a top-level `<selector> { ... }`, or None."""
    m = re.search(r"^" + re.escape(selector) + r"\s*\{(.*?)^\}\n?", css, re.S | re.M)
    if not m:
        return None
    decls = [
        (k, v.strip()) for k, v in re.findall(r"(--[a-z0-9-]+)\s*:\s*([^;]+);", m.group(1))
    ]
    return m.start(), m.end(), decls


def resolve(palette: dict[str, str]) -> dict[str, str]:
    """Flatten var() chains so the recipe reads literals."""
    out = dict(palette)
    for _ in range(8):
        changed = False
        for k, v in list(out.items()):
            if m := re.fullmatch(r"var\(\s*(--[a-z0-9-]+)\s*\)", v.strip()):
                src = out.get(m.group(1))
                if src and src.strip() != v.strip():
                    out[k], changed = src.strip(), True
        if not changed:
            break
    return out


SURFACE_FALLBACKS = ("--color-surface", "--color-surface-raised", "--color-surface-hover")


def backdrop_of(p: dict[str, str]) -> Rgb | None:
    """The theme's effective background — see BG. The deepest surface that is actually
    opaque, since that is what a translucent theme visibly sits on."""
    for k in SURFACE_FALLBACKS:
        if (c := parse_color(p.get(k, ""))) is not None:
            return c
    return None


def derive(palette: dict[str, str]) -> tuple[dict[str, str], list[str]]:
    """The 49 M3 roles for one mode. Returns (roles, warnings)."""
    p = resolve(palette)
    roles: dict[str, str] = {}
    warnings: list[str] = []

    bg = backdrop_of(p)
    if bg is None:
        return {}, [
            "no opaque surface in the palette "
            f"({', '.join(SURFACE_FALLBACKS)}) — cannot derive any role"
        ]

    def anchor(key: str) -> str | None:
        """An anchor's raw CSS value. `@bg` is the effective background; a derived role is
        allowed as an anchor (warning-container follows warning), so roles settled earlier
        in the recipe are in scope too."""
        if key == BG:
            return to_hex(bg)
        return p.get(key, roles.get(key))

    def solid(key: str) -> Rgb | None:
        """An anchor as a solid colour: composited onto the background when it carries
        alpha, since that is the colour it renders as and the only sane mix input."""
        v = anchor(key)
        return None if v is None else over(v, bg)

    for role, rule in RECIPE.items():
        if rule[0] == "lit":
            roles[role] = rule[1]
        elif rule[0] == "=":
            # Verbatim, alpha included: a translucent `outline` is a deliberate look, and
            # a border is one of the few things that reads fine see-through.
            if (src := anchor(rule[1])) is None:
                warnings.append(f"{role}: palette has no {rule[1]}")
                continue
            roles[role] = src
        elif rule[0] == "over":
            if (c := solid(rule[1])) is None:
                warnings.append(f"{role}: cannot make a solid from {rule[1]}")
                continue
            roles[role] = to_hex(c)
        else:
            _, ka, kb, t = rule
            a, b = solid(ka), solid(kb)
            if a is None or b is None:
                bad = ka if a is None else kb
                warnings.append(f"{role}: cannot mix — no usable {bad} ({anchor(bad)!r})")
                continue
            roles[role] = mix(a, b, t)
    return roles, warnings


def render_block(
    selector: str, scheme: str, note: str, authored: Decls, roles: dict[str, str]
) -> str:
    """One token block: the theme's own declarations first (its voice, untouched), then the
    derived role layer and the aliases it never declared."""
    lines = [f"{selector} {{", f"  color-scheme: {scheme};"]
    if note:
        lines.append(f"  /* {note} */")
    if authored:
        lines.append("")
        lines.append("  /* --- The theme's own tokens, as authored. --- */")
        for k, v in authored:
            lines.append(f"  {k}: {v};")
    written = {k for k, _ in authored}
    derived = [(k, v) for k, v in roles.items() if k not in written]
    if derived:
        lines.append("")
        lines.append("  /* --- M3 colour roles, derived from the palette above by")
        lines.append("     scripts/convert-legacy-theme.py. Hand-editable from here on. --- */")
        for k, v in derived:
            lines.append(f"  {k}: {v};")
    aliases = [(k, t) for k, t in ALIASES.items() if k not in written and t in roles]
    if aliases:
        lines.append("")
        lines.append("  /* --- Compat aliases: one authoritative value per colour. --- */")
        for k, target in aliases:
            lines.append(f"  {k}: var({target});")
    lines.append("}")
    return "\n".join(lines)


# Replaces the theme's own `/* === Tokens === */` banner, whose legacy wording ("light =
# default, dark = override") the conversion inverts into a lie. Worded to match the
# hand-authored full-palette themes, which carry the same explanation.
HEADER_NOTE = """/* === Tokens ===
 * Dark is the default (html:root); light overrides under
 * html:root[data-color-mode]:not(.dark) — matching the appearance system, whose pre-paint
 * stamps data-color-mode. The leading `html` type selector adds an element-column point so
 * BOTH blocks outrank the always-on adh base theme (:root, 0-1-0) AND color-mode-light
 * (:root[data-color-mode]:not(.dark), 0-3-0) regardless of stylesheet source order. BOTH
 * are load-bearing: drop the light block and light mode silently reverts to the base
 * palette, because 0-3-0 beats the dark block's 0-1-1.
 *
 * Converted from this theme's legacy `:root` / `:root.dark` token blocks by
 * scripts/convert-legacy-theme.py, which derived the M3 color roles from the palette below
 * — see that script for why a legacy theme cannot be switched to as-is, and for how each
 * role is derived. The conversion was ONE-SHOT: this file is hand-maintained from here on,
 * nothing regenerates it. */"""

# The banner being replaced, when the theme has one.
BANNER_RE = re.compile(r"/\* === Tokens\b.*?\*/\s*\n+", re.S)


def convert(path: Path, check: bool) -> int:
    css = path.read_text()
    if DARK_SELECTOR in css:
        print(f"{path.name}: already full-palette ({DARK_SELECTOR} present) — skipped")
        return 0

    light = find_block(css, ":root")
    if light is None:
        print(f"{path.name}: ERROR no `:root` block to convert", file=sys.stderr)
        return 1
    dark = find_block(css, ":root.dark")

    l_start, l_end, l_decls = light
    light_palette = dict(l_decls)
    if dark:
        d_start, d_end, d_decls = dark
        if d_start < l_end:
            print(f"{path.name}: ERROR `:root.dark` precedes `:root`", file=sys.stderr)
            return 1
        # The legacy dark block is an OVERRIDE of the light one, so the dark palette is the
        # merge — reading it alone would lose every token light declared and dark did not.
        dark_decls = [(k, dict(d_decls).get(k, v)) for k, v in l_decls]
        dark_decls += [(k, v) for k, v in d_decls if k not in light_palette]
        dark_note = ""
    else:
        # Dark-only aesthetic (phosphor-on-black and friends): its single block IS the dark
        # palette, and the light block repeats it so the theme holds its look in light mode
        # instead of half-reverting to the base.
        d_start = d_end = None
        dark_decls = list(l_decls)
        dark_note = "Dark-only aesthetic: the light block below repeats this palette."

    dark_roles, w1 = derive(dict(dark_decls))
    light_roles, w2 = derive(light_palette)
    for w in dict.fromkeys(w1 + w2):
        print(f"{path.name}: warning: {w}", file=sys.stderr)

    dark_block = render_block(DARK_SELECTOR, "dark", dark_note, dark_decls, dark_roles)
    light_scheme = "dark" if d_start is None else "light"
    light_note = (
        "Repeats the dark palette (see above)." if d_start is None else ""
    )
    light_block = render_block(
        LIGHT_SELECTOR, light_scheme, light_note, l_decls, light_roles
    )

    # Splice: header note + the two new blocks in place of the old ones, everything else
    # byte-for-byte. These themes keep every mode-dependent value in the token blocks, so
    # the structural CSS below needs no rewriting. The theme's own `=== Tokens ===` banner
    # goes with them — its legacy wording ("light = default") is the exact opposite of what
    # the file now does.
    head = css[:l_start]
    if m := BANNER_RE.search(head):
        if head[m.end() :].strip() == "":
            head = head[: m.start()]
    tail_start = d_end if d_end is not None else l_end
    out = (
        head
        + HEADER_NOTE
        + "\n\n"
        + dark_block
        + "\n\n"
        + light_block
        + "\n"
        + css[tail_start:]
    )

    if check:
        print(
            f"{path.name}: would convert "
            f"({len(l_decls)} light + {len(dark_decls)} dark authored, "
            f"{len(dark_roles)} roles derived)"
        )
        return 0
    path.write_text(out)
    print(
        f"{path.name}: converted "
        f"({len(l_decls)} light + {len(dark_decls)} dark authored, "
        f"{len(dark_roles)} roles derived)"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--check", action="store_true", help="report, write nothing")
    args = ap.parse_args()
    rc = 0
    for f in args.files:
        rc |= convert(f, args.check)
    return rc


if __name__ == "__main__":
    sys.exit(main())
