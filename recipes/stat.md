---
id: bba42d5f-8a52-487f-88c5-4f988dfa714b
title: Stat
domain: agenticdeveloperhub://recipes/stat
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The dashboard figure — a micro uppercase-mono label with a big tone-tinted value, as a row (label left / value right) or a right-aligned column."
platforms:
- typescript
- web
tags:
- component
- stat
- dashboard
- display
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/stat-card
references: []
---

# Stat

## Overview

The stat family in `@agentic-toolkit/ui` renders one label/value figure in the shared
dashboard grammar: a micro **uppercase mono** caption paired with a big, bold, mono
**value** tinted by a status tone. Two exports ship the same grammar in two shapes:

- `StatRow` — label left, big value right on a shared baseline. The dashboard-card
  form (a stack of these fills an `InfoPanel`).
- `Stat` — the value stacked over its label, right-aligned. The hero-strip form.

Both take the same `StatProps` (`label`, `value`, `tone`, `valueClassName`,
`className`) and share one cva, `statValueVariants`, whose `tone` picks the value's
color from the family status tokens (`neutral`, `muted`, `accent`, `blue`, `orange`,
`success`, `error`). The type `StatTone` is also exported. The label always uses the
micro-caption treatment — smaller and dimmer than the form-field caption, because it
is a display label under/beside a figure, not a field name.

It is a pure presentational primitive: no `"use client"`, no state, no interactivity
— `label` and `value` are `ReactNode`, so the host supplies whatever content each
holds. Extracted from the status board so every site's dashboard figures share one look.

## Behavioral Requirements

- **renders-label-and-value**: The component MUST render both the `label` and the `value`.
- **tints-value-by-tone**: The component MUST color the value from the `tone`'s family status token — `neutral`→`text-apt-text`, `muted`→`text-apt-text-dim`, `accent`→`text-apt-gold`, `blue`→`text-apt-blue`, `orange`→`text-apt-orange`, `success`→`text-apt-green`, `error`→`text-apt-red`.
- **defaults-neutral-tone**: With no `tone`, the component MUST render the value in the neutral text token (`text-apt-text`).
- **value-class-overrides-tone**: The component MUST apply `valueClassName` to the value merged after (winning over) the tone class, so a caller MAY override the tone hue.
- **label-uses-micro-caption**: The component MUST render the label in the micro uppercase-mono caption treatment (small, letter-spaced, dimmed).
- **value-uses-figure-type**: The component MUST render the value in the big mono-bold figure treatment (`font-mono text-lg font-bold leading-none`).
- **row-lays-out-on-baseline**: `StatRow` MUST place the label at the left and the value at the right on a shared baseline (`items-baseline justify-between`).
- **column-right-aligns**: `Stat` MUST stack the value above the label, both right-aligned (`flex-col items-end`).
- **forwards-classname**: The component MUST merge a caller `className` onto the wrapper element.

## Appearance

`StatRow` (dashboard-card form):

```
UPTIME                              99.98%   ← success tint (text-apt-green)
BUILDS · 24H                            12   ← neutral (default)
FAILURES · 24H                           0   ← muted (text-apt-text-dim)
└ micro uppercase-mono label        └ big mono-bold value, right on the baseline
```

`Stat` (hero-strip form):

```
        99.98%     ← value on top, right-aligned, tinted
        UPTIME     ← micro label beneath
```

- Value: `statValueVariants` = `font-mono text-lg font-bold leading-none` + the tone
  color token; `valueClassName` merges after via `cn()`.
- Label: `font-mono text-[10px] uppercase tracking-[0.06em] text-apt-text-dim` — the
  display micro-caption, deliberately smaller/dimmer than the form-field caption.
- `StatRow` wrapper: `flex items-baseline justify-between gap-3`.
- `Stat` wrapper: `flex flex-col items-end gap-px`.
- Color comes entirely from `apt-*` tokens; no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| `neutral` (default) | value `text-apt-text` |
| `muted` | value `text-apt-text-dim` (de-emphasized figure) |
| `accent` | value `text-apt-gold` |
| `blue` | value `text-apt-blue` |
| `orange` | value `text-apt-orange` |
| `success` | value `text-apt-green` |
| `error` | value `text-apt-red` |
| `valueClassName` override | value hue replaced by the supplied class (wins over tone) |
| Row form (`StatRow`) | label left, value right, shared baseline |
| Column form (`Stat`) | value over label, right-aligned |

No interactive states — the primitive is not focusable, hoverable, or disable-able.

## Accessibility

- Both `label` and `value` render as plain text spans, so assistive tech announces
  them in DOM order: label-then-value for `StatRow`, and value-then-label for `Stat`
  (the value leads the column form visually and in the reading order).
