---
id: 8fa7aaae-df62-44ea-b10c-182f3094ed9f
title: Topic Detail
domain: agenticdeveloperhub://recipes/topic-detail
type: ingredient
version: 1.4.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-07-14'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The reusable two-pane primitive: a selectable topic list (left rail) beside a detail pane (right) — the adh.com/home rail|content split."
platforms:
- typescript
- web
tags:
- topic-detail
- master-detail
- two-pane
- navigation
depends-on: []
related:
- agenticdeveloperhub://recipes/focused-topic-detail
references: []
---

# Topic Detail

## Overview

**TopicDetail** is the reusable two-pane primitive — a selectable topic list on
the left rail beside a detail pane on the right, exactly the adh.com/home
rail|content split. It is *only* the split: no title row and no action bar — those
are composed around it (see [[focused-topic-detail]]). It is a faithful port of
the hub's settings rail (CSS → utilities with `apt-*` tokens) so home and the
shared library render identically. It fills its container, so give it a height.

## Behavioral Requirements

- **must-render-two-panes**: The component MUST render a left topic-list rail beside a right detail pane that fills the container.
- **must-mark-selected**: The list item whose `id` equals `selectedId` MUST be marked active (gold selection bar + `aria-current`).
- **must-report-selection**: Clicking a non-disabled item MUST call `onSelect` with that item's `id`.
- **must-skip-disabled**: A `disabled` item MUST be dimmed and non-interactive (no `onSelect`).
- **must-render-inline-sublabel**: An item with `inlineSublabel` MUST render its `sublabel` on the SAME line as the label (dim), the label keeping layout priority (grows + truncates first) and the sublabel shrinking + truncating after it — instead of the default stacked second line. It MUST have no effect in the collapsed/covered icon-only strip (which hides the label entirely).
- **must-render-empty-label**: With no items, the rail MUST show `emptyLabel`.
- **must-support-rail-slot**: When `railSlot` is provided it MUST render in the leading slot above the topics; when `railSlotActive`, the selection bar MUST move onto that slot. A `(collapsed) => node` render-prop form MUST receive the rail's collapsed state so the slot can shrink to an icon-only `+` when undisclosed.
- **must-reserve-leading-slot**: The leading rail slot MUST always be reserved at a fixed height — empty when there is no `railSlot` — so the first topic row sits at the same vertical position in every rail, whether or not the rail has a leading button.
- **must-render-divider-after**: An item with `dividerAfter` MUST render a separator row after it (desktop).
- **must-render-spacer-after**: An item with `spacerAfter` MUST render a flexible spacer after it that pushes every following item to the rail's bottom edge (a bottom-pinned tail, e.g. Settings) — in the full rail and in the collapsed/covered icon strips alike.
- **must-respond-mobile**: At ≤768px the rail MUST become a horizontal wrap with the selection bar on the bottom edge.
- **must-collapse-rail**: The rail is always collapsible — the component MUST offer a top-right toggle (desktop) that collapses the rail to a thin icon-only strip and expands it again. Collapsibility is intrinsic, not configurable.
- **must-support-controlled-collapse**: When `collapsed` + `onCollapsedChange` are provided the collapse state MUST be controlled from outside (so an enclosing frame can drive it); otherwise it MUST self-manage from `defaultCollapsed`.

## Appearance

Grid `md:grid-cols-[240px_minmax(0,1fr)]` (collapsed rail `2.25rem`). Rail uses
`bg-apt-nav` with a right border on desktop / bottom border on mobile. Items are
mono `text-[0.8rem]` with a left selection bar (`border-l-2`): active =
`border-l-apt-gold text-apt-gold`, hover = `border-l-apt-text`, disabled =
`text-apt-text-dim`. At ≤768px items wrap horizontally and the bar moves to the
bottom (`border-b-2`). The pane is `bg-apt-surface`; with `panePadding` it adds
`gap-6 px-6 py-4`. Dividers use `bg-apt-border`. No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| no selection | no active item (bar may sit on an active rail slot) |
| item active | gold left bar + gold text + `aria-current` |
| item hover | text-colored left bar |
| item disabled | dimmed, non-clickable |
| rail collapsed | thin strip with a `»` expand control |
| ≤768px | horizontal wrap; selection bar on the bottom edge |

## Accessibility

