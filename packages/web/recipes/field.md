---
id: 0c199036-81c3-47c3-9e79-e4b8187ca69a
title: Field
domain: agenticdeveloperhub://recipes/field
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The family's standard form row — an uppercase-mono caption over its control, implicitly associated via the shared Label, with a hint or red-mono error below."
platforms:
- typescript
- web
tags:
- component
- forms
- field
- label
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/field-group
references: []
---

# Field

## Overview

The shared `Field` in `@adh-shared/ui` — the family's standard form row. It stacks
an uppercase-mono caption above whatever control it wraps (`Input`, `Select`,
`Switch`, `Textarea`, or any other primitive passed as `children`), and it renders
the whole row inside the shared `Label` so the caption is **implicitly associated**
with the control: clicking the caption focuses the input, with no `htmlFor`/`id`
wiring at the call site.

Below the control, `Field` renders one line of supporting text: a dim-mono `hint`
by default, or a red-mono `error` that takes the hint's place when present. This is
the one place inline field errors live, so forms across the platform stop
re-implementing (and re-styling) their own error text.

`Field` is presentation-only: it owns no value, no validation, and no state. The
caller supplies the control, the `hint`, and the `error`; `Field` only decides the
layout and which supporting line to show.

## Behavioral Requirements

- **must-render-caption**: The field MUST render the `label` node as an
  uppercase-mono caption (the shared `fieldCaptionClass`) above its control.
- **must-associate-label-implicitly**: The field MUST wrap the caption and the
  control in a single shared `Label` so activating the caption focuses the control,
  without the caller supplying `htmlFor`/`id`.
- **must-render-control**: The field MUST render its `children` (the control)
  between the caption and the supporting line.
- **must-show-hint-when-no-error**: When `error` is unset and `hint` is provided,
  the field MUST render `hint` below the control in dim mono.
- **must-show-error-in-place-of-hint**: When `error` is set, the field MUST render
  `error` below the control in red mono and MUST NOT also render `hint`.
- **must-omit-supporting-line-when-empty**: When neither `error` nor `hint` is
  provided, the field MUST render no supporting line below the control.
- **must-merge-classname**: The field MUST merge a caller-supplied `className` onto
  its root without dropping its own layout classes.

## Appearance

```
LABEL CAPTION            ← uppercase mono, apt-text-muted (fieldCaptionClass)
┌───────────────────────┐
│  control (children)    │ ← Input / Select / Switch / Textarea / …
└───────────────────────┘
helper text below         ← hint: dim mono (apt-text-dim)
                          ← OR error: red mono (apt-red), replacing the hint
```

- Root: the shared `Label` as a vertical stack — `flex flex-col items-start
  gap-1.5` — so caption, control, and supporting line left-align in a column.
