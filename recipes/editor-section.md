---
id: 5a028319-034c-4852-a1ee-01247a747183
title: EditorSection
domain: agenticdeveloperhub://recipes/editor-section
type: recipe
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Master/detail editor shell — a pure assembly of the editing ButtonBar, the collapsible topic rail with per-row warn badges, and the shared EmptyState."
platforms:
- typescript
- web
tags:
- master-detail
- editor
- layout
- toolbar
ingredients:
- agenticdeveloperhub://recipes/topic-detail
- agenticdeveloperhub://recipes/button-bar
- agenticdeveloperhub://recipes/empty-state
depends-on: []
related:
- agenticdeveloperhub://recipes/list-with-details-pane
references: []
---

# EditorSection

## Overview

`EditorSection` in `@agentic-toolkit/ui/blocks/editor-section` is the platform's
standard master/detail **editor shell**: a records rail on the left, an editing
detail pane on the right, and a fixed editing toolbar across the top. It is a
**pure assembly** — it owns no visual grammar of its own. It stacks three shared
blocks:

1. a `ButtonBar` (the recessed editing strip) carrying a gold mono title on the
   left and the standard **New / Delete / Cancel / Save** action preset on the
   right;
2. a `TopicDetail` two-pane primitive whose collapsible rail lists the records
   (each row may show a `⚠` warn badge), and
3. the shared `EmptyState` placeholder, shown in the detail pane whenever nothing
   is selected.

The consumer owns all state — the record list, the current selection, the draft
and its `dirty` flag, the `busy` (saving) flag, and every mutation callback.
`EditorSection` maps that state onto the three parts and computes the derived
"editing" condition (a selection exists) and the derived Save/Delete enablement.
`children` is the record's editor form, rendered in the pane only while editing.

It is the base editor shell behind hub/admin topics that manage a list of records
(sites, integrations, personas, …) and is reusable platform-wide.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| ButtonBar | agenticdeveloperhub://recipes/button-bar | The fixed editing toolbar: gold mono title (`leading`) + the New/Delete/Cancel/Save preset | yes | `leading` = title + `titleBadge`; `actions` = `{ onCreate, createLabel, onCancel, canCancel, onSave, canSave, saving, onDelete, canDelete }`; `showDelete` = `!!onDelete` |
| TopicDetail | agenticdeveloperhub://recipes/topic-detail | The two-pane rail\|pane primitive: collapsible records rail + detail pane | yes | `items` (mapped from `EditorSectionItem[]`), `selectedId`, `onSelect`, `emptyLabel` = `emptyList`, `railSlot` = `listHeader`, `railWidth`, `panePadding={false}` |
| EmptyState | agenticdeveloperhub://recipes/empty-state | The "nothing selected" placeholder rendered in the pane when not editing | yes | `title` = `emptyDetail`; fixed `className="m-3.5 min-h-[200px] flex-1"` |

Composed shared primitives without their own recipe domains: `Badge`
(`variant="accent"`) for the `⚠ N` count badge on warned rows.

## Integration Requirements

- **must-render-title-in-toolbar**: The EditorSection MUST render `title` (and the
  optional `titleBadge` accessory) as the leading content of the `ButtonBar`, in
  the gold mono title treatment.
- **must-derive-editing-from-selection**: The EditorSection MUST treat a non-null
  `selectedId` as "editing", and a null `selectedId` as "nothing selected".
- **must-show-detail-while-editing**: The EditorSection MUST render `children` in
  the detail pane while editing, and MUST render the `EmptyState` (titled
  `emptyDetail`) in the pane while nothing is selected.
- **must-gate-save-on-dirty-selection**: The EditorSection MUST enable Save only
  when editing AND `dirty` is true; otherwise Save MUST be disabled.
- **must-gate-cancel-on-editing**: The EditorSection MUST enable Cancel only while
  editing.
- **must-default-can-delete-to-editing**: The EditorSection MUST default the Delete
  enablement to "a record is selected" (`canDelete ?? editing`), and MUST honor an
  explicit `canDelete={false}` so Delete is not offered on an unsaved/new draft.
- **must-disable-delete-while-busy**: The EditorSection MUST disable Delete while
  `busy` is true.
- **must-omit-delete-when-no-handler**: The EditorSection MUST hide the Delete
  button (`showDelete={false}`) when no `onDelete` handler is supplied.
- **must-render-warn-badge-per-row**: For a record with `warn` true, the
  EditorSection MUST render a trailing warning on its rail row — a `⚠ N` accent
  `Badge` when `warnCount` is set, otherwise a bare `⚠` — carrying `warnTitle` as
  its title/aria-label; a record with `warn` falsy MUST render no trailing warning.
