---
id: c21473ee-a075-4800-96db-ff3de0888515
title: "ResizableSplit"
domain: agenticdeveloperhub://recipes/resizable-split
type: ingredient
version: 1.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-06-26
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A vertical two-pane split with a draggable divider, collapsible bottom pane, and optional persisted ratio."
platforms:
  - typescript
  - web
tags:
  - component
  - layout
  - split
  - ui
depends-on: []
related: []
references: []
---

# ResizableSplit

## Overview

A vertical (top/bottom) split with a draggable divider and a collapse toggle for
the bottom pane, in `@adh-shared/ui`. It lays out two stacked panes whose split
ratio the user drags; the bottom pane can be collapsed/expanded via a chevron on
the divider. It offers controlled collapse plus an optional persisted ratio, and
is otherwise self-contained. It adapts the hand-rolled divider in
`status-backend`'s `Dashboard.tsx` (ratio state, `row-resize`, clamp, localStorage
persistence) into a reusable, token-styled component. It is used by
`ListWithDetailsPane` (table over details).

## Behavioral Requirements

- **drag-captures-pointer**: On pointer-down on the divider, the component MUST capture the pointer.
- **drag-maps-to-ratio**: On pointer-move while captured, the component MUST map `clientY` within the container to a top-pane ratio.
- **drag-clamps-ratio**: The component MUST clamp the ratio to `[minRatio, maxRatio]`.
- **drag-releases-on-pointerup**: On pointer-up, the component MUST release the pointer capture.
- **drag-cursor-and-no-select**: While dragging, the component MUST show `cursor: row-resize` and MUST suppress text selection.
- **persist-ratio-when-keyed**: When `storageKey` is set, the component MUST write the ratio to `localStorage` on change and MUST restore it on mount, guarded for SSR and parse errors.
- **collapse-toggles-bottom**: Activating the divider chevron MUST toggle `collapsed`; collapsed MUST give the bottom pane height 0, let the top fill, and flip the chevron.
- **collapse-remembers-ratio**: The component MUST remember the last drag ratio while collapsed and restore it on expand.
- **collapse-controlled-or-internal**: When `collapsed`/`onCollapsedChange` are provided the component MUST be controlled; otherwise collapse state MUST be internal.
- **keyboard-nudges-ratio**: When the divider handle is focused, ↑/↓ MUST nudge the ratio by a small step, clamped.
- **keyboard-toggles-collapse**: Enter/Space on the chevron button MUST toggle collapse.

## Appearance

```
┌───────────────────────────────┐
│  top                          │  flex: 0 0 ratio%
├───────── ⌄ ───────────────────┤  divider (row-resize) + collapse chevron
│  bottom                       │  flex: 1
└───────────────────────────────┘
collapsed:
┌───────────────────────────────┐
│  top (fills)                  │
├───────── ⌃ ───────────────────┤  only the handle row remains
└───────────────────────────────┘
```

- Container: `flex flex-col min-h-0`. Panes: `min-h-0 overflow-auto`.
- Divider: 5px tall, `bg-apt-border`, hover/drag `bg-apt-border-strong`, `cursor: row-resize`; chevron button centered, `text-apt-text-muted`.
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Idle | divider `bg-apt-border` |
| Divider hover | `bg-apt-border-strong` |
| Dragging | `cursor: row-resize`; text selection suppressed |
| Handle focused | focus ring on the separator handle |
| Expanded | bottom pane visible at the current ratio; chevron `⌄` |
| Collapsed | bottom pane height 0; top fills; chevron `⌃` |

## Accessibility

- Divider handle: `role="separator"`, `aria-orientation="horizontal"`, `aria-valuenow`/`aria-valuemin`/`aria-valuemax` reflecting the ratio, `tabIndex=0`.
- Collapse button: a real `<button>` with `aria-expanded` and `aria-label` from `bottomLabel`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | drag-clamps-ratio | drag past the minimum | ratio clamps at `minRatio` |
| T2 | drag-clamps-ratio | drag past the maximum | ratio clamps at `maxRatio` |
| T3 | collapse-toggles-bottom | click the chevron | bottom hidden; `aria-expanded="false"` |
| T4 | collapse-toggles-bottom | click the chevron again | bottom visible; `aria-expanded="true"` |
| T5 | persist-ratio-when-keyed | set `storageKey`, drag, remount | ratio round-trips from `localStorage` |
| T6 | keyboard-nudges-ratio | focus handle, press ↑/↓ | ratio nudges within clamp |
| T7 | drag-captures-pointer (Playwright) | drag the divider | split ratio follows the pointer |
| T8 | keyboard-toggles-collapse (Playwright) | Enter/Space on chevron | collapse toggles |

## Edge Cases

- `localStorage` access is guarded for SSR and parse errors; on failure it falls back silently to `defaultRatio`.
- The last drag ratio survives a collapse/expand cycle.
- When `collapsed`/`onCollapsedChange` are omitted, collapse is internal (uncontrolled).
- Pointer drag is exercised in Playwright; jsdom asserts the state transitions.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `top` | `React.ReactNode` | — | Top pane content. |
| `bottom` | `React.ReactNode` | — | Bottom pane content. |
| `defaultRatio` | `number` | `0.6` | Initial top fraction (0..1). |
| `minRatio` | `number` | `0.2` | Lower clamp. |
| `maxRatio` | `number` | `0.85` | Upper clamp. |
| `storageKey` | `string` | — | Persist the ratio in `localStorage` when set. |
| `collapsed` | `boolean` | — | Controlled collapse of the bottom pane. |
| `onCollapsedChange` | `(collapsed: boolean) => void` | — | Collapse change callback. |
| `bottomLabel` | `string` | `"Details"` | a11y label for the toggle. |
| `className` | `string` | — | Extra classes. |

If `collapsed`/`onCollapsedChange` are omitted, collapse state is internal. The ratio is internal (seeded from `storageKey` or `defaultRatio`).

## Logging

No logging. ResizableSplit is a presentational layout primitive; it emits no structured log events.

## Platform Notes

- New file: `websites/shared/ui/src/components/resizable-split.tsx`.
- Demo: `ui-showcase` (regenerate sources afterward).
- Consumed by: `ListWithDetailsPane`.

## Design Decisions

- **Adapted from status-backend.** Generalizes the hand-rolled divider in `Dashboard.tsx` (ratio state, `row-resize`, clamp, localStorage persistence) into a reusable, token-styled primitive rather than re-rolling it per site.
- **Self-contained ratio, optional persistence.** The ratio is internal and seeded from `storageKey` or `defaultRatio`; persistence is opt-in via `storageKey`.

## Compliance

No additional compliance categories apply to this presentational primitive.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