Items are real `<button>`s (keyboard focus + activation); the active item carries
`aria-current="true"` and disabled items are native `disabled` buttons. Divider
rows use `role="separator"`. The collapse/expand controls carry `aria-label`
(`Collapse list` / `Expand list`).

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-two-panes | items + children | rail and pane both render |
| T2 | must-mark-selected | `selectedId="x"` | item x shows the gold bar + `aria-current` |
| T3 | must-report-selection | click item "y" | `onSelect("y")` fires |
| T4 | must-skip-disabled | click a `disabled` item | no `onSelect`; item dimmed |
| T5 | must-render-empty-label | `items=[]` | `emptyLabel` shown |
| T6 | must-support-rail-slot | `railSlot={(c)=>…}` + `railSlotActive`, collapsed | slot above topics; bar on the slot; render-prop gets `collapsed` → icon-only `+` |
| T7 | must-respond-mobile | viewport 375 | horizontal wrap; bottom selection bar |
| T8 | must-collapse-rail | click the `«` toggle | rail collapses to an icon-only strip; `»` re-expands |
| T9 | must-reserve-leading-slot | one rail with `railSlot`, one without | the first topic row is at the same vertical offset in both |
| T10 | must-support-controlled-collapse | `collapsed` + `onCollapsedChange` | toggling calls `onCollapsedChange`; the rail follows the `collapsed` prop |
| T11 | must-render-spacer-after | an item with `spacerAfter`, list shorter than the rail | the following items sit at the rail's bottom edge; collapsing the rail keeps them pinned |
| T12 | must-render-inline-sublabel | an item with `sublabel` + `inlineSublabel` | label and sublabel share one line (label first, sublabel dim after it); collapsing the rail hides both |

## Edge Cases

- It is ONLY the rail|content split — compose any title row or action bar around it.
- `panePadding={false}` gives edge-to-edge content whose rows carry their own inset (no negative-margin hacks).
- It fills its container and needs an explicit height from the parent.
- When nothing is focused and `railSlotActive` is set, the selection bar rests on the rail slot.

## Configuration

Props: `items: TopicDetailItem[]`, `selectedId`, `onSelect`, `emptyLabel?`,
`railSlot?: RailSlot`, `railSlotActive?`, `headerSlot?: ReactNode` (a pinned
full-width strip between the titled header and the rows — non-scrolling, hidden
while collapsed; hosts the shared ListHeader), `panePadding?` (true), `collapsed?`,
`onCollapsedChange?`, `defaultCollapsed?` (false), `children`. The rail is always
collapsible — there is no opt-in flag; the leading slot is always reserved (empty
when there is no `railSlot`). `TopicDetailItem`: `{ id, label, sublabel?,
inlineSublabel?, description?, icon?, dividerAfter?, spacerAfter?, disabled? }`
(`inlineSublabel` renders the sublabel on the label's line for dense single-line
rows; `description` is carried on the row but rendered NOWHERE by either this
primitive or the hierarchical view — it fed the latter's topic-overview card,
which was deleted in [[hierarchical-topic-detail]] 1.19.0, so hosts keep it only
for surfaces of their own that show a blurb).
`RailSlot = ReactNode | (collapsed: boolean) =>
ReactNode`. Exports: `TopicDetail`, `TopicDetailItem`, `RailSlot`.

## Logging

None — a presentational block. Callers own any selection telemetry.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/blocks/topic-detail.tsx`. A 1:1 port of hub's `SettingsLayout` rail. `"use client"`.
- **Responsive:** the ≤768px horizontal-wrap behavior is built in; verify via Playwright (ui-showcase) at 375 / 768 / 1440.
- **SwiftUI / Compose:** Not applicable — web-only shared block.

## Design Decisions

- **Only the split.** Title and action chrome compose around it, keeping the primitive reusable (separation-of-concerns).
- **`panePadding` toggle.** Lets consumers opt into edge-to-edge rows without negative-margin hacks.
- **1:1 port of the hub settings rail.** CSS translated to utilities with `apt-*` tokens, so home and the shared library stay identical.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — `apt-*` tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.4.0 | 2026-07-14 | Mike Fullerton | `inlineSublabel` on `TopicDetailItem`: render `sublabel` on the label's line (dim, label-priority truncation) for dense single-line entity rows (sites / groups / platforms / users). New requirement `must-render-inline-sublabel`. |
| 1.3.0 | 2026-07-10 | Mike Fullerton | TopicRail `headerSlot`: pinned strip under the titled header for the shared ListHeader (filter + actions). |
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial draft |
| 1.1.0 | 2026-06-30 | Mike Fullerton | Collapse-aware `railSlot` render-prop (→ `+` when undisclosed); always-reserved leading slot (first-row alignment); controllable collapse (`collapsed`/`onCollapsedChange`/`defaultCollapsed`). |
| 1.2.0 | 2026-07-03 | Mike Fullerton | `spacerAfter` on `TopicDetailItem`: a flexible spacer after the item pins the following items to the rail's bottom edge (e.g. a bottom Settings), in the full rail and the collapsed/covered icon strips alike. New requirement `must-render-spacer-after`. |