- Caption: `fieldCaptionClass` = `font-mono text-[0.7rem] uppercase tracking-wider
  text-apt-text-muted` (the platform's one caption treatment).
- Hint: `font-mono text-[0.7rem] text-apt-text-dim`.
- Error: `font-mono text-[0.7rem] text-apt-red` — same metrics as the hint, red
  tone, occupying the same slot.
- No raw hex; no `!important`; every color is an `apt-*` token.

## States

| State | Appearance change |
|---|---|
| Default (hint only) | caption, control, then dim-mono `hint` |
| Default (no hint, no error) | caption + control only; no supporting line |
| Error | caption, control, then red-mono `error`; the `hint` is suppressed |
| Focused control | caption + control focus is the control's own affordance; `Field` adds none |
| Disabled control | the wrapping `Label` dims via `peer-disabled` when the control marks itself a `peer` |

## Accessibility

- The caption and control share one `<label>` element, so the caption is a real,
  programmatic label for the control — clicking it focuses the control and screen
  readers announce the caption when the control is focused.
- The caption text is authored by the caller; it MUST be human-readable label text
  (implicit association carries no `aria-label`).
- The error line is plain text in the label's flow, so it is read with the field;
  callers that need assertive announcement SHOULD add their own `role="alert"`
  wrapper around the message they pass as `error`.
- Color is not the only error signal in practice — the message text itself states
  the error — but callers SHOULD keep error copy meaningful for non-visual users.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-caption, must-associate-label-implicitly | `<Field label="Name"><input/></Field>` | One `<label>` wraps an uppercase-mono "Name" caption and the input; clicking the caption focuses the input |
| T2 | must-render-control | `children` is an `<Input/>` | The input renders between the caption and any supporting line |
| T3 | must-show-hint-when-no-error | `hint="Shown to teammates"`, no `error` | A dim-mono hint line renders below the control |
| T4 | must-show-error-in-place-of-hint | `hint="…"` AND `error="Required"` | A red-mono "Required" renders; the hint is absent |
| T5 | must-omit-supporting-line-when-empty | neither `hint` nor `error` | No supporting line renders below the control |
| T6 | must-merge-classname | `className="mt-4"` | Root keeps `flex flex-col …` and adds `mt-4` |

## Edge Cases

- Both `hint` and `error` set → `error` wins and the hint is not rendered (the
  error occupies the hint's slot, so the row height does not jump).
- `error` toggling on/off swaps the single supporting line rather than stacking two
  lines, so validated forms don't reflow by an extra row.
- `label` is a `ReactNode`, so a caption may include an inline glyph or badge; it is
  still rendered with the caption treatment.
- Empty-string `hint`/`error` renders nothing (falsy), same as omitting it.
- The control is whatever `children` the caller passes; `Field` imposes no control
  type and forwards no value/validation.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `label` | `ReactNode` | — (required) | The caption text, rendered uppercase-mono above the control. |
| `children` | `ReactNode` | — (required) | The control (e.g. `Input`/`Select`/`Switch`/`Textarea`). |
| `hint` | `ReactNode` | — | Dim-mono helper line below the control; shown only when `error` is unset. |
| `error` | `ReactNode` | — | Red-mono inline error; when set, replaces `hint` in the same slot. |
| `className` | `string` | — | Extra classes merged onto the root `Label` via `cn()`. |

## Logging

No logging. `Field` is a presentational primitive; value changes, validation, and
any telemetry belong to the control and the owning form, not to `Field`.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/blocks/field.tsx`, exported
  via `@adh-shared/ui/blocks/field`. Composes the shared `Label`
  (`components/label`) and the `fieldCaptionClass` from `lib/typography`.
- The row is deliberately server-safe (no `"use client"` directive): it is pure
  layout, so it renders in server components; interactivity lives in the control the
  caller nests.
- Demo: `ui-showcase` Topic `field` (regenerate `sources.generated.ts` via
  `gen-sources.py` after source changes).
- Used platform-wide by settings/editor forms, typically grouped by `FieldGroup`
  (`agenticdeveloperhub://recipes/field-group`).
- **SwiftUI / Compose:** Not applicable — web-only shared block.

## Design Decisions

- **Decision**: Wrap the whole row in one shared `Label` rather than pairing an
  `htmlFor`/`id`. **Rationale**: Implicit association removes per-call id wiring and
  makes the caption a real click target, while keeping every caption on the one
  `fieldCaptionClass` treatment.
- **Decision**: `error` occupies the same slot as `hint` (one supporting line, not
  two). **Rationale**: The row height stays stable as validation toggles, and forms
  get a single, consistent place for inline errors instead of re-inventing error
  text.
- **Decision**: `Field` owns no value or validation. **Rationale**: It stays a
  reusable layout primitive over any control; optimize-for-change keeps validation
  policy in the form, not the row.
- **Decision**: Caption and error are mono at the same `0.7rem` metrics.
  **Rationale**: Error and hint read as the same "supporting text" rhythm, differing
  only by the `apt-red` tone that signals the error.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@adh-shared` (no bespoke UI) | pass | project-guidelines UI |
| Caption implicitly labels the control (keyboard/AT) | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe for the shared Field form row. |
