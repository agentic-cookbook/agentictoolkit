---
id: 37b7b456-790f-4b2d-8f3a-a364016ce389
title: StatList
domain: agenticdeveloperhub://recipes/stat-list
type: recipe
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A stack of tone-dotted status rows — StatusDot + truncating label + trailing figure — the fleet/telemetry idiom (down sites, top error issues), assembled from StatusDot."
platforms:
- typescript
- web
tags:
- block
- stat
- status
- list
- ui
ingredients:
- agenticdeveloperhub://recipes/status-dot
depends-on: []
related:
- agenticdeveloperhub://recipes/stat-card
references: []
---

# StatList

## Overview

`StatList` and `StatListRow` in `@agentic-toolkit/ui` are the shared **status list** — a
vertical stack of "tone dot + truncating label + trailing figure" rows. It is the
fleet/telemetry idiom: a monitor's *down sites* (name · duration), a card's *top
error issues* (title · count · deep link). Each row is a `StatusDot` (size 7) at the
family tone, a `min-w-0 flex-1 truncate` label, and a right-aligned `shrink-0`
trailing slot the caller fills (a bold duration, a count plus an `ExternalLink`).

It was extracted because that exact row + list grammar was hand-rolled
character-identically in the fleet status site (`MonitorCard`), the status backend's
telemetry cards (`TelemetrySections`), and the ui-showcase — the "same markup twice →
extract it" rule. `StatList` owns the list wrapper (an optional top divider + the
row gap); `StatListRow` owns one row. Both are **pure assembly** — the only visual
primitive is the shared `StatusDot`; everything else is layout + the caller's text.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| StatusDot | agenticdeveloperhub://recipes/status-dot | The leading tone dot on each row (size 7), decorative (no aria label — the row's text carries the meaning) | yes | `tone` per row from `StatListRow.tone`; fixed `size={7}` |

`StatListRow`'s label and trailing content are caller-supplied `ReactNode`s, not
components this block owns; `StatList` is a bare wrapper element.

## Integration Requirements

- **must-render-a-dot-per-row**: `StatListRow` MUST render a decorative `StatusDot` (size 7, no accessible label) at its `tone` as the row's leading glyph.
- **must-truncate-the-label**: `StatListRow` MUST render `label` as a `min-w-0 flex-1 truncate` element and MUST set its native `title` to `labelTitle` when provided, so a clipped label is still readable on hover.
- **must-right-align-trailing**: When `trailing` is provided, `StatListRow` MUST render it right-aligned and non-shrinking after the label; when absent, it MUST render no trailing slot.
- **must-honor-row-element**: `StatListRow` MUST render as a `li` when `as="li"` and a `div` otherwise, so a semantic list uses `ul`/`li`.
- **must-stack-rows**: `StatList` MUST arrange its children in a single vertical `gap-1.5` column with `list-none`.
- **must-divide-when-asked**: `StatList` MUST add a top border + padding when `divided` is set (the list sits under card content) and MUST omit them otherwise.
- **must-honor-list-element**: `StatList` MUST render as a `ul` when `as="ul"` and a `div` otherwise.
- **must-spread-host-attributes**: Both MUST spread remaining host attributes (`data-*`, `id`, handlers) onto their root element so hosts can tag them (e.g. the fleet `data-testid="down-list"`).

## Layout

```
StatList  (as="ul" divided)
--- divider (border-t) --------------------------------------
 (dot) app · production        (truncates…)             1h
 (dot) worker queue            (truncates…)            12m
        ^ StatusDot   ^ min-w-0 flex-1 truncate label   ^ trailing (shrink-0)
```

- Row: `flex items-center gap-2 font-mono text-[11px]` — dot, then the truncating
  label, then the trailing group.
- Trailing group: `inline-flex shrink-0 items-center gap-2` so multiple trailing
  bits (a count + a deep link) space consistently.
- List: `flex list-none flex-col gap-1.5`, plus `border-t border-apt-border pt-2.5`
  when `divided`.
- No raw hex, no `!important` — color via `apt-*` tokens and the composed StatusDot.

## Shared State

