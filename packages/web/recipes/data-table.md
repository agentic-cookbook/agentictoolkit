---
id: d04eef56-2dbf-4148-964b-c095f242227f
title: "DataTable"
domain: agenticdeveloperhub://recipes/data-table
type: ingredient
version: 1.1.0
status: draft
language: en
created: 2026-06-26
modified: 2026-07-03
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Controlled, selectable, optionally-sortable generic table primitive owning multi-row click/shift/cmd/keyboard selection."
platforms:
  - typescript
  - web
tags:
  - component
  - data-table
  - table
  - ui
depends-on: []
related: []
references: []
---

# DataTable

## Overview

A generic, selectable, optionally-sortable table primitive in `@adh-shared/ui`.
It is a **controlled** table: the caller owns `rows`, the `selectedIds` set, and
the optional `sort`. The component renders columns, handles pointer + keyboard
selection, and reports changes up. It is generic over the row type `T` and owns
the multi-row selection model (click / ⇧-click / ⌘-click / keyboard). It is the
foundation for `ListWithDetailsPane` and `AddUsersModal`. Nothing comparable
existed before it (`@adh-shared/crud`'s `CrudTable` is placeholder-grade,
single-purpose, and has no selection).

## Behavioral Requirements

- **click-selects-row**: On a plain click of a row, the component MUST set the selection to exactly `{id}` and set the internal anchor to that id.
- **shift-click-extends-range**: On ⇧-click of a row, the component MUST set the selection to the contiguous range from the anchor to the clicked id (in the current `rows` order) and MUST leave the anchor unchanged.
- **modifier-click-toggles**: On ⌘/Ctrl-click or ⌥/Alt-click of a row, the component MUST toggle that id in or out of the selection and MUST set the anchor to that id.
- **arrow-key-moves-selection**: When the grid is focused, ↑/↓ MUST set the selection to the previous/next row's id, set the anchor to it, and clamp at the first/last row.
- **shift-arrow-extends-range**: ⇧+↑/⇧+↓ MUST extend the selection one row from the anchor.
- **space-toggles-focused-row**: Space MUST toggle the focused row in or out of the selection.
- **selection-by-id**: The component MUST track selection by id (not row position) so it survives re-sorts and filters.
- **onselectionchange-new-set**: Every selection edit MUST be reported via `onSelectionChange` with a new `Set` instance (the set is owned by the caller).
- **no-internal-sort**: The component MUST NOT sort `rows` internally; it MUST report sort intent via `onSortChange` and render `rows` in the given order.
- **inert-sort-when-no-handler**: When `onSortChange` is omitted, sortable headers MUST render inert (no sort affordance fires).
- **pointer-no-focus-steal**: Pointer selection MUST NOT steal focus from an open editor elsewhere on the page.
- **action-list-mode-when-unselectable**: When BOTH `selectedIds` and `onSelectionChange` are omitted, the component MUST render rows with no selection affordance — no `aria-selected`, no `data-selected`, no pointer cursor, and clicking a row MUST NOT select it — so in-cell controls (buttons, menus) own the interaction.

## Appearance

```
┌───────────────────────────────────────────────┐
│ Name ▲     │ Email          │ Phone           │  ← sticky header (sortable = button + caret)
├────────────┼────────────────┼─────────────────┤
│ Ada        │ ada@x.io       │ +1 555 0100     │  ← row (aria-selected)
│ Grace      │ grace@x.io     │ +1 555 0101     │  ← selected row (bg-apt-gold/15)
└────────────┴────────────────┴─────────────────┘
```

- Container: `border border-apt-border rounded-lg overflow-auto`.
- Header: `bg-apt-surface-2`, sticky (`position: sticky; top: 0`), `text-apt-text-muted`, mono caption style; a sortable header is a `<button>` with a `ChevronUp`/`ChevronDown` caret in `apt-text-muted`.
- Row: `text-apt-text`, hover `bg-apt-surface-2`, selected `bg-apt-gold/15`; divider `border-apt-border`.
- Column widths come from a CSS grid template built from each column's `width`.
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Default row | `text-apt-text`, transparent background |
| Hover row | `bg-apt-surface-2` |
| Selected row | `bg-apt-gold/15`, `aria-selected="true"` |
| Keyboard-focused row | roving `data-focused`; `aria-activedescendant` points at it |
| Sortable header (active) | `aria-sort` set; caret reflects direction |
| Loading | loading affordance shown in place of rows |
| Empty | `emptyLabel` (default "No items.") shown |

