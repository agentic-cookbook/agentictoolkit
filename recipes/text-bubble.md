---
id: 7f84a93a-013e-452f-a963-7ffb4808dd5c
title: TextBubble
domain: agenticdeveloperhub://recipes/text-bubble
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A decorative traveling-lens text effect: a lens sweeps the string, scaling/blurring the glyphs under it — plain, accessible text when inactive."
platforms:
- typescript
- web
tags:
- component
- animation
- text
- decorative
- ui
depends-on: []
related: []
references: []
---

# TextBubble

## Overview

`TextBubble` (`@adh-shared/ui`) renders a string and runs a purely **cosmetic**
traveling-"distortion lens" over it: a soft lens glides along the text in reading
order, and each glyph under the lens is magnified, faintly blurred, and
colour-shifted from `colorFrom` toward `colorTo`. When the lens reaches the end
it restarts at the beginning (a forward loop), optionally parking for `pauseMs`
between sweeps. Ported from the distortion bubble on mikefullerton.com; used by
the concept graph's founder note.

The effect is decoration only — the real text content stays intact and legible:

- The element renders `text` as plain content first (crawlable, accessible), and
  the lens only splits it into per-glyph spans **while `active`**.
- While animating, an off-screen copy of the full string is kept for assistive
  tech, and the visible per-glyph copy is marked `aria-hidden`.
- On cleanup (or `active === false`) the original plain text is restored.

Two symbols ship from `@adh-shared/ui/components/text-bubble`:

- `TextBubble` — the component: `<TextBubble text as className style {...options} />`.
- `useTextBubble(options)` — the underlying hook, returning a ref to attach to any
  real DOM element whose text the lens should ride over.

## Behavioral Requirements

