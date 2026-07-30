---
id: e1859aa2-d0c4-4d9a-b926-203dd5fbbca3
title: "AddUsersModal"
domain: agenticdeveloperhub://recipes/add-users-modal
type: recipe
version: 1.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-06-26
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A controlled dialog that stages users in a growing DataTable via an inline entry row, then hands the collected rows to an onAdd callback."
platforms:
  - typescript
  - web
tags:
  - modal
  - dialog
  - table
  - users
ingredients:
  - agenticdeveloperhub://recipes/data-table
  - agenticdeveloperhub://recipes/alert-and-dialog
depends-on: []
related: []
references: []
---

# AddUsersModal

## Overview

A modal in `@agentic-toolkit/ui` for building a list of users to add. It composes
`Dialog` + `DataTable` + `Input` + `AlertModal` + `Button`. Each "Add" appends
the entry row to a table above; the dialog's final "Add" hands the rows to a
caller callback (`onAdd`) — stubbed in Phase 2, wired in Phase 3.

It is a controlled dialog: a growing `DataTable` of staged users on top, an
inline entry row (name / email / phone / admin note) below it with an **Add**
button, and a footer (Cancel / Add).

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| DataTable | agenticdeveloperhub://recipes/data-table | Growing table of staged `DraftUser` rows | yes | columns Name · Email · Phone · Admin note; selection; empty label |
| AlertAndDialog | agenticdeveloperhub://recipes/alert-and-dialog | The modal `Dialog` shell (`DialogContent max-w-2xl`) + the discard-confirm `AlertModal` | yes | modal semantics; discard-confirm copy |

Composed shared primitives without their own recipe domains: `Input` and `Field`
(the entry row inputs) and `Button` (entry Add + footer Cancel/Add).

## Integration Requirements

- **must-add-row-on-enter-or-button**: The AddUsersModal MUST append a `DraftUser`
  to the staged `DataTable`, clear the entry fields, and refocus the Name input
  when Enter is pressed in any entry field or the entry **Add** button is
  activated.
- **must-ignore-blank-entry**: The AddUsersModal MUST treat a fully blank entry
  (no name and no contact — email/phone) as a no-op and MUST NOT append a row,
  mirroring the invitation contact rule.
- **must-keep-tab-order**: The entry row MUST follow tab order Name → Email →
  Phone → Note → **Add**, with the Add button reached as the next tab stop after
  Note via a flexible spacer.
- **must-disable-footer-add-when-empty**: The footer **Add** button MUST be
  `disabled` while the staged `DataTable` contains no rows.
- **must-call-onadd-and-close**: Activating the footer **Add** MUST call
  `onAdd(stagedRows)` and close the dialog.
- **must-confirm-cancel-when-dirty**: Cancel, Esc, or a backdrop click MUST open a
  discard-confirm `AlertModal` when the staged table has rows OR the entry row has
  content; otherwise it MUST close immediately. State resets on close.
- **must-block-dismissal-when-busy**: When `busy` is true the AddUsersModal MUST
  show a spinner and MUST block dismissal (Esc, backdrop, Cancel).

## Layout

```
┌ Add users ─────────────────────────────────────────────────────┐
│  DataTable: Name · Email · Phone · Admin note                   │  staged rows
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Ada     │ ada@x.io   │ +1 555 0100 │ priority             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [ name ][ email ][ phone ][ admin note ]        ……    [ Add ]  │  entry row
│                                                                 │
│                                       [ Cancel ]   [ Add ]      │  footer
└─────────────────────────────────────────────────────────────────┘
```

- `DialogContent` (`max-w-2xl` — the table needs width); the staged `DataTable`
  above; the entry row a `flex items-end gap-2` of `Field`-wrapped `Input`s + a
  `flex-1` spacer + the Add `Button`. Footer right-justified `[ Cancel ][ Add ]`.
- The staged table supports `DataTable` selection; staged rows can be removed (a
  per-row `×` or a Remove affordance) — optional, but at minimum the table shows
  what is queued.