## Accessibility

- `role="grid"` with `aria-label`; header is `role="row"` / `role="columnheader"` (sortable headers set `aria-sort`); body rows are `role="row"` with `aria-selected`; cells are `role="gridcell"`.
- The grid is focusable (`tabIndex=0`); a roving `data-focused` row tracks keyboard focus; `aria-activedescendant` points at it.
- Pointer selection does not steal focus from an open editor elsewhere.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | click-selects-row | click row Ada | selection = `{Ada}`, anchor = Ada |
| T2 | shift-click-extends-range | click Ada, ⇧-click Grace | selection = contiguous Ada…Grace |
| T3 | modifier-click-toggles | ⌘-click selected row | row removed from selection |
| T4 | arrow-key-moves-selection | focus grid, press ↓ | selection moves to next row, clamps at end |
| T5 | shift-arrow-extends-range | anchor set, ⇧+↓ | range extends one row from anchor |
| T6 | space-toggles-focused-row | focus row, press Space | focused row toggles |
| T7 | no-internal-sort, onselectionchange-new-set | click sortable header | `onSortChange` fires with toggled dir; `rows` unchanged by component |
| T8 | selection-by-id | reorder `rows` after selecting | selection preserved across reorder |
| T9 | inert-sort-when-no-handler | render without `onSortChange` | empty + loading states render; headers inert |
| T10 | action-list-mode-when-unselectable | render without `selectedIds`/`onSelectionChange`; click a row | rows carry no `aria-selected`/`data-selected`, no pointer cursor; the click selects nothing; in-cell buttons remain operable |

## Edge Cases

- The ⇧-click range is computed over the **current visible order** of `rows`.
- Ids no longer present in `rows` are pruned by the caller, not the component.
- With `onSortChange` omitted, sortable headers are inert (no sorting offered).
- `loading` and an empty `rows` array each render their dedicated state.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `columns` | `DataTableColumn<T>[]` | — | Column definitions. |
| `rows` | `T[]` | — | Rows already in display order. |
| `getRowId` | `(row: T) => string` | — | Stable id for a row. |
| `selectedIds` | `Set<string>?` | — | Caller-owned selection set. Omit (with `onSelectionChange`) for action-list mode. |
| `onSelectionChange` | `((ids: Set<string>) => void)?` | — | Fired with a new `Set` on every selection edit. Omitting it disables selection entirely (action-list mode). |
| `sort` | `{ key: string; dir: "asc" \| "desc" }` | — | Current sort (caller reorders `rows`). |
| `onSortChange` | `(sort) => void` | — | Sort intent; if omitted, headers are inert. |
| `emptyLabel` | `string` | `"No items."` | Shown when `rows` is empty. |
| `loading` | `boolean` | `false` | Renders the loading state. |
| `ariaLabel` | `string` | — | Required grid label. |
| `className` | `string` | — | Extra classes on the container. |

Column fields: `key: string`, `header: React.ReactNode`, `render?: (row: T) => React.ReactNode` (default `String(row[key])`), `sortable?: boolean`, `width?: string` (e.g. `"12rem"` / `"1fr"`), `align?: "start" | "end"`.

## Logging

No logging. DataTable is a presentational primitive; it emits no structured log events.

## Platform Notes

- New file: `websites/shared/ui/src/components/data-table.tsx` (exported via the `./components/*` wildcard).
- Demo: `websites/local/ui-showcase/app/page.tsx` (regenerate the source registry afterward).
- Consumed by: `ListWithDetailsPane`, `AddUsersModal`.
- Responsive: verify via Playwright (ui-showcase) at 375 / 768 / 1440 — columns and selection stay usable on mobile.

## Design Decisions

- **Caller-owned sorting.** The component reports `onSortChange` and renders `rows` as given, keeping sorting policy with the data owner rather than duplicating it inside the table.
- **Replaces CrudTable.** Supersedes `@adh-shared/crud`'s placeholder-grade `CrudTable`, which is single-purpose and has no selection.
- **Selection is a capability, not a mandate.** Omitting the selection props turns the same grid into an action-list table (admin's users/flags/feedback/api-tokens lists), so sites never fork a second table for rows whose interaction lives in per-cell controls.
- **Internal anchor is private.** The anchor id used for range selection is internal state and is not part of the public API.

## Compliance

No additional compliance categories apply to this presentational primitive.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | Selection made optional: omitting selectedIds/onSelectionChange yields action-list mode (no aria-selected, inert rows, in-cell controls own interaction). |
