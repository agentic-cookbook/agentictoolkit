---
id: 88d69611-4a12-4777-9509-8af6c0626dc7
title: CategoryPickerDialog
domain: agenticdeveloperhub://recipes/category-picker
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-08-23'
modified: '2026-08-23'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Modal tree browser that returns a PLACE in the owner's category hierarchy — a category id or the top level — with filter search, keyboard tree navigation, and OK/Cancel."
platforms:
- typescript
- web
tags:
- component
- category
- picker
- tree
- dialog
- chooser
- ui
depends-on:
- agenticdeveloperhub://recipes/dialog
- agenticdeveloperhub://recipes/dialog-actions
related:
- agenticdeveloperhub://recipes/hierarchical-category-browser
- agenticdeveloperhub://recipes/list-chooser
- agenticdeveloperhub://recipes/entity-chooser
references: []
---

# CategoryPickerDialog

## Overview

`CategoryPickerDialog` is the family's category **picker**: a modal that browses
the owner's whole category hierarchy and returns one **place** in it — a category
id, or (when offered) the top level. It is built directly on the shared `Dialog`
primitives (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogDescription`, `DialogActions`, `Input`, `ErrorText`) rather than on
`ListChooser` or `EntityChooser`: those compose a single-field filter/add control
over a **flat** list, and a place in a tree cannot be expressed as a bare name.

The dialog folds the caller's flat `nodes: CategoryTreeNode[]` into a forest with
`buildCategoryTree` (`category-tree.ts`) on every render of `nodes`, so it always
browses the same materialisation the rail draws. Browsing is a real WAI-ARIA
`tree` — one roving tab stop, arrow-key expand/move/collapse — and typing into the
field switches the list to a flat, trail-annotated filter (`role="listbox"`) so a
match three levels down is found by typing its name rather than walking to it.

It is the modal behind [[hierarchical-category-browser]]'s "Move…" gear action —
the host supplies `disabledIds` (the moved category and its own descendants, so a
category can never become its own ancestor) and `allowRoot` (a move can land a
category at the top level, which is why the root row exists at all). Every word on
screen — `title`, `description`, `confirmLabel`, `rootLabel` — is the host's; this
component owns no copy of its own beyond the two built-in empty messages.

## Behavioral Requirements

- **must-return-a-place-not-a-record**: Confirming MUST call `onConfirm` with either a category id (the selected node) or `null` (the root row), never a name or a record — the picked value is WHERE, not WHAT.
- **must-browse-the-full-forest**: With the filter empty, the dialog MUST render every node `buildCategoryTree(nodes)` yields, each with a chevron toggle when it has children and no toggle when it does not.
- **must-filter-by-substring-with-trail**: Typing in the field MUST narrow the list to nodes whose name contains the typed text (case-insensitive substring), each option showing the "/"-joined names of its ancestors; a node filed under more than one parent MUST appear once, keeping its first (sibling-order) trail.
- **must-offer-a-root-row-only-when-allowed**: The "top level" row (`rootLabel`, default "Top level") MUST render only when `allowRoot` is set, and selecting it MUST make `null` the pending selection.
- **must-disable-forbidden-rows**: A node whose id is in `disabledIds` MUST render visibly disabled and MUST NOT become selectable, in both browse and filter mode.
- **must-preselect-initial-id**: On open, the pending selection MUST start at `initialSelectedId` (or no selection when it is `null`).
- **must-support-tree-keyboard-nav**: In browse mode, ArrowDown/ArrowUp MUST move the roving tab stop to the next/previous VISIBLE row (collapsed children skipped); ArrowRight on a collapsed parent MUST expand it, on an expanded parent MUST move into its first child; ArrowLeft on an expanded parent MUST collapse it, on a leaf or collapsed node MUST move to its parent; Home/End MUST move to the first/last visible row.
- **must-disable-confirm-when-unpickable**: The confirm button MUST be disabled unless the pending selection is confirmable — the root row when `allowRoot`, or a node not in `disabledIds`.
- **must-reset-on-reopen**: Each transition to `open=true` MUST clear the filter text, the expanded set and the roving focus, and MUST reset the pending selection to `initialSelectedId` — a reopen is a fresh question, not a resumed one.
- **must-report-write-errors-inline**: A non-null `error` MUST render above the button bar without closing the dialog; `busy` MUST disable the field and both buttons while a confirm is in flight.
- **must-cancel-without-confirming**: Esc, the Cancel button, or a non-busy outside dismiss MUST call `onCancel` and MUST NOT call `onConfirm`.
- **must-show-empty-messages**: With no categories at all, browse mode MUST show "No categories yet."; with a filter that matches nothing, filter mode MUST show a message naming the typed text.

## Appearance

Filter field, then either the tree or the filtered list, then the button bar:

```
┌───────────────────────────────────────────┐
│ Move "Q3"                                  │  ← title (host's confirmLabel verb elsewhere)
│ Choose where it should sit. Its other      │  ← optional description
│ filings are left alone.                    │
├───────────────────────────────────────────┤
│ [ Filter categories…                    ]  │  ← Input, autoFocus, role="searchbox"
├───────────────────────────────────────────┤
│ ▸ Top level                                │  ← allowRoot row (FolderTree icon)
│ ▾ Work                                     │  ← expanded parent (ChevronDown)
│     Q1                                     │
│     Q2                                     │
│   Planning                                 │  ← collapsed sibling (ChevronRight)
├───────────────────────────────────────────┤
│                         Cancel      Move   │  ← DialogActions; confirm disabled if unpickable
└───────────────────────────────────────────┘
```

Filtering ("q" typed) replaces the tree with a flat `listbox` of matches, each
row showing the match name and its dim, monospace ancestor trail underneath.
Selected row: `bg-apt-gold/15`. Disabled row: `opacity-40`. All color from
`apt-*` tokens; no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Closed | not rendered |
| Open, no selection | confirm disabled; no row shows `bg-apt-gold/15` |
| Row selected (allowed) | `bg-apt-gold/15`; confirm enabled |
| Row selected (forbidden) | cannot occur — a forbidden row cannot be clicked into selection |
| Node collapsed | `ChevronRight`; children not in the DOM or the keyboard order |
| Node expanded | `ChevronDown`; children rendered and reachable by ArrowDown |
| Filtering | tree replaced by a flat `listbox` of trail-annotated matches |
| No categories | "No categories yet." (browse mode only) |
| No filter match | `No categories match "<text>".` |
| `busy=true` | field and both buttons disabled |
| `error` set | `ErrorText` renders above the button bar |

## Accessibility

- Browse mode: the list is `role="tree"` (`aria-label="Categories"`); each row is
  `role="treeitem"` with `aria-selected`, `aria-expanded` (parents only) and
  `aria-disabled` on a forbidden row. Exactly one row carries `tabIndex={0}` (the
  roving tab stop); every other row is `tabIndex={-1}`, so Tab moves past the
  whole tree in one stop and arrow keys move within it (WAI-ARIA tree pattern).
- Filter mode: the list is `role="listbox"` (`aria-label="Categories"`); each row
  is `role="option"` with `aria-selected` / `aria-disabled`.
- The filter field is `role="searchbox"` with `aria-label="Filter categories"`
  and `autoFocus` on open.
- The dialog itself carries the shared `Dialog`'s focus trap, portal and
  Escape-to-close; closing (when not `busy`) returns focus per that primitive.
- Every expand/collapse chevron button carries `aria-label="Expand/Collapse
  <name>"` and is excluded from the tab order (`tabIndex={-1}`) — it is a pointer
  affordance; the same action is reachable from the row via ArrowRight/Left.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-browse-the-full-forest | open with a 2-level forest | roots render; expanding a root reveals its children |
| T2 | must-filter-by-substring-with-trail | type a substring matching a depth-2 node | that node appears as an option with its "/"-joined ancestor trail |
| T3 | must-return-a-place-not-a-record, must-disable-confirm-when-unpickable | open, confirm disabled; click a row, confirm | confirm was disabled with no selection; `onConfirm(nodeId)` fires after the click |
| T4 | must-offer-a-root-row-only-when-allowed | `allowRoot`, select "Top level", confirm | `onConfirm(null)` |
| T5 | must-disable-forbidden-rows | `disabledIds=[x]`, click row x | row x stays unselected; confirm stays disabled |
| T6 | must-cancel-without-confirming | open, click Cancel | `onCancel` fires; `onConfirm` never fires |
| T7 | must-support-tree-keyboard-nav | roving stop on a collapsed parent; ArrowRight, ArrowDown, ArrowUp | ArrowRight expands it; ArrowDown moves into its now-visible first child, skipping collapsed siblings; ArrowUp reverses |
| T8 | must-support-tree-keyboard-nav | roving stop on an expanded parent's child; ArrowLeft, ArrowLeft again | first collapses the parent; second moves the stop to the parent |
| T9 | must-support-tree-keyboard-nav | Home, then End | roving stop moves to the first, then the last, visible row |
| T10 | must-preselect-initial-id, must-reset-on-reopen | open with `initialSelectedId="x"`, close, reopen with the same prop | selection starts at x both times; filter/expanded state is empty each open |
| T11 | must-report-write-errors-inline | `error="conflict"`, `busy` | error text shown above the buttons; field and both buttons disabled |
| T12 | must-show-empty-messages | `nodes=[]` (browse); a filter matching nothing | "No categories yet."; `No categories match "<text>".` |

## Edge Cases

- **Empty vocabulary.** `nodes=[]` renders no rows in browse mode and only the
  root row (if `allowRoot`) — never an error state; see T12.
- **A category filed under two parents.** It draws once per placement in browse
  mode (the same node, two different `path`s — `categoryKey` disambiguates the
  React keys), but the FILTER list dedupes it to one option by `id`, keeping the
  first placement's trail — a filter result is one id, so it must read as one
  option (see `category-picker-dialog.tsx`'s `dedupeById`).
- **A cycle in legacy data.** The dialog never sees the raw edges — `nodes` is
  already the flat `CategoryTreeNode[]` a caller passes through `buildCategoryTree`
  itself (this component calls it once more, on the same input), and that fold's
  own cycle-breaking (re-seeding an orphaned branch as a root) is what determines
  what the tree shows; see [[hierarchical-category-browser]] for the fold's
  contract. The dialog adds no cycle handling of its own — it only walks what the
  fold hands back.
- **The `MAX_TREE_NODES` cap (4000).** A forest at the cap still renders and is
  still fully keyboard-navigable — the fold stops MATERIALISING nodes, not the
  dialog from walking whatever it received; a picker over a capped forest simply
  cannot offer the nodes that were never drawn.
- **Whitespace-only filter text.** Trimmed before matching; an all-whitespace
  filter behaves as no filter (browse mode, not an empty-match message).
- **Reopening on a stale `initialSelectedId`.** If the id no longer exists in
  `nodes`, no row shows as selected and confirm stays disabled until a fresh pick
  — the dialog does not fall back to the root or the first row.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | — | Controls the `Dialog`. |
| `nodes` | `readonly CategoryTreeNode[]` | — | The owner's whole vocabulary; folded internally with `buildCategoryTree`. |
| `title` | `string` | — | Dialog title — the host's words. |
| `description` | `React.ReactNode` | — | Optional dialog description. |
| `confirmLabel` | `string` | — | The confirm button's verb ("Move", "Choose…") — the host's, because only it knows what the pick is for. |
| `disabledIds` | `readonly string[]` | `[]` | Ids that cannot be picked — for a move, the category itself and its descendants. |
| `allowRoot` | `boolean` | `false` | Offers a "no parent" row that confirms with `null`. |
| `rootLabel` | `string` | `"Top level"` | Copy for the root row. |
| `initialSelectedId` | `string \| null` | `null` | Pre-selected category id. |
| `error` | `string \| null` | `null` | A rejected confirm's message — the host owns it. |
| `busy` | `boolean` | `false` | Disables the field and both buttons while a confirm is in flight. |
| `onConfirm` | `(categoryId: string \| null) => void` | — | Fired on confirm with the pending selection. |
| `onCancel` | `() => void` | — | Fired on Cancel, Esc, or a non-busy outside dismiss. |

Exports: `CategoryPickerDialog`, `CategoryPickerDialogProps`.

## Logging

None — a presentational control. The host performs the write the confirmed id
drives and owns any telemetry for it.

## Platform Notes

- **React / Web (TypeScript):** `packages/web/packages/ui/src/blocks/category-picker-dialog.tsx`. `"use client"`.
- Consumes `buildCategoryTree`, `categoryKey`, `CategoryNode`, `CategoryTreeNode` from the sibling `category-tree.ts` — the single fold every hierarchical category surface reads (see [[hierarchical-category-browser]]).
- Demo: `local/ui-showcase/app/page.tsx` (Topic id `category-picker`) + the showcase source registry.
- First (and so far only) consumer: [[hierarchical-category-browser]]'s Move action.
- Responsive: verify via the ui-showcase demo at 375 / 768 / 1440 — the dialog's own `max-w-md` and internal scroll (`max-h-72`) keep it usable at phone width; keyboard-only and pointer flows both apply at every width.

## Design Decisions

- **A tree, not `ListChooser`/`EntityChooser`'s flat filter-and-add.**
  [[list-chooser]] and [[entity-chooser]] both pick a RECORD from a flat set —
  the correct model when a name is already a unique, sufficient answer (a
  document's category via `CategoryField`, or a tag). This dialog picks a
  **place** in a tree — a parent — and a place cannot be named without saying
  where it sits; "no parent (make it a root)" is a legitimate answer neither
  chooser can express (`ListChooser`/`EntityChooser` have no concept of nesting,
  let alone an explicit top-level option). So the tree is the primary control
  here and the filter is a shortcut into it, the reverse of `ListChooser`'s
  filter-is-everything model. `CategoryField`'s own chooser (the document-level
  "pick a category by name" control) makes the identical trade the other way,
  for the identical reason: names are unique per owner across the whole
  hierarchy, so a bare name is already an exact address there, and walking a
  tree to find what typing three characters already resolves would be slower,
  not more precise. `CategoryField` is shipped but has no recipe of its own yet;
  the contrast lives here because a reader comparing the two pickers is most
  likely to land on this file first.
- **Compose the base `Dialog`, not `AlertModal`.** [[alert-and-dialog]]'s
  `AlertModal` is an alert/confirm shape with a single description slot; this
  dialog needs an interactive tree body, a search field, and an OK that is
  conditionally disabled on a live selection — none of which fits the
  alert/confirm contract. Building on the plain `Dialog` primitives keeps the
  focus trap, portal and Escape-close shared without forcing an ill-fitting
  shape onto them.
- **Filter dedupes by id; browse does not.** Browsing shows every real placement
  (the honest DAG picture the rail itself shows); a filter result is read as one
  answer per id, so showing the same category twice there would look like two
  different categories. Deduping only the filter view keeps both readings correct
  for what each is for.
- **The fold runs again here, not passed in pre-built.** Taking `nodes:
  CategoryTreeNode[]` rather than a pre-built `CategoryNode[]` keeps this
  component's public contract independent of the internal fold's shape, and lets
  any caller with the flat rows open the picker without importing
  `buildCategoryTree` itself. `buildCategoryTree` is deterministic and cheap
  enough (bounded by `MAX_TREE_NODES`) that recomputing it here costs nothing a
  memoized caller would save.
- **No built-in async state.** `nodes` is a controlled in-memory prop; the host
  owns fetching, loading and error, and reports a REJECTED confirm through
  `error`/`busy` — consistent with the sibling form controls ([[list-chooser]],
  [[entity-chooser]]).

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — `apt-*` tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |
| Live demo exists in ui-showcase (`category-picker`) | passed | demo-exists |
| Base UI only (via shared `Dialog`), never Radix | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-08-23 | Mike Fullerton | Initial component + recipe. |
