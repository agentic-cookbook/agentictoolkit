---
id: b329d08b-9812-47d0-8094-516359d82d19
title: ExternalLink
domain: agenticdeveloperhub://recipes/external-link
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The “{label} ↗” deep link — always opens a new tab with noopener; default small-mono info-blue skin with a trailing ↗ glyph, dropped via glyph={false}."
platforms:
- typescript
- web
tags:
- component
- link
- navigation
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/stat-card
- agenticdeveloperhub://recipes/user-card
references: []
---

# ExternalLink

## Overview

The shared `ExternalLink` in `@adh-shared/ui` — the "{label} ↗" deep link out of
the app: an anchor that **always opens in a new tab** (`target="_blank"`) with
the safe `rel="noopener noreferrer"`, ending in a trailing ↗ arrow affordance.
Its default skin is the dashboard deep-link grammar — small, mono, info-blue,
`whitespace-nowrap` — the look used for "PostHog ↗" / "GlitchTip ↗" jump-outs to
external tools.

The component is deliberately thin: it spreads native anchor props
(`React.ComponentProps<"a">`), so `href`, `onClick`, `title`, `data-*` and the
rest pass straight through, and it merges an optional `className` via `cn()` for
restyling. Two consumption modes exist. **Default:** trailing glyph on, for a
standalone deep link. **`glyph={false}`:** drop the arrow when a *leading* icon
already carries the "external" meaning — UserCard's social links do this
(lucide `ExternalLink` icon + restyled to sans, muted text), and StatCard puts
the default-skin link in its header actions slot.

A single export ships from `@adh-shared/ui/components/external-link`: the
`ExternalLink` component. It is a stateless anchor with no `"use client"`
directive.

## Behavioral Requirements

- **opens-new-tab**: The component MUST set `target="_blank"` so the link opens in a new browsing context.
- **applies-safe-rel**: The component MUST set `rel="noopener noreferrer"` so the opened tab cannot access `window.opener` or leak a referrer.
- **renders-trailing-glyph-by-default**: With no `glyph` prop (default `true`), the component MUST render a trailing `↗` glyph after the children.
- **glyph-is-decorative**: The component MUST mark the `↗` glyph `aria-hidden="true"` so it is not read as part of the link's accessible name.
- **suppresses-glyph-when-false**: Given `glyph={false}`, the component MUST NOT render the `↗` glyph (so a leading icon can carry the affordance).
- **default-deep-link-skin**: The component MUST default to the deep-link grammar — inline-flex, `font-mono`, `text-[11px]`, `text-apt-blue`, no underline, `whitespace-nowrap`.
- **focus-ring**: The component MUST show a visible focus ring on keyboard focus (`focus-visible:ring-2 focus-visible:ring-apt-gold/40`).
- **merges-classname**: The component MUST merge any `className` after the base classes via `cn()`, so a consumer MAY restyle it (font, color, gap) without losing the new-tab/rel behavior.
- **forwards-anchor-props**: The component MUST forward native anchor props (`href`, `onClick`, `title`, `data-*`, …) onto the underlying `<a>`.

## Appearance

```
default            PostHog ↗          (mono · text-[11px] · apt-blue · trailing arrow)
glyph={false}      ⤴ GitHub           (leading lucide icon; no trailing arrow; restyled)
```

- Base: `inline-flex items-center gap-1 rounded-sm font-mono text-[11px]
  whitespace-nowrap text-apt-blue no-underline outline-none
  focus-visible:ring-2 focus-visible:ring-apt-gold/40`.
- Trailing glyph: a `<span aria-hidden="true">↗</span>` rendered only when
  `glyph` is truthy (default).
- Restyle path: `className` is `cn()`-merged last, so a consumer can override
  font (`font-sans`), size, color, and gap — e.g. UserCard's social links use
  `gap-1.5 font-sans text-sm text-apt-text-muted hover:text-apt-text`.
- Token-driven color (`apt-blue`, `apt-gold`); no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Default | Mono, `apt-blue`, no underline, trailing `↗` |
| `glyph={false}` | No trailing arrow (leading icon expected in children) |
| Focus (keyboard) | `apt-gold/40` focus ring via `focus-visible:ring-2` |
| Restyled (`className`) | Font/color/gap overridden; new-tab + `rel` unchanged |
| Hover | No built-in hover; consumers MAY add one (e.g. `hover:text-apt-text`) |

## Accessibility

- **Accessible name = children.** The link's name comes from its text content;
  the `↗` glyph is `aria-hidden`, so a link reading "PostHog ↗" is named
  "PostHog", not "PostHog up-right arrow".
- **Keyboard focus is visible.** `focus-visible:ring-2 ring-apt-gold/40` gives a
  clear focus indicator without a persistent outline on mouse click.
