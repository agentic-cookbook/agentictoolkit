---
id: 26df832c-a7f7-4cf6-b3f5-240c61e8bd68
title: InlineCommitControl
domain: agenticdeveloperhub://recipes/inline-commit-control
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-07'
modified: '2026-07-07'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Right-justified inline ✓/✕ commit pair for in-place row editing, with a hover-revealed trash that arms a strikethrough pending delete."
platforms:
- typescript
- web
tags:
- editing
- inline-edit
- commit
- delete
- table
- ui
depends-on: []
related:
- data-table
- button
- alert-modal
references: []
---

# InlineCommitControl

## Overview

The inline commit control lives right-justified inside (or adjacent to) an
editable element — canonically the last cell of a DataTable row. While the
element's data is clean it stays out of the way (at most a hover-revealed
trash affordance); the moment the data goes dirty it shows a ✓ (commit) / ✕
(cancel) icon-button pair that persists until the edits are saved or
discarded. It also owns the inline delete grammar: the trash arms a *pending*
delete — the consumer dims and strikes the content — and the same ✓ then
commits the removal.

Three cooperating exports form the pattern, all from
`@agentic-toolkit/ui/components/inline-commit-control` (plus the sibling
`unsaved-changes-guard`):

- `InlineCommitControl` — the stateless control itself.
- `InlineEditableText` — click-to-edit text (the shared `Input` with its field
  shell suppressed until hover/focus) whose edits make the row dirty. A
  `variant` (`mono` / `muted`) applies the two typography treatments consumers
  were overriding by hand (keys/identifiers vs. secondary text).
- `inlineCommitDeletingClass` — the class the consumer applies to content
  while its delete is armed (dim + strikethrough).
- `UnsavedChangesGuard` — page-level guard: while anything is dirty,
  navigation raises a confirm dialog (in-app links via the platform
  AlertModal, hard navigation via `beforeunload`, Back/Forward via a
  history sentinel, and opted-in programmatic navigation via the
  navigation-guard registry).
- `useInlineDrafts` (`@agentic-toolkit/ui/hooks/useInlineDrafts`) — the
  optional per-row state machine consumers were copy-pasting: PATCH-based
  drafts (only touched fields, so a commit never clobbers a field a
  background refetch changed), per-row in-flight gating, per-row errors, and
  `settle` (keeps keystrokes typed while a commit was in flight).

The consumer owns the data — draft values, dirty computation, the armed
delete — mirroring ButtonBar's contract; the control just renders it. The
`useInlineDrafts` hook is the shared implementation of that state, not a
requirement (any data layer plugs in).

## Behavioral Requirements

- **must-hide-when-clean**: The control MUST render nothing while the data is
  clean, except the delete affordance when the data is deletable.
- **must-reveal-trash-on-hover**: When clean and deletable, the control MUST
  reveal a trash icon button on hover of its enclosing hover scope
  (`inlineCommitHoverScopeClass`; DataTable rows provide it) and on keyboard
  focus.
- **must-show-pair-when-dirty**: The control MUST show the ✓/✕ pair whenever
  the data is dirty, and keep showing it until the edits are committed or
  cancelled.
- **must-commit-on-ok**: Clicking ✓ MUST invoke the consumer's commit action
  (save to the backing store); the consumer hides the control by clearing the
  dirty state on success.
- **must-cancel-on-x**: Clicking ✕ MUST invoke the consumer's cancel action,
  reverting the draft to the committed data.
- **must-arm-delete**: Clicking the idle trash MUST arm a pending delete
  rather than deleting immediately.
- **must-render-armed-delete**: While a delete is armed the control MUST show
  ✓ ✕ followed by a red trash as the right-most button, and the consumer MUST
  dim and strike the affected content (`inlineCommitDeletingClass`).
- **must-commit-armed-delete**: Clicking ✓ while a delete is armed MUST invoke
  the consumer's commit action, which performs the delete.
- **must-disarm-delete**: Clicking ✕ (or the armed red trash) while a delete
  is armed MUST disarm it, restoring the content's normal rendering without
  deleting.
