---
id: 6acd3c5f-7bb5-4d6d-8c8d-141e1909cf73
title: "ListWithDetailsPane"
domain: agenticdeveloperhub://recipes/list-with-details-pane
type: recipe
version: 2.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-07-10
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A master/detail block: a shared ListHeader (filter + actions) over a multi-select DataTable over a details pane whose divider is its always-visible header bar; list and details are peers."
platforms:
  - typescript
  - web
tags:
  - master-detail
  - table
  - layout
  - selection
ingredients:
  - agenticdeveloperhub://recipes/list-header
  - agenticdeveloperhub://recipes/data-table
  - agenticdeveloperhub://recipes/resizable-split
  - agenticdeveloperhub://recipes/alert-and-dialog
depends-on: []
related: []
references: []
---

# ListWithDetailsPane

## Overview

A master/detail block in `@agentic-toolkit/ui`: the shared `ListHeader`
(filter + actions + delete) over a `DataTable`, over a details pane. The list
and the details pane are PEERS in the column — the details never overlays the
list — and the divider between them renders as the details pane's always-visible
header bar (`ResizableSplit`'s header-bar variant, titled by `detailsLabel`). It
composes `ListHeader` + `DataTable` + `ResizableSplit` + `AlertModal` + `Button`.

It owns the selection state and filter; it renders rows in a `DataTable`
(clicking a row selects it; ↑/↓ move the selection — DataTable's keyboard nav),
and a bottom details pane that reflects the single selected row. It is generic
over row type `T`.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| DataTable | agenticdeveloperhub://recipes/data-table | Renders filtered, multi-select rows | yes | `columns`, `rows`, `getRowId`, selection, `loading`, `emptyLabel` |
| ListHeader | agenticdeveloperhub://recipes/list-header | The filter + actions bar above the table | yes | `search` from `filterText`/`onFilterTextChange`; `actions` from `actions` + Delete |
| ResizableSplit | agenticdeveloperhub://recipes/resizable-split | Top/bottom split: table on top, details below its header-bar divider (`header={detailsLabel}`) | yes | `storageKey` forwarded from props |
| AlertAndDialog | agenticdeveloperhub://recipes/alert-and-dialog | Destructive confirm shown before delete | yes | `destructive` tone; copy from `deleteConfirm` |

Composed shared primitives without their own recipe domains: `Button` (toolbar
actions + Delete), `Input` (filter box), and `Separator` (`dividerBefore`).

## Integration Requirements

- **must-own-selection**: The ListWithDetailsPane MUST own the selection state as
  a `Set<string>` and pass it to `DataTable`; selection MUST survive filter
  changes and MUST be pruned only when a row id leaves the `rows` prop.
- **must-filter-rows**: The ListWithDetailsPane MUST filter rows by `filterRow`
  (default: case-insensitive substring over the columns' rendered/scalar text)
  before the table, using the controlled `filterText`/`onFilterTextChange` when
  provided and internal state otherwise.
- **must-disable-selection-actions**: Action buttons with `requiresSelection` and
  the Delete button MUST be `disabled` whenever the selection is empty.
- **must-confirm-delete**: When Delete is activated and `onDelete` is set, the
  ListWithDetailsPane MUST open an `AlertModal` (`destructive`, copy from
  `deleteConfirm`) before calling `onDelete(selectedIds)`, and on confirm MUST
  clear the deleted ids from the selection.
- **must-render-detail-states**: The details pane (the `ResizableSplit` bottom)
  MUST render `emptyDetail` (default "Select a row to see details.") when 0 rows
  are selected, `renderDetail(row)` when exactly 1 row is selected, and the hint
  "Select a single row to see details." when more than 1 row is selected.
- **must-render-divider-before-action**: A `ListAction` with `dividerBefore: true`
  MUST render a `Separator` immediately before its button in the toolbar.
- **must-use-list-header**: The toolbar MUST be the shared `ListHeader` (filter
  field left, actions right) so every list header on the platform matches.
- **must-render-details-header-bar**: The split's divider MUST render as the
  details pane's header bar (`ResizableSplit` `header={detailsLabel}`, default
  `"Details"`): always visible, drag anywhere on it, disclosure chevron far
  right, animated collapse, reveal-to-fit on expand.
- **keyboard-moves-selection**: With the table focused, ↑/↓ MUST move the
  selection (DataTable's keyboard navigation).

## Layout

```
┌ ListHeader ─────────────────────────────────────────────────────────┐
│ [ 🔍 filter… ]                           [ …actions… ] | [ Delete ]  │
├─────────────────────────────────────────────────────────────────────┤
│  DataTable (filtered, multi-select)                        ▲ top     │
├ Details ──────── (drag anywhere on the bar) ─────────────────── ⌄ ──┤
│  details:                                                  ▼ bottom  │
│    0 selected → emptyDetail ("Select a row to see details.")         │
│    1 selected → renderDetail(row)                                    │
│   >1 selected → "Select a single row to see details."                │
└─────────────────────────────────────────────────────────────────────┘
```

- Toolbar: the shared `ListHeader` (recessed ButtonBar strip); filter `Input`
  with search icon (`max-w-xs`); spacer `flex-1`; actions right-aligned.
- Details pane: `p-4 text-sm text-apt-text`; hints in `apt-text-muted`.
- The bottom pane is draggable + collapsible (disclosure) per `ResizableSplit`.
- No raw hex; no `!important`.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| selection (`Set<string>`) | ListWithDetailsPane | DataTable, toolbar action + Delete buttons | Down | Component state + prop drilling |
| filterText | Caller (controlled) or internal state | Row filter → DataTable | Down | Controlled prop `filterText`/`onFilterTextChange` or internal state |
| rows (`T[]`) | Caller | DataTable, details pane | Down | Prop |
| deleteConfirm open | ListWithDetailsPane | AlertAndDialog (AlertModal) | Down | Boolean state |
| selectedIds on delete | ListWithDetailsPane | Caller `onDelete` | Up | Callback |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-filter-rows | Type `ada` in the filter | Table narrows to rows matching `ada` |
| T2 | must-own-selection | Select rows, then change the filter | Selection persists across filtering |
| T3 | must-disable-selection-actions | 0 rows selected | Delete and `requiresSelection` actions are disabled |
| T4 | must-disable-selection-actions | ≥1 row selected | Delete and `requiresSelection` actions are enabled |
| T5 | must-confirm-delete | Click Delete with rows selected, confirm | `AlertModal` opens; on confirm `onDelete(selectedIds)` is called and removed ids leave the selection |
| T6 | must-render-detail-states | Select 0 / 1 / >1 rows | Details pane shows `emptyDetail` / `renderDetail(row)` / the multi-select hint |
| T7 | must-render-divider-before-action | An action with `dividerBefore: true` | A `Separator` renders before that action's button |

## Edge Cases

- 0 selected → `emptyDetail`; exactly 1 → `renderDetail`; >1 → the multi-select
  hint.
- A filter matching no rows shows the table's `emptyLabel`, while the selection
  of rows no longer visible is retained (ids are pruned only when a row leaves
  `rows`).
- `loading` → the `DataTable` loading state; empty data → `emptyLabel`.
- After the caller removes rows on delete-confirm, the component clears the
  removed ids from its selection.
- When `onDelete` is not provided, no Delete button is rendered.

## Platform Notes

- **React / Web (TypeScript):** New block at
  `websites/shared/ui/src/blocks/list-with-details-pane.tsx` (exported via
  `./blocks/*`). Composes `DataTable`, `ResizableSplit`, `AlertModal`, `Button`,
  `Input`, `Separator`. Add a demo to `ui-showcase` (+ regenerate sources).
  Consumed by the admin "Invitations" topics (Requests / Pending Users / Invites)
  and the admin-notes modal (sub-project 4).
- **Responsive:** Verify via Playwright (ui-showcase) at 375 / 768 / 1440 — the
  master/detail split (via `ResizableSplit`) and toolbar stay usable on mobile.
- **SwiftUI / Compose:** Not applicable — web-only shared block.

API (`@adh-shared/ui/blocks/list-with-details-pane`):

```ts
interface ListAction {
  id: string
  label: React.ReactNode
  onClick: (selectedIds: string[]) => void
  requiresSelection?: boolean        // disabled when 0 selected
  dividerBefore?: boolean            // visual separator before this action
  variant?: Button["variant"]        // default "outline"
}
interface ListWithDetailsPaneProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  renderDetail: (row: T) => React.ReactNode
  emptyDetail?: React.ReactNode      // default "Select a row to see details."
  filterText?: string                // controlled; internal state if omitted
  onFilterTextChange?: (t: string) => void
  filterPlaceholder?: string         // default "Filter…"
  filterRow?: (row: T, query: string) => boolean   // default: stringify visible columns, case-insensitive contains
  onDelete?: (selectedIds: string[]) => void
  deleteConfirm?: { title: string; description?: React.ReactNode }  // AlertModal copy
  actions?: ListAction[]
  storageKey?: string                // forwarded to ResizableSplit
  loading?: boolean
  emptyLabel?: string                // table empty text
  ariaLabel: string
}
export function ListWithDetailsPane<T>(props: ListWithDetailsPaneProps<T>): React.ReactElement
```

Accessibility: the toolbar is `role="toolbar"` + `aria-label`; Delete/action
buttons have labels and their `disabled` reflects the selection. The delete
`AlertModal` traps focus and is keyboard-dismissable (its own contract).

## Design Decisions

- **Decision**: The block owns selection as a `Set<string>` rather than the table
  owning it. **Rationale**: Selection must survive filtering and feed the toolbar
  actions and details pane.
- **Decision**: Generic over row type `T`. **Rationale**: Reusable platform-wide
  for any "Invitations"-style master/detail view.
- **Decision**: Delete always routes through a destructive `AlertModal` confirm.
  **Rationale**: Deletion is destructive; a confirm prevents accidental loss.
- **Decision**: Filter is controlled-or-internal. **Rationale**: Callers can drive
  or observe the query when needed, but the common case requires no wiring.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 2.0.0 | 2026-07-10 | Mike Fullerton | Toolbar extracted into the shared ListHeader; divider renders as the details pane's always-visible header bar (`detailsLabel`); list/details peer layout + keyboard selection made explicit. |
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
