---
id: dffc1431-7386-4acf-94bc-6043c5c7eebc
title: ToggleGroup
domain: agenticdeveloperhub://recipes/toggle-group
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A segmented control — mutually-exclusive option buttons on the field shell, gold fill on the pressed item; single-select via value={[selected]}."
platforms:
- typescript
- web
tags:
- component
- toggle-group
- segmented-control
- forms
- ui
depends-on: []
related: []
references: []
---

# ToggleGroup

## Overview

The shared `ToggleGroup` in `@agentic-toolkit/ui` — a segmented control, i.e. a row of
mutually-exclusive option buttons (e.g. a light/dark/system theme switcher, or a
left/center/right alignment picker). It is built on Base UI's `ToggleGroup` +
`Toggle` primitives so it stays consistent with the family's other base-ui
primitives (radio/switch), and it is themed entirely from `apt-*` tokens: the group
sits on the shared field shell and the pressed item takes a gold fill.

Two exports ship from `@agentic-toolkit/ui/components/toggle-group`:

- `ToggleGroup` — the container. It renders the Base UI `ToggleGroup` on the
  `fieldShellClass` (border + `apt-bg`) as an `inline-flex w-fit` row with `gap-1 p-1`.
- `ToggleGroupItem` — one option button. It renders the Base UI `Toggle`, styled as an
  `h-8` pill that shows muted text at rest, brightens on hover, takes a
  `focus-visible` gold ring, and — when pressed (`data-[pressed]`) — fills gold with
  `apt-bg` text.

Base UI's value model is always `string[]`. For a **single-select** control (the
common segmented-control case) leave `multiple` at its default (false) and pass
`value={[selected]}`; in `onValueChange` read `next[0]` and ignore the empty array
(clicking the already-pressed item would otherwise deselect it — a segmented control
always keeps one selection). Both props forward straight through to the Base UI
primitive, so multi-select and uncontrolled use are available by setting `multiple`
and/or `defaultValue`.

## Behavioral Requirements

- **renders-item-toggle-buttons**: The component MUST render each `ToggleGroupItem` as a real, focusable toggle button carrying its `value`.
- **marks-selected-item-pressed**: The component MUST mark the item whose `value` is in the group's current value as pressed (`data-[pressed]`).
- **pressed-item-gold-fill**: The pressed item MUST show the gold fill treatment (`bg-apt-gold` with `text-apt-bg`), visually distinct from the muted rest state.
- **emits-value-on-select**: Selecting an item MUST call `onValueChange` with the group's next value array.
- **single-select-via-value-array**: When driven single-select (`value={[selected]}`, `multiple` unset), the component MUST reflect exactly the one item in that array as pressed.
- **keyboard-operable**: A focused item MUST be operable by keyboard (arrow-key roving focus between items and Enter/Space activation), per the Base UI ToggleGroup primitive.
- **focus-visible-ring**: A keyboard-focused item MUST show a visible focus ring (`focus-visible:ring-2 ring-apt-gold/40`).
- **disabled-item-inert**: A disabled item MUST NOT respond to pointer input and MUST render dimmed (`opacity-50`, `pointer-events-none`).
- **forwards-group-and-item-props**: The component MUST forward arbitrary props (incl. `aria-label`, `className`, `multiple`, `defaultValue`) to the underlying Base UI group and item primitives.

## Appearance

```
┌─────────────────────────────────┐   field shell (border + apt-bg, p-1)
│ ┌───────┐ ┌────────┐ ┌────────┐ │
│ │ Left  │ │ Center │ │ Right  │ │   Center pressed → gold fill
│ └───────┘ └────────┘ └────────┘ │
└─────────────────────────────────┘
   muted     GOLD       muted
```

- Group: `fieldShellClass` (`rounded-lg border border-apt-border bg-apt-bg`) +
  `inline-flex w-fit items-center gap-1 p-1`; extra classes merge via `cn()`.
- Item: `inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-3`,
  `text-sm font-medium`, `text-apt-text-muted` at rest, `hover:text-apt-text`.
- Pressed item: `data-[pressed]:bg-apt-gold data-[pressed]:text-apt-bg`.
- Focus: `focus-visible:ring-2 focus-visible:ring-apt-gold/40`.
- Icons inside items are sized `size-4`, `shrink-0`, `pointer-events-none`.
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Rest (unpressed) | Muted text (`text-apt-text-muted`) on the transparent pill |
| Hover | Text brightens to `text-apt-text` |
| Focus-visible | Gold focus ring (`ring-2 ring-apt-gold/40`) |
| Pressed (selected) | Gold fill: `bg-apt-gold` + `text-apt-bg` |
| Disabled | `opacity-50`, `pointer-events-none` |

## Accessibility

- Built on Base UI `ToggleGroup` + `Toggle`, so items are real toggle buttons with
  correct pressed semantics and roving-focus keyboard support (arrow keys move focus
  between items; Enter/Space activates) out of the box.
