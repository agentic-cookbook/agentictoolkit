---
id: b118c7bc-e163-40f0-bcc8-eb079e835794
title: MarkdownEditor
domain: agenticdeveloperhub://recipes/markdown-editor
type: recipe
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A labelled markdown-body textarea with an editor toolbar above it: a built-in .md upload control, a quick-reference popover, and a slot for extra controls."
platforms:
- typescript
- web
tags:
- markdown
- editor
- textarea
- toolbar
- form
ingredients:
- agenticdeveloperhub://recipes/markdown-quick-reference
- agenticdeveloperhub://recipes/button
depends-on: []
related:
- agenticdeveloperhub://recipes/markdown-quick-reference
references: []
---

# MarkdownEditor

## Overview

A composition in `@adh-shared/ui` (`blocks/markdown-editor`) that encapsulates
markdown **body** editing: a labelled `Textarea` for the raw markdown source with
an `EditorToolbar` row above it. The toolbar carries an optional built-in
`.md` upload control, a built-in `MarkdownQuickReference` popover, and a slot for
extra controls (e.g. a future spell-check toggle).

It is controlled via `value` / `onChange`. The label is associated with the
textarea (`htmlFor`), so it is the textarea's accessible name. The editor owns no
title, category, or classification fields — those stay with the consuming form
(e.g. hub's `ResearchDetail`), which composes this block for the body and wires
`onUpload` to set the body and derive a title.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| Textarea | agenticdeveloperhub://recipes/textarea | The markdown source field | yes | `id` (from `useId`), `rows`, `spellCheck`, mono font |
| Label | agenticdeveloperhub://recipes/label | Caption bound to the textarea via `htmlFor` | yes | mono uppercase caption styling |
| EditorToolbar | agenticdeveloperhub://recipes/editor-toolbar | `role="toolbar"` row holding the controls | yes | `ariaLabel` |
| MarkdownQuickReference | agenticdeveloperhub://recipes/markdown-quick-reference | Built-in quick-reference popover control | optional (`quickReference`, default on) | side/align defaults |
| Button | agenticdeveloperhub://recipes/button | The "Upload .md" trigger | optional (only when `onUpload` set) | `variant="outline" size="sm"` |

> The Textarea, Label, and EditorToolbar are atomic `@adh-shared/ui` primitives
> reused as-is; the `.md` upload control wraps a hidden native `<input
> type="file">` (the only way to open a file picker — recorded with an
> `adh-ui-allow: cs-no-bespoke` marker in the source).

## Integration Requirements

- **must-label-textarea**: The editor MUST render the markdown source in a
  `Textarea` whose accessible name is the `label` (default `Markdown body`),
  associated via `htmlFor`/`id`.
- **must-be-controlled**: The editor MUST render `value` in the textarea and call
  `onChange` with the next string on every edit (no internal source-of-truth).
- **must-default-spellcheck-off**: The editor MUST default `spellCheck` to `false`
  on the textarea, while allowing the consumer to enable it.
- **must-show-toolbar-when-controls-exist**: The editor MUST render a
  `role="toolbar"` row when any toolbar control is present (`onUpload`,
  `quickReference`, or `toolbarExtras`), and MUST omit the toolbar entirely when
  none are.
- **must-upload-on-demand**: When `onUpload` is provided, the editor MUST render a
  built-in "Upload .md" control that reads the chosen file's text and calls
  `onUpload(text, fileName)`; it MUST NOT render the control when `onUpload` is
  absent.
- **must-reset-file-input**: The upload control MUST clear the native file input
  after each selection so re-choosing the same file fires `change` again.
- **must-include-quick-reference**: The editor MUST include the
  `MarkdownQuickReference` control in the toolbar by default, and MUST omit it
  when `quickReference={false}`.
- **must-slot-extra-controls**: The editor MUST render `toolbarExtras` in the
  toolbar ahead of the built-in controls.
- **must-propagate-disabled**: When `disabled`, the editor MUST disable the
  textarea and the upload control.

## Layout

```
┌ MarkdownEditor (flex flex-col gap-1.5) ────────────────────────────┐
│ ┌ header row (flex items-center justify-between) ────────────────┐ │
│ │ MARKDOWN BODY            [extras] [⬆ Upload .md] [▮ Markdown]   │ │
│ │  └ Label (htmlFor)        └──── EditorToolbar (role="toolbar") ─┘ │
│ └────────────────────────────────────────────────────────────────┘ │
│ ┌ Textarea (id, rows, mono) ─────────────────────────────────────┐ │
│ │ # My research                                                  │ │
│ │ …                                                              │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

- The header row puts the `Label` on the left and the `EditorToolbar` on the
  right (`justify-between`).
- Toolbar order: `toolbarExtras` → Upload .md (if `onUpload`) → quick reference
  (if `quickReference`).
- The textarea sits full-width below the row, mono (`font-mono text-[0.8rem]`),
  `rows` tall (default 16).
- Tokens only (inherited from Textarea/Label/Button/Popover); no raw hex, no
  `!important`.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| markdown source | consumer (`value`) | Textarea | down | controlled `value` prop |
| edits | Textarea | consumer (`onChange`) | up | `onChange(next: string)` |
| uploaded file | upload control | consumer (`onUpload`) | up | `onUpload(text, fileName)` — caller sets body + title |
| textarea id | `useId()` (internal) | Label `htmlFor` ↔ Textarea `id` | internal | generated once per instance |
| popover open/closed | MarkdownQuickReference (internal) | — | internal | the shared Popover's own state |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-label-textarea | Render with no `label` | A `TEXTAREA` is reachable by accessible name `Markdown body` |
| T2 | must-label-textarea | Render `label="Notes"` | The textarea's accessible name is `Notes` |
| T3 | must-be-controlled | Type `# Title` into the textarea | `onChange` is called with `# Title` |
| T4 | must-default-spellcheck-off | Render with defaults | The textarea has `spellcheck="false"` |
| T5 | must-show-toolbar-when-controls-exist | Render with defaults (quick-ref on) | A `role="toolbar"` named `Markdown editor toolbar` is present |
| T6 | must-show-toolbar-when-controls-exist, must-include-quick-reference | Render `quickReference={false}` with no upload/extras | No `role="toolbar"` and no `Markdown quick reference` button |
| T7 | must-upload-on-demand | Render without `onUpload`, then with it | The `Upload .md` button is absent, then present |
| T8 | must-upload-on-demand, must-reset-file-input | Provide `onUpload`; select a `notes.md` file containing `# Hello` | `onUpload` is called with `('# Hello', 'notes.md')`; the input is reset |
| T9 | must-include-quick-reference | Click the `Markdown` toolbar control | The quick-reference popover opens (see markdown-quick-reference T2) |
| T10 | must-slot-extra-controls | Pass `toolbarExtras={<button>Spell check</button>}` | The `Spell check` button renders inside the toolbar |
| T11 | must-propagate-disabled | Render `disabled` | The textarea is disabled |

## Edge Cases

- With `quickReference={false}` and no `onUpload`/`toolbarExtras`, there are no
  controls, so the toolbar row is omitted entirely (no empty `role="toolbar"`).
- The same file chosen twice in a row still fires `onUpload` because the native
  input value is reset after each selection.
- `onUpload` reports raw file text + name only; deriving a title (or anything
  else) is the consumer's job — the editor never mutates `value` from an upload.
- Each instance gets a distinct `useId` textarea id, so multiple editors on one
  page never collide on the Label↔Textarea association.
- An empty `value` shows the `placeholder`; the editor renders no empty/error
  state of its own (the body is always valid text — validation belongs to the
  consuming form).

## Platform Notes

- **React / Web (TypeScript):** Block at
  `websites/shared/ui/src/blocks/markdown-editor.tsx`, exported from
  `@adh-shared/ui/blocks`. Composes `Textarea` + `Label` + `EditorToolbar`
  (`components/editor-toolbar`) + `MarkdownQuickReference`
  (`components/markdown-quick-reference`) + `Button`. Consumed by hub's
  `ResearchDetail`. Demo lives in `ui-showcase` (Compositions group); re-run
  `gen-sources.py` after edits.
- **SwiftUI / Compose:** Not applicable — this is a web-only shared component.

## Design Decisions

- **Decision**: Upload reports `(text, fileName)` via `onUpload` instead of
  mutating `value` itself. **Rationale**: Keeps the editor body-only and reusable;
  the consuming form decides whether an upload also sets a title or other fields
  (separation of concerns — `ResearchDetail` derives the title).
- **Decision**: The quick-reference control is built in (default on) but
  toggleable, and there is also a generic `toolbarExtras` slot. **Rationale**:
  Common editors get the cheatsheet for free, while bespoke toolbars can add
  controls (e.g. a spell-check toggle) without forking the block.
- **Decision**: The textarea id comes from `useId`, not a fixed string.
  **Rationale**: A shared component must support multiple instances per page
  without colliding the Label↔Textarea association.
- **Decision**: `EditorToolbar` is factored as its own exported primitive with
  `role="toolbar"`. **Rationale**: Reusable a11y-correct toolbar semantics for any
  editor surface, and it keeps the block focused on composition.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — apt-* tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |
| Reuse-first — composes Textarea/Label/EditorToolbar/Popover/Button | passed | adh-ui-guidelines |
| File-picker exception recorded | passed | adh-ui-allow (cs-no-bespoke) |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe for the shared MarkdownEditor extracted from hub's ResearchDetail (contract c9). |