- **must-surface-mutation-error**: When `error` is set, the EditorSection MUST
  surface it as a red line directly beneath the toolbar; when `error` is absent it
  MUST render no error line.
- **must-collapse-list-header-when-collapsed**: The EditorSection MUST place
  `listHeader` in the rail's leading slot and MUST hide it while the rail is
  collapsed.

## Layout

```
┌ ButtonBar (role=toolbar) ───────────────────────────────────────────────┐
│ ⬤ title  [titleBadge]      + New │ 🗑 Delete … ✕ Cancel   ✓ Save          │
├──────────────────────────────────────────────────────────────────────────┤
│ error (red line, only when `error` set)                                   │
├──────────────┬───────────────────────────────────────────────────────────┤
│ rail (TopicDetail, collapsible)  │  detail pane                           │
│  [listHeader]                    │                                        │
│  ▸ record label       ⚠         │   editing → children (record form)     │
│    sublabel                      │                                        │
│  ▸ record label       ⚠ 5       │   not editing → EmptyState(emptyDetail) │
│  ▸ record label                  │                                        │
│  (empty → emptyList)             │                                        │
└──────────────┴───────────────────────────────────────────────────────────┘
```

- Root is a full-height `flex min-h-0 flex-1 flex-col` column so the rail/pane fill
  the container; give the parent a height.
- Toolbar: the `ButtonBar` recessed strip; title is `font-mono text-[13px]
  text-apt-gold` with the optional `titleBadge` beside it.
- Error line: `shrink-0 border-b border-apt-border px-3.5 py-1.5 font-mono text-xs
  text-apt-red`, only present when `error` is set.
- Rail + pane come from `TopicDetail` with `panePadding={false}` (each row/pane
  supplies its own inset); rail width defaults to the standard rail and widens via
  `railWidth` for long identifier rows.
- The pane's `EmptyState` uses the fixed `m-3.5 min-h-[200px] flex-1` inset.
- No raw hex; no `!important` (all color via `apt-*` tokens).

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| `items` (`EditorSectionItem[]`) | Caller | TopicDetail rail (mapped to `TopicDetailItem[]`) | Down | Prop |
| `selectedId` (`string \| null`) | Caller | TopicDetail selection + editing/EmptyState choice + can* flags | Down | Prop |
| `dirty` | Caller | ButtonBar `canSave` | Down | Prop |
| `busy` | Caller | ButtonBar `saving` + Delete disablement | Down | Prop |
| `canDelete` | Caller (or derived from `selectedId`) | ButtonBar Delete enablement | Down | Prop, default `?? editing` |
| `error` | Caller | Error line under the toolbar | Down | Prop |
| selected id on row click | TopicDetail rail | Caller `onSelect(id)` | Up | Callback |
| New / Delete / Cancel / Save intents | ButtonBar | Caller `onNew` / `onDelete` / `onCancel` / `onSave` | Up | Callbacks |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-derive-editing-from-selection, must-show-detail-while-editing | `selectedId = null` | Pane shows the `EmptyState` titled `emptyDetail`; `children` not rendered |
| T2 | must-show-detail-while-editing | `selectedId = "r1"` | Pane renders `children` (the record form); no `EmptyState` |
| T3 | must-render-title-in-toolbar | `title="Sites"`, `titleBadge=<Badge/>` | Toolbar leading shows the gold mono title with the badge beside it |
| T4 | must-gate-save-on-dirty-selection | editing, `dirty=false` | Save disabled |
| T5 | must-gate-save-on-dirty-selection | editing, `dirty=true` | Save enabled (gold) |
| T6 | must-gate-cancel-on-editing | `selectedId=null` | Cancel disabled |
| T7 | must-default-can-delete-to-editing | editing, `canDelete` unset | Delete enabled |
| T8 | must-default-can-delete-to-editing | editing, `canDelete={false}` (new draft) | Delete disabled |
| T9 | must-disable-delete-while-busy | editing, `busy=true` | Delete disabled; Save shows "Saving…" |
| T10 | must-omit-delete-when-no-handler | `onDelete` omitted | No Delete button rendered |
| T11 | must-render-warn-badge-per-row | item `{ warn:true, warnCount:5, warnTitle }` | Row trailing shows a `⚠ 5` accent Badge with `warnTitle` |
| T12 | must-render-warn-badge-per-row | item `{ warn:true }` (no count) | Row trailing shows a bare `⚠`; a non-warned row shows nothing |
| T13 | must-surface-mutation-error | `error="Save failed"` | Red error line renders under the toolbar; absent when `error` unset |
| T14 | must-collapse-list-header-when-collapsed | `listHeader` set, rail collapsed | `listHeader` hidden while collapsed, shown while expanded |

## Edge Cases