- **New-tab safety.** `rel="noopener noreferrer"` is always present, closing the
  reverse-tabnabbing hole that a bare `target="_blank"` would open.
- **Leading-icon mode.** In `glyph={false}` usage the visible icon is itself
  `aria-hidden`, and the visible label text (e.g. "GitHub") remains the
  accessible name — so dropping the trailing arrow never removes the link's name.
- The component does not auto-announce "opens in a new tab"; consumers for whom
  that matters SHOULD add it (e.g. via visually-hidden text) at the call site.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | opens-new-tab, applies-safe-rel | `<ExternalLink href="https://example.com">PostHog</ExternalLink>` | anchor has `target="_blank"` and `rel="noopener noreferrer"` |
| T2 | renders-trailing-glyph-by-default | same as T1 | link text content contains `↗` |
| T3 | glyph-is-decorative | same as T1 | accessible name is `PostHog` (matches `/PostHog/`), not including the arrow |
| T4 | suppresses-glyph-when-false | `<ExternalLink href="…" glyph={false}>GitHub</ExternalLink>` | link named `GitHub` has no `↗` text content |
| T5 | forwards-anchor-props | `href="https://us.posthog.com"` | anchor `href` equals `https://us.posthog.com` |
| T6 | merges-classname, default-deep-link-skin | `className="font-sans text-apt-text-muted"` | className contains both `font-sans`/`text-apt-text-muted` and the base `text-apt-blue`/`font-mono` |

## Edge Cases

- **Missing `href`.** `href` is a forwarded native prop, not required by the
  component; omitting it yields an anchor with no destination (the caller's
  responsibility), while `target`/`rel` are still applied.
- **Icon-plus-text without glyph.** With `glyph={false}` and both a leading icon
  and text as children, only the text contributes the accessible name (the icon
  is `aria-hidden` at the call site).
- **Long labels.** `whitespace-nowrap` keeps the "{label} ↗" pair on one line; a
  consumer that needs wrapping overrides it through `className`.
- **Internal links.** This is for *external* jump-outs; in-app navigation SHOULD
  use the app router link, not a new-tab anchor.
- **Overriding `target`/`rel`.** The safe defaults are set *before* `...props`
  spreads, so a consumer who explicitly passes `target`/`rel` can override them
  intentionally; standard usage passes neither and inherits the safe defaults.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `glyph` | `boolean` | `true` | Render the trailing `↗`. Set `false` when a leading icon carries the external affordance. |
| `children` | `ReactNode` | — | The visible label (and any leading icon); becomes the accessible name. |
| `className` | `string` | — | Extra classes merged after the base skin via `cn()` (restyle font/color/gap). |
| `...props` | `React.ComponentProps<"a">` | — | Native anchor props (`href`, `onClick`, `title`, `data-*`, …) forwarded onto the `<a>`. |

## Logging

No logging. `ExternalLink` is a presentational anchor; click tracking, if
wanted, belongs to the consumer via a forwarded `onClick` or an analytics wrapper
at the call site.

## Platform Notes

- File: `websites/shared/ui/src/components/external-link.tsx`.
- No `"use client"` — it is a stateless anchor; it renders in a server component.
- Consumed by `blocks/user-card.tsx` (social links, `glyph={false}` + lucide
  icon) and `blocks/stat-card.tsx` (header actions deep link, default skin).
- Demo: `ui-showcase` Topic `external-link` in the "Primitives — display" group
  (regenerate `sources.generated.ts` via `gen-sources.py` after source changes).
- Web/TypeScript only; token-driven so it themes with the rest of
  `@adh-shared/ui`.

## Design Decisions

- **Safe new-tab is not optional.** `target="_blank"` and
  `rel="noopener noreferrer"` are baked in rather than left to the caller, so
  every external jump-out is reverse-tabnabbing-safe by construction — the common
  mistake is centralised away.
- **One default skin, restyle by `className`.** The deep-link grammar (small mono
  info-blue) is the dominant use, so it is the default; anything else (UserCard's
  sans muted social links) is a `cn()`-merged override rather than a variant prop
  — keeping the component a thin anchor.
- **Glyph as a boolean, not a slot.** The trailing ↗ is the one affordance most
  links want, so it is on by default and dropped with a single `glyph={false}`
  when a *leading* icon already signals "external" — avoiding two arrows.
- **Decorative glyph.** The ↗ is `aria-hidden` so the accessible name stays the
  label; the arrow is a visual affordance, not content.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` (colors are `apt-*` tokens) | pass | project-guidelines UI |
| Components sourced from `@adh-shared` (no bespoke UI) | pass | project-guidelines UI |
| New-tab links carry `rel="noopener noreferrer"` | pass | security |
| Decorative glyph is `aria-hidden`; visible focus ring | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the safe-new-tab "{label} ↗" deep link and its glyph={false} mode. |