- **must-disable-while-busy**: While a commit is in flight the control MUST
  neutralize its buttons (ignore clicks) and indicate progress in place of the
  ✓. It MUST use `aria-disabled` rather than the `disabled` attribute, so the
  button keeps keyboard focus across the in-flight transition.
- **must-edit-in-place**: Editable text using `InlineEditableText` MUST become
  editable with a single click in place, and edits MUST make the row dirty.
- **must-guard-navigation-when-dirty**: While any attached data is dirty, the
  page MUST prevent navigation without a confirmation dialog
  (`UnsavedChangesGuard`): in-app link clicks raise the platform AlertModal
  confirm; reload/close raises the browser's native leave prompt; Back/Forward
  raises the AlertModal (via a same-URL history sentinel); and chrome that
  navigates programmatically (menus, choosers, logout) raises it too when it
  awaits `confirmNavigation()` from the navigation-guard registry.
- **should-route-keyboard**: `InlineEditableText` SHOULD route Enter to the
  row's commit action and Escape to its cancel action; a consumer-supplied
  `onKeyDown` runs FIRST and may `preventDefault()` to suppress that routing.
- **should-preserve-focus**: The control SHOULD keep keyboard focus coherent
  across state changes — arming a delete focuses the ✓ (confirming is one
  keypress); committing/cancelling re-anchors focus on the idle trash.

## Appearance

- The control is right-justified in the row/element it annotates, composed
  entirely from the shared `Button` (`ghost` / `destructive-ghost`,
  `icon-sm`) — no bespoke buttons.
- ✓ uses the gold primary accent (`apt-gold`), ✕ the muted text tone
  (`apt-text-muted`), the armed trash the destructive red tone.
- The idle trash is invisible (`opacity-0`) until the hover scope is hovered
  or the button is focused; the reveal is an opacity transition.
- Armed-delete content is dimmed to 50% opacity with a strikethrough
  (`inlineCommitDeletingClass = "opacity-50 line-through"`).
- `InlineEditableText` renders as plain text (transparent field shell) that
  regains the field border on hover and the standard gold focus ring while
  editing.

## States

| State | Appearance change |
|---|---|
| clean, not deletable | Nothing rendered |
| clean, deletable | Trash button, hidden until row hover / focus |
| dirty | ✓ (gold) + ✕ (muted) pair, always visible |
| delete armed | ✓ ✕ + red trash (right-most, `aria-pressed`); content dimmed + struck |
| busy | Pair soft-disabled (`aria-disabled`, clicks ignored, focus kept); ✓ replaced by a spinner; group `aria-busy` |

## Accessibility

- Every button has an `aria-label`/`title`, suffixed with the consumer's
  `subject` (e.g. "Save changes flag beta") so rows are distinguishable to
  screen readers.
- The pending pair is wrapped in `role="group"` with a state-describing label
  ("Commit changes …" / "Confirm deleting …") and `aria-busy` while a commit
  is in flight.
- The armed trash carries `aria-pressed` to expose the armed state.
- The hover-hidden trash becomes visible on keyboard focus
  (`focus-visible:opacity-100`), so delete is keyboard-operable; while hidden
  it is also `pointer-events-none`, so a blind touch tap (no hover) can't arm
  a delete.
- Focus is preserved across state transitions: arming focuses the ✓;
  committing/cancelling re-anchors on the idle trash. Because busy uses
  `aria-disabled` (not `disabled`), an in-flight commit never drops focus.
- `InlineEditableText` requires an `aria-label` (its shell is invisible at
  rest, so there is no visible label) and supports Enter/Escape.
