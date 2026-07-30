---
id: f3c25236-d72f-4a7b-839a-b7f335b3acd0
title: Button
domain: agenticdeveloperhub://recipes/button
type: ingredient
version: 1.1.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The family button — Base UI primitive with shadcn token variants and a pointer-driven pressed state, shared across every adh site."
platforms:
  - typescript
  - web
tags:
  - component
  - button
  - forms
  - ui
depends-on: []
related: []
references: []
---

# Button

## Overview

The shared `Button` in `@agentic-toolkit/ui` — a Base UI button primitive dressed in
the shadcn token vocabulary so the whole ~40-site platform renders one button.
It exposes seven visual `variant`s × a size scale, the standard disabled/focus/
invalid states, and a **pointer-driven pressed state** that reflects a real press
the way CSS `:active` cannot.

Two exports ship from `@agentic-toolkit/ui/components/button`:

- `buttonVariants` — the `cva` styling function. It MUST stay callable from
  server components (e.g. `<Link className={buttonVariants()}/>`), so `button.tsx`
  carries no `"use client"` directive.
- `Button` — a thin wrapper that computes the variant classes (server-safe) and
  renders the `"use client"` interactivity layer `PressableButton`
  (`button-pressable.tsx`), which owns the pointer/press hooks.

The pressed visual (a small downward dip plus a subtle darken) is driven by the
`data-pressed` attribute that `PressableButton` toggles, not by `:active` — so the
press correctly clears when the pointer leaves the button while it is still held.

## Behavioral Requirements

- **press-on-pointerdown-inside**: The button MUST set `data-pressed` when a pointer is pressed down inside it.
- **release-clears-pressed**: The button MUST clear `data-pressed` on `pointerup`.
- **cancel-clears-pressed**: The button MUST clear `data-pressed` on `pointercancel`.
- **leave-while-held-clears-pressed**: While the pointer is still held, the button MUST clear `data-pressed` when the pointer leaves it.
- **reenter-while-held-restores-pressed**: While the pointer is still held, the button MUST restore `data-pressed` if the pointer re-enters it.
- **release-outside-ends-hold**: The button MUST end the held state when the pointer is released or cancelled anywhere, including outside the button, so the press never sticks.
- **no-pointer-capture**: The button MUST track the press from held + pointer-inside state and MUST NOT call `setPointerCapture`.
- **pressed-visual-from-data-attr**: The button MUST express its pressed appearance (the translate-y dip plus darken) purely from `data-pressed`, never from CSS `:active`.
- **haspopup-suppresses-dip**: A button with `aria-haspopup` (a popup/menu trigger) MUST NOT apply the pressed dip.
- **keyboard-activates**: Space and Enter on a focused button MUST activate it (fire its click), independent of the pointer pressed visual.
- **forwards-consumer-pointer-handlers**: The button MUST still call any consumer-supplied pointer handler (e.g. `onPointerUp`) in addition to its own pressed tracking.
- **stable-public-api**: The button MUST keep its existing API — the `variant`/`size` props, the `buttonVariants` export, and `data-slot="button"` — unchanged.

## Appearance

```
┌──────────────────┐        ┌──────────────────┐
│   Button         │   →    │   Button         │  (held: dipped 1px + darkened)
└──────────────────┘        └──────────────────┘
       idle                       data-pressed
```

- Base: `inline-flex` centered, `rounded-lg`, `text-sm font-medium`, `transition-all`,
  `select-none`; focus-visible ring via the `ring`/`border-ring` tokens.
