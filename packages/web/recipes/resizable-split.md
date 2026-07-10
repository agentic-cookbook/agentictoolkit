---
id: c21473ee-a075-4800-96db-ff3de0888515
title: "ResizableSplit"
domain: agenticdeveloperhub://recipes/resizable-split
type: ingredient
version: 2.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-07-10
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A vertical two-pane split with a draggable divider (1px grip seam, or a header bar for the bottom pane), animated collapse, reveal-to-fit, and optional persisted ratio."
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
the bottom pane, in `@agentic-toolkit/ui`. It lays out two stacked panes — PEERS
in the column; the bottom never overlays the top — whose split ratio the user
drags; the bottom pane can be collapsed/expanded via a chevron on the divider,
with an animated boundary. It offers controlled collapse plus an optional
persisted ratio, and is otherwise self-contained.

The divider has two forms:

- **seam** (default): a 1px connected boundary with a visible centered grip pill
  and a generous 24px transparent grab band; the collapse chevron sits at the
  right edge.
- **header bar** (`header`/`headerActions` set): the divider IS the bottom
  pane's header — a real strip with the pane's title left, optional actions and
  the disclosure chevron at the far right. The whole bar is a drag target, and
  the bar stays visible while the pane is hidden (it is the collapsed remnant).

It adapts the hand-rolled divider in `status-backend`'s `Dashboard.tsx` (ratio
state, `row-resize`, clamp, localStorage persistence) into a reusable,
token-styled component. It is used by `ListWithDetailsPane` (table over details).

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
- **header-bar-variant**: When `header` (or `headerActions`) is set, the divider MUST render as a header bar: `header` content left-aligned, `headerActions` then the disclosure chevron at the far right.
- **header-bar-always-visible**: The header bar MUST stay visible while the bottom pane is collapsed — only the bar remains.
- **header-bar-drag-anywhere**: Pointer-down anywhere on the header bar EXCEPT its interactive controls (buttons, links, inputs, `[data-no-drag]`) MUST start a resize drag; while expanded the bar MUST show `cursor: row-resize`.
- **toggle-animates**: Collapse/expand MUST animate the shared boundary for 0.3s (ease-in-out). It MUST NOT animate when the app-level appearance setting `html[data-reduce-motion="on"]` is active. Drags are direct manipulation and MUST never animate.
- **expand-to-content**: With `expandToContent` (default on for the header-bar variant), expanding from collapsed MUST open the bottom pane exactly far enough to show ALL its content, clamped to `[minRatio, maxRatio]`; when the container/content can't be measured it MUST fall back to the last drag ratio.
- **bottom-stays-mounted**: The bottom pane MUST stay mounted while collapsed (zero height, clipped, `inert`) so its state survives a hide/show cycle and reveal-to-fit can measure the hidden content.

## Appearance

```
seam (default):
┌───────────────────────────────┐
│  top                          │  flex: 0 1 ratio%
├────────── ▬▬ ──────────── ⌄ ──┤  1px seam + centered grip pill + 24px grab band
│  bottom                       │  flex: 1
└───────────────────────────────┘
header bar:
┌───────────────────────────────┐
│  top                          │  flex: 0 1 ratio%
├ Details ────────── [actions] ⌄┤  the bar IS the divider (drag anywhere on it)
│  bottom                       │  flex: 1
└───────────────────────────────┘
collapsed (either form):
┌───────────────────────────────┐
│  top (fills)                  │
├ Details ─────────────────── ⌃ ┤  only the divider/bar remains; bottom stays
└───────────────────────────────┘  mounted at height 0 (clipped, inert)
```

- Container: `flex flex-col min-h-0`. Panes: `min-h-0 overflow-auto` (bottom is
  clipped by an `overflow-hidden` wrapper so the collapse animation never shows
  a scrollbar).
- Seam: 1px `bg-apt-border`, hover `bg-apt-border-strong`; centered grip pill
  (`bg-apt-border-strong`, rounded); invisible 24px grab band carries the drag;
  `cursor: row-resize`; chevron right-aligned, `text-apt-text-muted`.
- Header bar: `border-y border-apt-border bg-apt-surface`, mono muted title
  left, actions + chevron right; `cursor: row-resize` across the bar (default
  cursor on its controls and while collapsed).
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Idle | divider `bg-apt-border` |
| Divider hover | `bg-apt-border-strong` |
| Dragging | `cursor: row-resize`; text selection suppressed |
| Handle focused | focus ring on the separator handle |
| Expanded | bottom pane visible at the current ratio; chevron `⌄` |
| Collapsed | bottom pane height 0 (still mounted, `inert`); top fills; chevron `⌃`; header bar (if any) stays visible |
| Toggling | boundary animates 0.3s ease-in-out; skipped under `html[data-reduce-motion="on"]` |

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
| T9 | header-bar-variant | render with `header="Details"` | the separator contains the title; the chevron is inside it, far right |
| T10 | header-bar-always-visible | collapse the header-bar variant | the bar (title + chevron `⌃`) still renders |
| T11 | header-bar-drag-anywhere | pointer-down on `headerActions` button | no drag starts; the button's own click fires |
| T12 | toggle-animates | set `html[data-reduce-motion="on"]`, toggle | the top pane gets no transition style |
| T13 | expand-to-content | collapsed, content 300px in a 1000px container (28px bar) | expand opens the top pane to ratio ≈ 0.672 |
| T14 | bottom-stays-mounted | collapse | bottom content remains in the DOM inside an `inert` wrapper |

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
| `header` | `React.ReactNode` | — | Render the divider as the bottom pane's header bar with this left-aligned content. |
| `headerActions` | `React.ReactNode` | — | Right-aligned controls on the header bar, before the chevron; never drag targets. |
| `expandToContent` | `boolean` | on for header bar, off for seam | Expand-from-collapsed sizes the bottom pane to show all its content. |
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
| 2.0.0 | 2026-07-10 | Mike Fullerton | Header-bar divider variant (always-visible details header, drag anywhere, chevron far right); animated collapse gated on app-level reduce-motion; expand-to-content reveal; bottom pane stays mounted (inert) while collapsed; documented the shipped grip-pill + 24px grab-band seam. |
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