- Tone is conveyed by color only — it carries no ARIA and adds no accessible name;
  the `label` is the sole textual meaning, so callers SHOULD keep the label
  descriptive (e.g. "failures · 24h") rather than leaning on the red tint alone.
- Purely presentational: no role, not focusable, not interactive.
- Color and contrast come from the `apt-*` theme tokens, consistent in light and dark.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | renders-label-and-value, tints-value-by-tone | `<StatRow label="uptime" value="99.9%" tone="success" />` | "uptime" and "99.9%" both present; value carries `text-apt-green` |
| T2 | defaults-neutral-tone, value-uses-figure-type | `<StatRow label="builds · 24h" value="12" />` | value "12" carries `text-apt-text` and the figure type `font-mono text-lg font-bold leading-none` |
| T3 | value-class-overrides-tone | `<StatRow label="env" value="PROD" tone="error" valueClassName="text-apt-blue" />` | value carries `text-apt-blue` and NOT `text-apt-red` |
| T4 | tints-value-by-tone, column-right-aligns | `<Stat label="failures · 24h" value="3" tone="error" />` | value "3" carries `text-apt-red`; label present; wrapper `flex-col items-end` |
| T5 | row-lays-out-on-baseline | `<StatRow label="x" value="1" />` | wrapper carries `items-baseline justify-between` |
| T6 | label-uses-micro-caption | any StatRow/Stat | label span carries `text-[10px] uppercase tracking-[0.06em] text-apt-text-dim` |
| T7 | forwards-classname | `<StatRow className="pt-1" .../>` | wrapper carries `pt-1` |
| T8 | renders-label-and-value | `label={<b>N</b>} value={0}` | node label rendered; value `0` rendered (not dropped) |

## Edge Cases

- `label` and `value` are `ReactNode`: a value of `0` renders as "0" (not treated as
  falsy/blank), and either slot MAY hold a fragment, number, or icon+text.
- `valueClassName` that sets a `text-*` color wins over the tone token (last class in
  the `cn()` merge); a class touching only non-color properties leaves the tone hue.
- An unknown/undefined `tone` falls back to the cva default (`neutral`).
- No truncation or wrapping is imposed — a very long value in `StatRow` competes with
  the label across `justify-between`; the host sizes the container.
- The two forms are separate exports on one grammar: pick `StatRow` inside cards,
  `Stat` for a right-aligned hero strip; there is no orientation prop.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `label` | `ReactNode` | — (required) | The micro uppercase-mono caption. |
| `value` | `ReactNode` | — (required) | The big mono-bold figure. |
| `tone` | `StatTone` | `neutral` | Value tint: `neutral`/`muted`/`accent`/`blue`/`orange`/`success`/`error`. |
| `valueClassName` | `string` | — | Extra classes for the value; merged after the tone class (escape hatch for categorical hues). |
| `className` | `string` | — | Extra classes for the wrapper; merged via `cn()`. |

Exports from `@agentic-toolkit/ui/components/stat`: `StatRow`, `Stat`, the `StatTone`
type, and the `StatProps` interface.

## Logging

No logging. `Stat`/`StatRow` are presentational primitives; the meaning of a figure
and any telemetry around it belong to the host, not the display element.

## Platform Notes

- File: `websites/shared/ui/src/components/stat.tsx`.
- No `"use client"` — it renders static spans with no state or effects, so it works
  in a server component.
- Styled with the family `apt-*` token utilities registered centrally via `@source`,
  so the tokens exist on every site without per-site config.
- Demo: `ui-showcase` Topic `stat` (group "Primitives — display"); regenerate
  `sources.generated.ts` via `gen-sources.py` after source changes.
- Web/TypeScript only; no SwiftUI/Compose counterpart.

## Design Decisions

- **Two forms, one grammar.** `StatRow` (baseline row) and `Stat` (right-aligned
  column) are separate exports sharing one `StatProps` + `statValueVariants`, so a
  dashboard card and a hero strip render the same figure look without a mode prop.
- **Tone as a bounded cva, `valueClassName` as the escape hatch.** The `tone` variant
  is limited to the seven family status tokens (the common, themable cases); a caller
  needing a categorical hue outside that set uses `valueClassName`, which merges after
  the tone class — avoiding a variant explosion.
- **A distinct micro-caption for the label.** The label class is intentionally smaller
  and dimmer than the form-field caption: this is a display label under/beside a
  figure, not a field name, so it reads as chrome around the number.
- **Big mono-bold value, `leading-none`.** The value uses monospace, bold, large,
  tight leading so columns of figures align and the number is the visual anchor.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` (uses `apt-*` tokens) | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Meaning carried by the text label, not tone color alone | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents StatRow/Stat, the tone grammar, and the label/value treatment. |