- Variants: `default` (`bg-primary`), `secondary`, `outline`, `ghost`,
  `destructive`, `destructive-ghost`, `link` — all expressed in shadcn theme
  tokens (the button's established vocabulary), never raw colors.
  `destructive-ghost` is a borderless destructive action
  (`text-destructive hover:bg-destructive/10`), used by `ButtonBar` /
  `DeleteEntitySection` / `ListWithDetailsPane`.
- Sizes: `xs`, `sm`, `default`, `lg`, plus `icon`/`icon-xs`/`icon-sm`/`icon-lg`.
- Pressed: `data-[pressed]:not-aria-[haspopup]:translate-y-px` plus
  `data-[pressed]:not-aria-[haspopup]:brightness-95`.
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Idle | the resting variant appearance |
| Hover | variant hover treatment (e.g. `hover:bg-primary-bright`) |
| Focus-visible | focus ring (`ring-3 ring-ring/50`, `border-ring`) |
| Pressed (pointer held inside) | `data-pressed` set → dips `translate-y-px` + `brightness-95` |
| Held but pointer left | `data-pressed` cleared → returns to the resting look while still armed |
| Disabled | `pointer-events-none`, `opacity-50` |
| Invalid (`aria-invalid`) | destructive border + ring |
| Popup trigger (`aria-haspopup`) | no pressed dip even while held |

## Accessibility

- Renders a real, focusable `<button>` (Base UI primitive); keyboard activation
  (Space/Enter) works natively and is independent of the pointer pressed visual.
- The pressed state is a purely visual affordance via `data-pressed`; it adds no
  ARIA semantics and never overrides `aria-pressed`/`aria-expanded` a consumer sets.
- Focus is shown with a visible `focus-visible` ring built from theme tokens.
- Disabled and invalid states map to `disabled`/`aria-invalid`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | press-on-pointerdown-inside | `pointerdown` on the button | `data-pressed` present |
| T2 | release-clears-pressed | `pointerdown` then `pointerup` | `data-pressed` absent |
| T3 | leave-while-held-clears-pressed | `pointerdown` then `pointerleave` | `data-pressed` absent |
| T4 | reenter-while-held-restores-pressed | after T3, `pointerenter` (still held) | `data-pressed` present |
| T5 | forwards-consumer-pointer-handlers | `pointerdown` with `onPointerDown` prop | consumer handler called once AND `data-pressed` present |
| T6 | release-outside-ends-hold | `pointerdown`, `pointerleave`, window `pointerup` | hold ends; a later `pointerenter` does NOT re-press |
| T7 | keyboard-activates (Playwright) | focus, press Enter/Space | click fires; no pointer dip |
| T8 | haspopup-suppresses-dip (Playwright) | `pointerdown` on `aria-haspopup` button | no `translate-y-px` dip |

## Edge Cases

- Release outside the button: a window `pointerup`/`pointercancel` listener
  (attached only while held) ends the hold, so the press never sticks after the
  pointer is released off the button.
- Popup/menu triggers (`aria-haspopup`) deliberately skip the dip so opening a
  menu doesn't look like a press.
- Keyboard activation never sets `data-pressed` — the pressed look is pointer-only.
- A consumer's own pointer handler is composed, not replaced.
- `disabled` buttons receive no pointer events (`pointer-events-none`), so they
  never enter the pressed state.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `variant` | `"default" \| "secondary" \| "outline" \| "ghost" \| "destructive" \| "destructive-ghost" \| "link"` | `"default"` | Visual style. |
| `size` | `"xs" \| "sm" \| "default" \| "lg" \| "icon" \| "icon-xs" \| "icon-sm" \| "icon-lg"` | `"default"` | Size/shape. |
| `className` | `string` | — | Extra classes merged via `cn()`. |
| `disabled` | `boolean` | `false` | Disables the button. |
| `...props` | `Base UI Button.Props` | — | All native button props (incl. `onClick`, pointer handlers, `aria-*`, `render`) are forwarded. |

`buttonVariants({ variant, size, className })` is also exported for styling a
non-button trigger (e.g. a `<Link>`); it stays server-callable.

## Logging

No logging. Button is a presentational primitive; click semantics and any
telemetry belong to the consumer's handler, not the button.

## Platform Notes

- Files: `websites/shared/ui/src/components/button.tsx` (variants + server-safe
  wrapper) and `websites/shared/ui/src/components/button-pressable.tsx` (the
  `"use client"` pressed-state layer).
- `button.tsx` intentionally has NO `"use client"` so `buttonVariants` stays
  callable from server components; the hooks live in `button-pressable.tsx`.
- Demo: `ui-showcase` Topic `button` (regenerate `sources.generated.ts` after
  source changes via `gen-sources.py`).
- Used across the platform (~40 sites) — additive changes only; never alter the API.

## Design Decisions

- **Split client boundary, keep `buttonVariants` server-safe.** The pressed state
  needs React hooks, but `buttonVariants` must remain a plain server-callable
  function. So the stateful interactivity lives in a sibling `"use client"`
  `PressableButton`, and `button.tsx` stays a non-client module that re-exports
  the variants and renders the client layer.
- **`data-pressed`, not `:active`.** CSS `:active` does not clear when the pointer
  leaves a held button, so it cannot express "released visual while still armed."
  Tracking held + pointer-inside in JS and reflecting it via `data-pressed` gives
  the precise behavior, and matches the `data-[pressed]` token pattern already
  used elsewhere in the library.
- **No `setPointerCapture`.** Capture would re-target subsequent pointer events to
  the button and defeat the leave/re-enter detection; tracking held state plus a
  window release listener is simpler and reversible.
- **Subtle, token-only press feedback.** The dip (`translate-y-px`) is kept and a
  `brightness-95` darken added — variant-agnostic and free of color literals, so
  it reads as pressed on every variant without per-variant color rules.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Keyboard operable + visible focus | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe; documents the pointer-driven pressed state added to the shared Button. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | Add the `destructive-ghost` variant (seven total) and fix the `default` hover to `hover:bg-primary-bright`, matching `button.tsx`. |