Both components are pure and stateless — every prop flows down into layout or the
composed `StatusDot`; nothing flows back up.

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| `tone` | Caller | StatusDot | Down | Prop pass-through |
| `label` / `labelTitle` | Caller | Truncating label element | Down | Prop |
| `trailing` | Caller | Trailing slot | Down | Prop (rendered when non-null) |
| `as` / `divided` | Caller | Root element + wrapper classes | Down | Prop |
| host attributes (`data-*`, `id`) | Caller | Root element | Down | Rest-prop spread |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-a-dot-per-row, must-truncate-the-label, must-right-align-trailing | `<StatListRow tone="error" label="app" labelTitle="app" trailing={<span>1h</span>} />` | a decorative dot, a truncating label with `title="app"`, and "1h" in a shrink-0 trailing slot |
| T2 | must-truncate-the-label | label longer than its box | label carries `min-w-0 flex-1 truncate` |
| T3 | must-right-align-trailing | `StatListRow` with no `trailing` | no trailing slot element rendered |
| T4 | must-honor-row-element | `as="li"` | the row is an `li` |
| T5 | must-stack-rows, must-divide-when-asked, must-honor-list-element | `<StatList as="ul" divided>` | a `ul` with `flex-col gap-1.5` and a `border-t`/`pt-2.5` divider |
| T6 | must-divide-when-asked | `<StatList>` (no `divided`) | no `border-t` on the list |
| T7 | must-spread-host-attributes | `<StatList data-testid="down-list">` | the root carries `data-testid="down-list"` |

## Edge Cases

- **No `trailing`**: the row is dot + label only (a bare status line); the trailing
  slot is omitted entirely.
- **Decorative dots**: the dot never carries an aria label — the row's own text
  (label + trailing) is the accessible content, so a screen reader reads the item
  once, not "status" twice.
- **`labelTitle` vs `label`**: pass the plain-text form as `labelTitle` so the native
  tooltip works even when `label` is rich `ReactNode`.
- **Multiple trailing bits**: wrap them in the `trailing` prop (a fragment); the
  block's `inline-flex gap-2` trailing wrapper spaces them (e.g. `24×` + a deep link).
- **`as` mismatch**: use `as="li"` rows only inside an `as="ul"` StatList to keep the
  list semantics valid.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/blocks/stat-list.tsx`,
  exported from `@agentic-toolkit/ui` (`@agentic-toolkit/ui/blocks/stat-list`). Composes
  `StatusDot` (`../components/status-dot`). Exports `StatList`, `StatListRow`,
  `StatListProps`, `StatListRowProps`.
- Historical source: the fleet `MonitorCard` down-site list and the status backend's
  `TelemetrySections` Errors list — StatList generalizes that one grammar.
- Demo: `ui-showcase` Topic `stat-list` (group "Blocks — cards & sections");
  regenerate `sources.generated.ts` via `gen-sources.py` after source changes.
- **Responsive:** rows truncate their label to fit any width; verify at 375 / 768 /
  1440 that the trailing figure stays visible while the label clips.
- **SwiftUI / Compose:** not applicable — web-only shared block.

## Design Decisions

- **Decision**: split into `StatList` (wrapper) + `StatListRow` (row) rather than one
  data-driven component. **Rationale**: the two real call sites differ only in the
  trailing content (a bold duration vs a count + deep link); a `trailing` slot keeps
  the row declarative for the common part while letting each site own its tail without
  a config explosion.
- **Decision**: the dot is always decorative (no aria label). **Rationale**: the row's
  visible label + trailing already convey the item; labeling the dot too would make a
  screen reader announce the status twice — the same a11y trap the StatusDot adapter
  fix addressed.
- **Decision**: `divided` is a boolean, not a caller-supplied className. **Rationale**:
  both sites use the identical `border-t border-apt-border pt-2.5` treatment when the
  list sits under card content; a named flag keeps that one decision in the block.
- **Decision**: `as` picks the element (`ul`/`li` vs `div`). **Rationale**: a monitor's
  down sites ARE a semantic list, while a card's freeform tail may not be; the block
  supports both without forcing list semantics where they don't fit.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | pass | artifact-formatting |
| No raw hex / arbitrary colors / `!important` (uses `apt-*` tokens) | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (composes StatusDot; no bespoke UI) | pass | project-guidelines UI |
| Decorative dot (no double-announce); truncated label has a `title` tooltip | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; the StatusDot + truncating label + trailing figure row/list grammar extracted from the fleet and telemetry status lists. |
