---
id: a8f66760-7db0-4a10-927e-856c2170dd4f
title: "ListHeader"
domain: agenticdeveloperhub://recipes/list-header
type: ingredient
version: 1.0.0
status: draft
language: en
created: 2026-07-10
modified: 2026-07-10
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The shared header above a list: title, filter text field, and right-aligned actions in the recessed ButtonBar strip."
platforms:
  - typescript
  - web
tags:
  - component
  - list
  - filter
  - toolbar
  - ui
depends-on: []
related:
  - agenticdeveloperhub://recipes/list-with-details-pane
  - agenticdeveloperhub://recipes/search-filter-bar
  - agenticdeveloperhub://recipes/hierarchical-topic-detail
references: []
---

# ListHeader

## Overview

The one home for the "header above a list" pattern in `@agentic-toolkit/ui`
(`blocks/list-header.tsx`): a single row hosting an optional left-aligned title,
a filter text field (search icon, controlled value), a flexible space, and
right-aligned actions (e.g. a `+ New` button, Delete) — all inside the same
recessed `ButtonBar` strip every toolbar on the platform uses, so list headers
look identical everywhere.

Consumers:

- `ListWithDetailsPane` renders it above its `DataTable`.
- A `HierarchicalTopicDetail` level hosts it via the level's `headerSlot` (a
  pinned, non-scrolling strip between the level's title header and its rows), so
  entity lists inside the stack get the same filter + actions header.

Related, NOT absorbed: `SearchFilterBar` is the stacked search-plus-filter-axes
region (`role="search"`, `<select>` rows under the field) for full search pages;
`ListHeader` is the one-row list toolbar. They share the `Input` primitive.

## Behavioral Requirements

- **one-row-layout**: The header MUST render title (when set), filter field
  (when set), a flexible space, then actions, in one `ButtonBar` row.
- **controlled-filter**: The filter field MUST be fully controlled
  (`search.value` / `search.onChange` fired per keystroke) — the header never
  owns filter state.
- **optional-parts**: Title, filter, and actions MUST each be independently
  omittable; an absent part reserves no space.
- **accessible-names**: The bar MUST take an `ariaLabel`; the filter field's
  accessible name defaults to `"Filter"` and is overridable via `search.label`.

## Appearance

```
┌──────────────────────────────────────────────────┐
│ Title  [🔍 Filter…        ]        [+ New] [Del] │  ButtonBar strip
└──────────────────────────────────────────────────┘
```

- The strip is the shared `ButtonBar` (recessed, `border-b`).
- Title: mono, `text-xs`, `text-apt-text-muted`, shrink-0.
- Filter: shared `Input` with `type="search"`, leading `Search` icon
  (`text-apt-text-muted`), `max-w-xs`.
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Empty filter | placeholder (`"Filter…"` default) |
| Filter focused | shared Input focus ring |
| No search supplied | title + actions only, no field |

## Accessibility

- The strip inherits `ButtonBar`'s toolbar semantics with `ariaLabel`.
- The filter is a `type="search"` input named via `aria-label` (default
  `"Filter"`); the icon is `aria-hidden`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | one-row-layout, controlled-filter | title + search + action | all render; typing fires `onChange` with the new text |
| T2 | optional-parts | no `search` | no searchbox rendered; actions still render |

## Edge Cases

- A long title truncates before it can push the actions off the row (title is
  `shrink-0`, the filter field flexes within `max-w-xs`).
- The header renders no state of its own — filtering an empty list is entirely
  the consumer's concern.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `React.ReactNode` | — | Left-aligned name of the list. |
| `search` | `{ value, onChange, label?, placeholder?, inputRef? }` | — | The controlled filter field. `inputRef` reaches the underlying `<input>` for imperative focus (hosts that keep the pane mounted across visits, where autoFocus can't re-fire). |
| `actions` | `React.ReactNode` | — | Right-aligned actions. |
| `ariaLabel` | `string` | — | Accessible name for the bar (required). |
| `className` | `string` | — | Extra classes on the strip. |

## Logging

No logging. ListHeader is a presentational toolbar; it emits no structured log
events.

## Platform Notes

- File: `packages/web/packages/ui/src/blocks/list-header.tsx`, exported from
  `@agentic-toolkit/ui/blocks`.
- Hosted inside a `HierarchicalTopicDetail` level via `TopicLevel.headerSlot`.

## Design Decisions

- **Built on ButtonBar, not beside it.** Every toolbar on the platform is the
  same recessed strip; the list header composes it rather than re-rolling the
  chrome (`ListWithDetailsPane`'s inline toolbar was extracted into this block).
- **SearchFilterBar left intact.** The stacked search-region (field over
  `<select>` axes) serves full search pages; merging the two would force each
  consumer to configure away the other's shape.

## Compliance

No additional compliance categories apply to this presentational ingredient.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-10 | Mike Fullerton | Initial ingredient — extracted from ListWithDetailsPane's inline toolbar; HierarchicalTopicDetail `headerSlot` integration. |