- Nothing selected (`selectedId === null`): the pane shows `EmptyState`, Cancel and
  Save are disabled, and Delete defaults to disabled (nothing to delete).
- New/unsaved draft: the consumer passes `canDelete={false}` so Delete is not
  offered for a row that isn't persisted yet, even though a draft is being edited.
- Empty record list: the rail shows `emptyList` (falling back to "Nothing here
  yet." when omitted).
- `busy` (saving) in flight: Save renders "Saving…" and Delete is disabled so a
  record can't be deleted mid-save.
- A row without `warn` renders no trailing accessory; a row with `warn` but no
  `warnCount` renders a bare `⚠` rather than a count badge.
- Rows whose labels are long identifiers (URLs): widen the rail via `railWidth`.
- The rail is always collapsible (a core `TopicDetail` behavior); collapsing hides
  the `listHeader` and each row's warn badge/label, leaving the icon strip.

## Platform Notes

- **React / Web (TypeScript):** Block at
  `websites/shared/ui/src/blocks/editor-section.tsx`, exported via `./blocks/*`.
  Assembles `ButtonBar`, `TopicDetail` (+ `TopicDetailItem`), `EmptyState`, and
  `Badge` — all from `@agentic-toolkit/ui`. Adds no new visual primitives.
- Demo: `ui-showcase` Topic `editor-section` (regenerate `sources.generated.ts`
  via `gen-sources.py` after source changes).
- **Responsive:** Verify via Playwright (ui-showcase) at 375 / 768 / 1440 — the
  rail collapses to an icon strip and the toolbar wraps sensibly on mobile (both
  are `TopicDetail`/`ButtonBar` behaviors).
- **SwiftUI / Compose:** Not applicable — web-only shared block.

API (`@agentic-toolkit/ui/blocks/editor-section`):

```ts
interface EditorSectionItem {
  id: string
  label: string
  sublabel?: string
  icon?: React.ReactNode      // 16px leading icon (rail fills a neutral ring if omitted)
  warn?: boolean              // shows a ⚠ at the row's right edge
  warnTitle?: string
  warnCount?: number          // when set (and warn), renders a "⚠ N" count badge
}
interface EditorSectionProps {
  title: React.ReactNode
  titleBadge?: React.ReactNode
  createLabel: string
  items: EditorSectionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete?: () => void        // omit → no Delete button
  onCancel: () => void
  onSave: () => void
  dirty: boolean
  busy?: boolean               // default false
  canDelete?: boolean          // default: "anything selected"
  error?: React.ReactNode      // red line under the toolbar
  emptyList?: React.ReactNode  // rail empty label; default "Nothing here yet."
  emptyDetail: React.ReactNode // EmptyState title when nothing selected
  listHeader?: React.ReactNode // rail leading slot; hidden while collapsed
  railWidth?: number           // widen for long-identifier rails
  children: React.ReactNode    // the record editor form, shown while editing
  className?: string
}
export function EditorSection(props: EditorSectionProps): React.ReactElement
```

Accessibility: the toolbar is `role="toolbar"` (via `ButtonBar`) with labeled
buttons whose `disabled` reflects the editing/dirty/busy state; each warn badge
carries `warnTitle` as its title/aria-label; the rail's selection and collapse
behaviors come from `TopicDetail`.

## Design Decisions

- **Decision**: `EditorSection` is a pure assembly with no visual grammar of its
  own. **Rationale**: Every editor topic must look identical; delegating all
  appearance to `ButtonBar` + `TopicDetail` + `EmptyState` keeps one blessed home
  for each part and avoids drift (optimize-for-change).
- **Decision**: The consumer owns all state (list, selection, draft, dirty, busy,
  error) and callbacks. **Rationale**: The shell computes only derived enablement;
  keeping the source of truth outside makes it reusable across every record type.
- **Decision**: "Editing" is derived from `selectedId !== null`, and Save from
  `editing && dirty`. **Rationale**: One selection prop drives both the pane
  choice and the toolbar enablement, so callers can't put the two out of sync.
- **Decision**: `canDelete` defaults to "anything selected" but honors an explicit
  `false`. **Rationale**: The common case needs no wiring, while a new/unsaved
  draft can suppress a Delete that would target a non-row.
- **Decision**: Warn rendering is data-driven from `warn`/`warnCount`/`warnTitle`
  on each item, mapping to a `Badge` or a bare `⚠`. **Rationale**: The rail stays a
  generic `TopicDetail`; the "needs configuration" affordance is expressed as data,
  not a new rail feature.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| No raw hex / arbitrary colors / `!important` | passed | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | passed | project-guidelines UI |
| Toolbar `role="toolbar"` + labeled, state-aware buttons | passed | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the EditorSection assembly of ButtonBar + TopicDetail + EmptyState. |