- No raw hex; no `!important`.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| stagedRows (`DraftUser[]`) | AddUsersModal | DataTable, footer Add (enabled state), `onAdd` | Down / Up | Component state + prop; `onAdd` callback |
| entryFields {name, email, phone, note} | AddUsersModal | Entry `Input`s | Down / Up | Component state + input `onChange` |
| discardConfirm open | AddUsersModal | AlertAndDialog (AlertModal) | Down | Boolean state |
| busy | Caller | Footer Add + dismissal guard + spinner | Down | Prop |
| open | Caller | Dialog | Down | Prop (`open`); `onClose` callback up |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-add-row-on-enter-or-button | Type a name, press Enter in a field | Row appended to staged table; entry cleared; Name refocused |
| T2 | must-ignore-blank-entry | Empty entry, press Enter / activate Add | No row added (no-op) |
| T3 | must-disable-footer-add-when-empty | 0 staged rows | Footer Add disabled |
| T4 | must-disable-footer-add-when-empty | ≥1 staged row | Footer Add enabled |
| T5 | must-call-onadd-and-close | Footer Add with staged rows | `onAdd(stagedRows)` called; dialog closes |
| T6 | must-confirm-cancel-when-dirty | Cancel with staged rows or entry content | Discard-confirm `AlertModal` opens |
| T7 | must-confirm-cancel-when-dirty | Cancel with empty table and empty entry | Closes immediately, no confirm |
| T8 | must-block-dismissal-when-busy | `busy=true`, press Esc / click backdrop / Cancel | Dismissal blocked; spinner shown |
| T9 | must-keep-tab-order | Tab from Note | Focus lands on the Add button |

## Edge Cases

- A fully blank entry is a no-op; a row needs at least a name OR a contact
  (email/phone) to be added.
- Footer Add is disabled at 0 staged rows; an empty staged table shows the
  `DataTable` empty label.
- `busy` blocks Esc / backdrop / Cancel dismissal and shows a spinner.
- Cancel / Esc / backdrop with a dirty state (rows or entry content) opens the
  discard confirm; with a clean state it closes immediately.
- State resets on close, so reopening starts with an empty entry row and table.

## Platform Notes

- **React / Web (TypeScript):** New block at
  `websites/shared/ui/src/blocks/add-users-modal.tsx`. Composes `Dialog*`,
  `DataTable`, `Input`, `Field`, `AlertModal`, `Button`. Consumed by the admin
  "Pending Users" topic (sub-project 4) "Add users" action. Add a demo to
  `ui-showcase` (+ regenerate sources).
- **Responsive:** Verify via Playwright (ui-showcase) at 375 / 768 / 1440 — the
  staging table and entry row stay usable on mobile.
- **SwiftUI / Compose:** Not applicable — web-only shared block.

API (`@agentic-toolkit/ui/blocks/add-users-modal`):

```ts
interface DraftUser { name: string; email: string; phone: string; note: string }
interface AddUsersModalProps {
  open: boolean
  onAdd: (users: DraftUser[]) => void
  onClose: () => void
  busy?: boolean
  title?: string        // default "Add users"
}
export function AddUsersModal(props: AddUsersModalProps): React.ReactElement
```

Accessibility: `Dialog` modal semantics + focus trap/restore; entry inputs are
labeled (`Field`). Tab order is explicit and lands on Add after Note; Enter-to-add
keeps focus flowing back to Name for fast repeated entry. The empty staged table
shows the `DataTable` empty label.

## Design Decisions

- **Decision**: A row needs at least a name or a contact to be added; a blank
  entry is a no-op. **Rationale**: Mirrors the invitation contact rule and avoids
  staging empty rows.
- **Decision**: Enter-to-add refocuses Name. **Rationale**: Enables fast repeated
  keyboard entry.
- **Decision**: Explicit tab order ends on Add after Note via a flexible spacer.
  **Rationale**: Predictable keyboard flow to the primary entry action.
- **Decision**: Cancel confirms only when dirty. **Rationale**: Avoids nagging the
  user when there is nothing to lose.
- **Decision**: `onAdd` is stubbed in Phase 2 and wired in Phase 3. **Rationale**:
  Phased rollout of the feature.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