- The navigation guard's dialog is the platform AlertModal (focus trap,
  destructive keyboard policy).

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-hide-when-clean | `dirty=false`, `deletable=false` | Renders nothing |
| T2 | must-reveal-trash-on-hover, must-arm-delete | `dirty=false`, `deletable`, click trash | `onDelete` fired once; nothing deleted |
| T3 | must-show-pair-when-dirty, must-commit-on-ok, must-cancel-on-x | `dirty`, click ✓ then ✕ | `onCommit` ×1, `onCancel` ×1 |
| T4 | must-render-armed-delete, must-commit-armed-delete, must-disarm-delete | `deleting`, click ✓; click armed trash | Red trash rendered `aria-pressed`; `onCommit` ×1; `onDelete` ×1 |
| T5 | must-disable-while-busy | `dirty`, `busy`, click ✓/✕ | ✓/✕ `aria-disabled`, still focusable; clicks ignored (`onCommit`/`onCancel` not called); group `aria-busy` |
| T6 | must-edit-in-place, should-route-keyboard | type in `InlineEditableText`, press Enter, press Escape | `onChange` per edit; `onCommitEdit` ×1; `onCancelEdit` ×1 |
| T6b | should-route-keyboard | consumer `onKeyDown` calls `preventDefault`, press Enter | `onKeyDown` ×1; `onCommitEdit` NOT called (suppressed) |
| T7 | must-guard-navigation-when-dirty | guard `when`, click same-origin link | Click default-prevented; confirm dialog shown; Discard navigates (via `onNavigate`), Stay does not |
| T7b | must-guard-navigation-when-dirty | guard mounted, `confirmNavigation()` called | Confirm dialog shown; Discard resolves `true`, Stay resolves `false`; with no guard mounted it resolves `true` |
| T7c | must-guard-navigation-when-dirty | guard `when`, dispatch `popstate` | Confirm dialog shown |
| T8 | (useInlineDrafts) patch drafts | `edit(id,{enabled:true})`, base `description` changes | `changesOf` = `{enabled:true}` only (untouched `description` never sent) |
| T9 | (useInlineDrafts) settle | commit `{description:"a"}` while a newer `"ab"` is typed | after `settle(id,{description:"a"})` the row stays dirty with `"ab"` |
| T10 | (useInlineDrafts) runCommit gate + errors | re-enter `runCommit` for an in-flight row; a rejecting commit | second call no-ops; failure stores the row's error, keeps the draft |

`@agentic-toolkit/ui` `src/__tests__/inlineCommitControl.test.tsx`,
`src/__tests__/unsavedChangesGuard.test.tsx`, and
`src/__tests__/useInlineDrafts.test.tsx` implement these vectors.

## Edge Cases

- **Dirty and armed simultaneously** — `deleting` wins the label/grammar: the
  pair reads "Confirm delete", and ✓ commits the delete (the consumer decides
  what happens to the pending edits).
- **Modified clicks** (cmd/ctrl/shift/alt, middle-click) and `target="_blank"`
  links are not intercepted by the guard — they don't leave the page.
- **Cross-origin links** are left to the `beforeunload` prompt (the dialog
  cannot defer a cross-origin unload reliably).
- **Same-page hops** (identical pathname + search, hash-only, `href="#"`) are
  allowed through the guard — they destroy no state.
- **Self-navigating anchors** that consult `confirmNavigation()` in their own
  handler mark themselves `data-guarded-nav` so the guard's click interceptor
  skips them (no double prompt).
- **Commit failure** — the consumer keeps the dirty state, so the pair stays
  visible for retry; the control has no error rendering of its own.
  `useInlineDrafts` captures the failure into that row's error slot without
  disturbing other rows.
- **Keystrokes during a commit** — with `useInlineDrafts`, edits typed while a
  field commit is in flight survive as a still-dirty draft (`settle` drops only
  the committed values), so an in-flight save never discards later typing.
- **Busy cancel** — ✕ is soft-disabled (`aria-disabled`) during flight and
  ignores clicks, but keeps focus; a commit cannot be cancelled mid-request
  from the control.
- **Back-button sentinel cost** — after the page goes clean again, the
  consumed-or-not history sentinel may leave one extra same-URL entry (a
  second Back press); this is the only reliable way to interpose on `popstate`
  without desyncing the app router.

## Configuration

`InlineCommitControl` props:

| Prop | Type | Meaning |
|---|---|---|
| `dirty` | `boolean` | Uncommitted edits exist — show the pair |
| `deleting` | `boolean?` | Delete armed — ✓ ✕ + red trash |
| `deletable` | `boolean?` | Offer the hover trash when clean |
| `busy` | `boolean?` | Commit in flight — soft-disable (`aria-disabled`, focus kept) + spinner |
| `onCommit` | `() => void` | Save edits / commit the armed delete |
| `onCancel` | `() => void` | Discard edits / disarm the delete |
| `onDelete` | `() => void?` | Arm (idle trash) or disarm (armed trash) |
| `subject` | `string?` | Accessible subject for button labels |