- The pressed/selected item is conveyed via the Base UI toggle's pressed state, not
  color alone — the `data-[pressed]` gold fill is the visual layer on top of it.
- Focus is shown with a visible `focus-visible` gold ring built from tokens.
- The group SHOULD carry an `aria-label` (or `aria-labelledby`) naming what is being
  chosen — the demo uses `aria-label="Alignment"` — since a bare group of buttons is
  ambiguous to AT.
- Disabled items are exposed as disabled and are not focusable/operable.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | renders-item-toggle-buttons | render group with items `left`/`center`/`right` | three focusable toggle buttons, one per value |
| T2 | marks-selected-item-pressed, single-select-via-value-array | `value={["center"]}` | the `center` item has `data-pressed`; the others do not |
| T3 | pressed-item-gold-fill | `value={["center"]}` | the pressed item carries `bg-apt-gold` + `text-apt-bg` |
| T4 | emits-value-on-select | click the `right` item | `onValueChange` called with `["right"]` |
| T5 | single-select-via-value-array | in the demo, click `right` then read `next[0]` | selection becomes `right`; exactly one item pressed |
| T6 | keyboard-operable (Playwright) | focus first item, press ArrowRight then Enter | focus moves to next item; that item activates |
| T7 | focus-visible-ring (Playwright) | tab focus onto an item | item shows `ring-2 ring-apt-gold/40` |
| T8 | disabled-item-inert | render an item with `disabled` and click it | no `onValueChange`; item renders `opacity-50` |

## Edge Cases

- **Deselect guard (single-select):** clicking the already-pressed item makes Base UI
  emit an empty array; the single-select consumer reads `next[0]` and ignores the
  empty array so the control always keeps exactly one selection (see the demo).
- **Value not among items:** if `value` names a value no item carries, no item is
  pressed until a valid value is selected.
- **Multi-select:** setting `multiple` lets the value array hold several values; each
  matching item shows pressed independently.
- **Uncontrolled use:** passing `defaultValue` (instead of `value`) lets Base UI own
  the selection state internally.
- **All items disabled:** the group renders but nothing is operable.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `string[]` | — | Controlled selection. Single-select: pass `[selected]`. |
| `onValueChange` | `(next: string[]) => void` | — | Fired with the next value array; single-select reads `next[0]`. |
| `defaultValue` | `string[]` | — | Uncontrolled initial selection (Base UI owns state). |
| `multiple` | `boolean` | `false` | Allow more than one pressed item. |
| `className` | `string` | — | Extra classes for the group shell; merged via `cn()`. |
| `...props` | Base UI `ToggleGroup.Props` | — | All group props (incl. `aria-label`, `disabled`) forwarded. |

`ToggleGroupItem` props:

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | — | The value this item represents in the group. |
| `disabled` | `boolean` | `false` | Makes the item inert and dimmed. |
| `className` | `string` | — | Extra classes for the item pill; merged via `cn()`. |
| `...props` | Base UI `Toggle.Props` | — | All toggle props forwarded; `children` may include an icon + label. |

## Logging

No logging. `ToggleGroup` is a presentational control; the meaning of a selection and
any telemetry belong to the consumer's `onValueChange` handler, not the control.

## Platform Notes

- File: `websites/shared/ui/src/components/toggle-group.tsx`.
- Built on `@base-ui/react/toggle-group` + `@base-ui/react/toggle`; the group sits on
  `fieldShellClass` exported from `./input`, keeping it visually aligned with the
  other field-shell inputs.
- Carries `"use client"` (Base UI interactivity).
- Demo: `ui-showcase` Topic `toggle-group` (regenerate `sources.generated.ts` after
  source changes via `gen-sources.py`).
- Web/TypeScript only; token-driven so it themes with the rest of `@agentic-toolkit/ui`.

## Design Decisions

- **Base UI ToggleGroup, not a bespoke button row.** Reusing the Base UI primitive
  gives correct pressed semantics and roving-focus keyboard support for free and keeps
  the control consistent with the family's other base-ui primitives (radio/switch).
- **Field shell for the container.** The group borrows `fieldShellClass` so a
  segmented control reads as a peer of the other form fields rather than a loose row
  of buttons.
- **Single-select is a convention, not a separate component.** Base UI's value is
  always `string[]`; rather than fork a single-select variant, the recipe documents
  the `value={[selected]}` + `next[0]` + ignore-empty pattern so one component covers
  both single- and multi-select.
- **Gold fill for the pressed item.** The selected item takes the family `apt-gold`
  fill with `apt-bg` text — a single, token-only pressed treatment that reads clearly
  against the muted rest state without per-item color rules.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Keyboard operable (roving focus + activation) + visible focus | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the Base UI segmented control and its single-select convention. |
