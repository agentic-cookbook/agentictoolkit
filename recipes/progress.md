---
id: b3a92adc-a28e-4a33-8120-c33f8f0abdf6
title: Progress
domain: agenticdeveloperhub://recipes/progress
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A determinate progress bar — an accessible track with a token-styled fill clamped to 0–100, tintable via indicatorClassName (amber building, green done)."
platforms:
- typescript
- web
tags:
- component
- progress
- feedback
- ui
depends-on: []
related: []
references: []
---

# Progress

## Overview

The shared `Progress` in `@agentic-toolkit/ui` — a determinate progress bar rendered as
a rounded track with an indicator filled to `value` (a percentage, 0–100). It is a
self-contained accessible element (`role="progressbar"` carrying
`aria-valuenow`/`aria-valuemin`/`aria-valuemax`) rather than a wrapper around a
primitive, so it needs no extra runtime dependency.

The fill is a full-width indicator translated horizontally so that a `value` of 0
hides it entirely (`translateX(-100%)`) and a `value` of 100 reveals it fully
(`translateX(0)`); the transform animates smoothly. The track uses the
`apt-surface-2` token and the fill defaults to `apt-gold`, but the fill is meant to
be re-tinted per context via `indicatorClassName` — e.g. amber while a job is
building, green once it completes.

A single export ships from `@agentic-toolkit/ui/components/progress`: the `Progress`
component. It carries `"use client"` (it renders an inline `style` transform) but
holds no internal state — `value` is fully controlled by the consumer.

## Behavioral Requirements

- **renders-progressbar-role**: The component MUST render an element with `role="progressbar"`.
- **reflects-value-in-valuenow**: The component MUST expose the current percentage as `aria-valuenow`, rounded to an integer.
- **fixed-value-bounds**: The component MUST report `aria-valuemin` as 0 and `aria-valuemax` as 100.
- **clamps-below-zero**: Given a `value` below 0, the component MUST clamp it to 0 and render an empty fill.
- **clamps-above-hundred**: Given a `value` above 100, the component MUST clamp it to 100 and render a full fill.
- **defaults-to-zero**: With no `value` prop, the component MUST render at 0 with an empty fill.
- **fill-tracks-value**: The component MUST size the visible fill proportionally to the clamped value, from empty at 0 to full at 100.
- **indicator-class-tints-fill**: The component MUST apply any `indicatorClassName` to the fill element so a consumer MAY override its color.
- **forwards-track-props**: The component MUST forward arbitrary props (`className`, `aria-label`, `id`, `data-*`) onto the track element.

## Appearance

```
value = 0        ├───────────────────────────────┤   (empty track)
value = 35       ██████████·······················    (gold fill, 35%)
value = 100      ███████████████████████████████     (full fill)
```

- Track: `relative h-2 w-full overflow-hidden rounded-full bg-apt-surface-2`; extra
  classes merge via `cn()` through `className`.
- Indicator: `h-full w-full rounded-full bg-apt-gold` with
  `transition-transform duration-300 ease-out`; positioned by an inline
  `transform: translateX(-{100 - pct}%)`.
- Fill color is token-based (`apt-gold` by default) and overridable through
  `indicatorClassName` (e.g. `bg-apt-green` for complete).
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Empty (`value` ≤ 0) | Indicator fully translated out (`translateX(-100%)`); `aria-valuenow` = 0 |
| Partial (0 < `value` < 100) | Indicator revealed proportionally; `aria-valuenow` = rounded value |
| Full (`value` ≥ 100) | Indicator fully revealed (`translateX(0)`); `aria-valuenow` = 100 |
| Transitioning | Fill animates between positions via `transition-transform` (300ms ease-out) |
| Tinted (`indicatorClassName`) | Fill color overridden (e.g. amber while building, green when done) |

## Accessibility

- Renders `role="progressbar"` with `aria-valuemin` 0, `aria-valuemax` 100, and
  `aria-valuenow` set to the rounded, clamped percentage — so assistive technology
  announces determinate progress.