- **must-render-plain-text**: The component MUST render its `text` as ordinary, selectable text content in the host element regardless of the effect.
- **must-be-decorative-when-inactive**: When `active` is false, the component MUST leave the text un-split and un-animated (plain).
- **must-animate-lens-when-active**: When `active` is true, the component MUST run a lens that sweeps the glyphs in reading order and restarts from the beginning (a forward loop).
- **must-scale-and-blur-under-lens**: The component MUST magnify (up to `1 + maxScale`) and blur (up to `maxBlur`) each glyph in proportion to its nearness to the lens centre, and MUST leave glyphs outside `radius` untouched.
- **must-color-shift-under-lens**: The component MUST shift each in-lens glyph's colour from `colorFrom` toward `colorTo` in proportion to its nearness to the lens centre.
- **must-preserve-accessible-text**: While animating, the component MUST keep the full string available to assistive technology and MUST mark the visible per-glyph copy `aria-hidden`.
- **must-restore-on-cleanup**: On unmount, on `active` becoming false, or on a `resetKey` change, the component MUST restore the element's original plain text.
- **must-follow-text-direction**: The lens MUST travel left-to-right for `ltr` elements and right-to-left for `rtl` elements, top line to bottom line.
- **must-skip-cursive-scripts**: For text containing cursive-joining scripts (Arabic, Syriac, Mongolian, N'Ko, Mandaic, Adlam), the component MUST leave the text rendered normally and MUST NOT split it into per-character spans.
- **must-not-break-words-at-wrap**: The component MUST only allow line breaks between words (never mid-word) when it splits the visible copy into glyphs.
- **must-remeasure-on-resize**: The component MUST re-measure glyph positions and re-read direction when the host element rewraps on resize.

## Appearance

A lens (influence radius `radius`, default 44px) travels the string; glyphs near
its centre bulge and soften:

```
The founder note text under the traveling lens
              ~~~( O )~~~
                  ^ glyphs here: scale↑, blur↑, color colorFrom→colorTo
   glyphs outside the radius: plain, untouched
```

- Nearness `t = smoothstep(1 − dist/radius)` drives all three effects together:
  `transform: scale(1 + t·maxScale)`, `filter: blur(t·maxBlur)` (dropped below
  ~0.03px), `color: color-mix(in oklab, colorFrom, colorTo t%)`.
- Only glyphs currently under the lens get `will-change` promoted; it is dropped
  as each glyph leaves the lens, so at most a handful are ever composited.
- Defaults are subtle by design: `maxScale 0.18`, `maxBlur 0.4px`, `radius 44px`,
  `msPerChar 48`, `minDuration 4500ms`, `pauseMs 0` (continuous loop). Colours
  default to `currentColor` on both ends (no colour shift unless overridden).
- No raw hex, no `!important`; colours come from the caller / `currentColor`.

## States

| State | Behavior |
|---|---|
| Inactive (`active === false`) | plain, un-split text; no animation |
| Active — idle hold | during the leading/`pauseMs` window each cycle, glyphs are cleared to plain |
| Active — sweeping | lens glides along glyph centres; in-lens glyphs scale/blur/shift |
| Loop restart | at the end of a sweep the lens returns to the start (after `pauseMs`) |
| Cursive script text | left rendered normally; effect disabled for that string |
| Empty / whitespace-only text | no spans built; nothing animates |
| Cleanup / `resetKey` change | original plain text restored; element remounted on `resetKey` |

## Accessibility

- The text content is real and remains available to assistive technology: while
  animating, an off-screen (visually clipped) span carries the full string, and
  the visible per-glyph copy is `aria-hidden`, so screen readers read the whole
  phrase, not a stream of single letters.
- When inactive the element is simply plain text — fully selectable and crawlable.
- The effect is decorative and never conveys information; disabling it (via
  `active={false}`) removes all motion while leaving the message intact. Hosts may
  gate `active` on `prefers-reduced-motion` if desired, though the effect is
  cosmetic either way.
- Cursive-joining scripts are deliberately left un-split so their letter shaping
  (which depends on joining) is not broken.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-plain-text + must-be-decorative-when-inactive | `active={false}` | host `textContent` equals `text`; no glyph spans |
| T2 | must-animate-lens-when-active | `active={true}`, wait a frame | host contains per-glyph `<span>`s with inline `transform` on some |
| T3 | must-scale-and-blur-under-lens (Playwright) | active, sample styles over frames | at least one glyph shows `scale(>1)` and a `blur()` filter near the lens |
| T4 | must-color-shift-under-lens | `colorFrom` ≠ `colorTo`, active | an in-lens glyph carries an inline `color: color-mix(...)` |
| T5 | must-preserve-accessible-text | active | an off-screen span holds the full string; the visible copy is `aria-hidden="true"` |
| T6 | must-restore-on-cleanup | active → `active={false}` (or unmount) | host `textContent` equals original `text`; no spans/inline transforms |
| T7 | must-skip-cursive-scripts | `text` = Arabic string, active | text unchanged; no per-character spans created |
| T8 | must-not-break-words-at-wrap | multi-word text, active | each word wrapped in an `inline-block; white-space:nowrap` span |
| T9 | must-follow-text-direction | `dir="rtl"` host, active | reading order sorts right-to-left within each line |
| T10 | must-remeasure-on-resize (Playwright) | active, resize host to rewrap | glyph centres re-measured; lens stays aligned |
| T11 | must-be-decorative-when-inactive | empty/whitespace `text` | no spans built; nothing animates |

## Edge Cases

- **Empty or whitespace-only text**: the hook bails early (nothing to split), so
  no spans and no animation.
- **Cursive-joining scripts**: detected via a Unicode script regex; the string is
  left rendered normally so joining/shaping isn't broken. Non-joining RTL scripts
  (e.g. Hebrew) still animate, right-to-left.
- **`resetKey` change**: `TextBubble` keys the element by `resetKey` (defaulting to
  `text`) so a text/version change remounts a fresh node instead of reconciling new
  text against imperatively-created spans (which would leave stale split text).
- **Host still animating in**: glyphs are measured in layout space
  (`offsetLeft/offsetTop`), which ignores an ancestor entrance/scale transform, so
  the lens doesn't desync from the glyphs during an entrance animation.
- **Word wrapping**: whole words are wrapped in `inline-block; nowrap` spans and the
  inter-word whitespace stays plain, so breaks only ever happen between words.
- **Compositor pressure**: `will-change` is set only on glyphs currently in the lens
  and cleared as they leave, so only a handful of glyphs are promoted at once.
- **`pauseMs > 0`**: the lens parks (text plain) for `pauseMs` before each sweep;
  the first park is the start delay, later parks are the between-loop pause.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | — (required) | The text the lens rides over. |
| `active` | `boolean` | — (required) | Run the lens; false keeps the plain, un-split text. |
| `as` | `keyof JSX.IntrinsicElements` | `"p"` | Element to render (must be a real DOM element). |
| `resetKey` | `string \| number` | the `text` | Re-split + re-measure (and remount) when it changes. |
| `colorFrom` | `string` | `"currentColor"` | Glyph colour at the lens edge. |
| `colorTo` | `string` | `"currentColor"` | Glyph colour at the lens centre (equal to `colorFrom` = no shift). |
| `radius` | `number` | `44` | Lens influence radius in px. |
| `maxScale` | `number` | `0.18` | Extra scale at the lens centre (1 → 1+maxScale). |
| `maxBlur` | `number` | `0.4` | Blur in px at the lens centre. |
| `msPerChar` | `number` | `48` | Travel speed: ms the lens spends per glyph. |
| `minDuration` | `number` | `4500` | Floor (ms) so short strings don't whip past. |
| `pauseMs` | `number` | `0` | Idle hold (ms) before each sweep; 0 = continuous loop. |
| `className` / `style` | `string` / `CSSProperties` | — | Passed to the rendered element. |

`useTextBubble<T>(options)` returns a `RefObject<T | null>` to attach to any real
DOM element; `TextBubble` is the ready-made wrapper around it.

## Logging

No logging. `TextBubble` is a purely cosmetic animation; it emits no events or
telemetry.

## Platform Notes

- File: `websites/shared/ui/src/components/text-bubble.tsx`.
- `"use client"` — it uses `useEffect`/`useRef`, `requestAnimationFrame`, and a
  `ResizeObserver`, all guarded for SSR (`typeof ResizeObserver`).
- Uses `color-mix(in oklab, …)` for the colour shift — a modern-CSS feature; older
  engines simply see the base colour.
- Demo: `ui-showcase` Topic `text-bubble` (regenerate `sources.generated.ts` via
  `gen-sources.py` after source changes). Used by the concept graph's founder note.
- No external dependencies beyond React.

## Design Decisions

- **Decorative first, always accessible.** The text renders plain (crawlable,
  selectable) and is only imperatively split while `active`; an off-screen full-text
  copy plus `aria-hidden` on the visible spans keeps screen readers reading the
  whole phrase, and cleanup restores the plain text. The effect never carries
  meaning, so turning it off loses nothing.
- **Lens glides along glyph centres.** Interpolating the lens centre along the
  polyline of glyph centres (in reading order) makes it follow the text and sweep to
  the next line at each wrap, rather than moving in raw screen space.
- **Layout-space measurement.** Measuring with `offsetLeft/offsetTop` (not
  `getBoundingClientRect`) ignores ancestor entrance transforms, so the lens stays
  aligned while the host animates in.
- **Split words, not bare characters.** Wrapping whole words in `inline-block; nowrap`
  spans (whitespace left plain) prevents mid-word line breaks that per-character
  splitting would otherwise allow.
- **Skip cursive scripts.** Per-character spans break cursive joining, so scripts
  that join (Arabic, Syriac, …) are left rendered normally rather than mis-shaped.
- **Cull + promote sparingly.** Glyphs beyond the (squared) radius are skipped
  without a `sqrt`, and `will-change` is toggled per-glyph so only in-lens glyphs are
  composited — keeping a long string cheap.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` (colours via caller/`currentColor`) | pass | project-guidelines UI |
| Real text preserved for assistive tech; decorative copy `aria-hidden` | pass | accessibility |
| SSR-safe (guards `ResizeObserver`; effect runs client-only) | pass | platform |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the decorative traveling-lens effect, its sweep params, and the preserved accessible text. |