`InlineEditableText`: `value`, `onChange(value)`, optional
`onCommitEdit`/`onCancelEdit`, optional `variant` (`"default" | "mono" |
"muted"`), required `aria-label`, plus native input props.

`UnsavedChangesGuard`: `when` (guard active) and optional `onNavigate(href)`
(defaults to a full `location.assign`; pass the router's `push` to keep the
navigation client-side). The confirm copy is fixed ("Discard unsaved
changes?" / "Discard" / "Stay") — the guard is the platform's single
unsaved-changes prompt, not a per-page message.

`useInlineDrafts<Id, Draft>(describeError)` returns per-row helpers:
`draftOf(id, base)`, `isDirty(id, base)`, `changesOf(id, base)`, `edit(id,
patch)`, `clear(id)`, `isArmed(id)`, `toggleArmed(id)`, `isBusy(id)`,
`errorOf(id)`, `errors`, `runCommit(id, fn)`, and `settle(id, committed)`.

## Logging

None. The control emits no telemetry; consumers log through their own
mutation layer.

## Platform Notes

- Web (React 19, Base UI, Tailwind v4). Ships in `@agentic-toolkit/ui`
  `components/inline-commit-control` + `components/unsaved-changes-guard`.
- DataTable rows already carry the hover scope (`group/icc`); other
  containers opt in with `inlineCommitHoverScopeClass`.
- The guard intercepts document-capture clicks so it runs before Next.js
  `<Link>` handlers. Programmatic navigation (no anchor click to intercept) is
  covered by a small registry: the guard registers a callback, and shared
  chrome that calls `router.push` (`useSiteMenu`, `RouteSwitcher`, the admin
  logout) awaits `confirmNavigation()` first. With no guard mounted it resolves
  `true` synchronously, so guard-free pages pay nothing.

## Design Decisions

- **Consumer-owned state** (ButtonBar precedent): the control renders
  `dirty`/`deleting`/`busy` and reports intent via callbacks — it never holds
  draft data, so any data layer (react-query, local state) plugs in. The
  optional `useInlineDrafts` hook is the shared implementation of that state.
- **Patch-based drafts** (`useInlineDrafts`): a draft stores only the fields
  the user touched, so a commit sends — and can clobber — nothing else, even
  after a background refetch changes a sibling field. `settle` then drops only
  the committed keys, preserving keystrokes typed mid-flight.
- **`aria-disabled` over `disabled` for busy**: the buttons stay in the tab
  order and keep focus across the in-flight transition (a `disabled` button
  loses focus to `<body>`), so keyboard commit → busy → done is seamless.
- **Registry for programmatic navigation**: an anchor-click interceptor can't
  see a `router.push`, so a tiny guard registry lets programmatic navigators
  opt in with one `await confirmNavigation()` — instead of every menu/logout
  re-implementing the confirm.
- **Armed delete over instant delete**: destructive intent is staged and
  confirmed by the same ✓ grammar as edits — one commit vocabulary for the
  whole row, instead of a separate modal per delete.
- **Trash toggles** — clicking the armed red trash disarms (small reversible
  decision) rather than double-confirming.
- **`InlineEditableText` is a transparent Input**, not a text-node/edit-mode
  swap: one fewer state machine, the field is always the real input
  (simplicity, native-controls).
- **Guard raises the platform AlertModal** for in-app links instead of the
  native `confirm()` — consistent with the platform's dialog policy; native
  `beforeunload` remains for hard unloads where custom UI is impossible.

## Compliance

| Check | Status | Category |
|---|---|---|
| Composes shared Button/Input only (no bespoke controls) | pass | adh-ui-guidelines |
| Colors via `apt-*` tokens; no `dark:` variants | pass | adh-ui-guidelines |
| Keyboard-operable (focus reveal, Enter/Escape, focus-trapped dialog) | pass | accessibility |
| Unit vectors T1–T7 implemented in vitest | pass | testing |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-07 | Mike Fullerton | Initial draft |