- It is a determinate bar only; there is no indeterminate mode.
- The component carries no built-in visible or accessible label. Consumers SHOULD
  pass an `aria-label` (or `aria-labelledby`) — the demo labels each bar
  ("Build progress", "Complete") — since a progress bar with no name is ambiguous to AT.
- Purely presentational otherwise: not focusable and not interactive; progress is
  driven by the consumer's `value`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | renders-progressbar-role, fixed-value-bounds | render `<Progress value={35} />` | element has `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"` |
| T2 | reflects-value-in-valuenow, fill-tracks-value | `value={35}` | `aria-valuenow="35"`; indicator transform `translateX(-65%)` |
| T3 | defaults-to-zero | render `<Progress />` (no `value`) | `aria-valuenow="0"`; indicator transform `translateX(-100%)` |
| T4 | clamps-below-zero | `value={-40}` | `aria-valuenow="0"`; transform `translateX(-100%)` |
| T5 | clamps-above-hundred | `value={140}` | `aria-valuenow="100"`; transform `translateX(0%)` |
| T6 | reflects-value-in-valuenow | `value={35.6}` | `aria-valuenow="36"` (rounded) |
| T7 | indicator-class-tints-fill | `value={100} indicatorClassName="bg-apt-green"` | fill element carries `bg-apt-green` |
| T8 | forwards-track-props | `aria-label="Sync" id="p1"` | track element carries `aria-label="Sync"` and `id="p1"` |

## Edge Cases

- `value` below 0 or above 100 is clamped, never overflowing the track; `aria-valuenow`
  reflects the clamped value.
- Omitting `value` renders an empty (0%) bar rather than erroring.
- Fractional values are allowed for the fill width, but `aria-valuenow` is rounded to
  an integer, so `35.6` announces as `36`.
- There is no indeterminate state — a value is always supplied, defaulting to 0.
- `indicatorClassName` that also sets a background token overrides the default gold
  fill; a class that only tweaks other properties leaves the gold in place.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | `0` | Percentage complete, 0–100; clamped to that range. |
| `indicatorClassName` | `string` | — | Extra classes for the fill element (e.g. `bg-apt-green`); merged via `cn()`. |
| `className` | `string` | — | Extra classes for the track element; merged via `cn()`. |
| `...props` | `React.ComponentProps<"div">` | — | Any native div props (incl. `aria-label`, `id`, `data-*`) are forwarded onto the track. |

## Logging

No logging. `Progress` is a presentational primitive; the meaning of a value and any
telemetry around a job's progress belong to the consumer, not the bar.

## Platform Notes

- File: `websites/shared/ui/src/components/progress.tsx`.
- Carries `"use client"` because it renders an inline `style` transform, but holds no
  internal state — `value` is controlled by the consumer.
- Demo: `ui-showcase` Topic `progress` (regenerate `sources.generated.ts` after source
  changes via `gen-sources.py`).
- Web/TypeScript only; token-driven so it themes with the rest of `@agentic-toolkit/ui`.

## Design Decisions

- **Self-contained, no primitive dependency.** Rather than wrapping a headless
  progress primitive, the bar owns its own `role="progressbar"` + `aria-value*`
  attributes. Progress is simple enough that the ARIA is trivial, and avoiding an
  extra runtime dependency keeps the shared bundle lean.
- **Translate the fill, don't resize it.** The indicator is a full-width element
  moved with `translateX(-{100 - pct}%)` rather than a width animation, so the fill
  animates on the compositor (`transition-transform`) and stays crisp on its rounded ends.
- **Clamp defensively.** `value` is clamped to 0–100 in the component so an
  out-of-range value from a consumer can never overflow the track or produce a
  nonsensical `aria-valuenow`.
- **Tint via `indicatorClassName`, keep gold default.** The fill defaults to the
  family `apt-gold` token but exposes a dedicated class hook so context can recolor
  it (amber building → green done) without a variant explosion.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Determinate progress exposes `role=progressbar` + `aria-value*` | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the self-contained determinate Progress bar. |
