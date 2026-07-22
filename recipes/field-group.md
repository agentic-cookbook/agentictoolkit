---
id: 781740e8-c83f-40a1-8215-43abfb8d8f56
title: FieldGroup
domain: agenticdeveloperhub://recipes/field-group
type: recipe
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A titled, bordered card that groups related Fields — the standard sectioning wrapper for settings forms, with an optional trailing accessory by the title."
platforms:
- typescript
- web
tags:
- forms
- layout
- section
- field
- ui
ingredients:
- agenticdeveloperhub://recipes/field
depends-on: []
related:
- agenticdeveloperhub://recipes/field
- agenticdeveloperhub://recipes/delete-entity-section
references: []
---

# FieldGroup

## Overview

The shared `FieldGroup` in `@adh-shared/ui` — the standard sectioning wrapper for
settings and editor forms. It is a bordered card with an uppercase-mono title row
across the top and its `Field` children stacked below, so a settings pane reads as a
series of titled groups instead of a flat wall of inputs.

The title row also carries an optional `trailing` accessory pinned to its right
edge — a status line ("Saved"), a small action (a "Reset" button), or a badge —
that belongs to the group as a whole rather than to any one field.

`FieldGroup` is presentation-only: it owns no form state and imposes no field type.
It composes the shared `Field` (`agenticdeveloperhub://recipes/field`) as its
expected children and reuses the same `fieldCaptionClass` caption treatment as the
field caption, so the group title and the field captions share one visual language.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| Field | agenticdeveloperhub://recipes/field | The grouped rows — each caption+control+hint/error that the group stacks | yes | Passed as `children`; the group applies `gap-3` between them |

The group title reuses the shared `fieldCaptionClass` from `@adh-shared/ui/lib/typography`
(the same uppercase-mono caption treatment `Field` uses), so titles and field
captions stay visually identical. `trailing` is an arbitrary caller node
(status text, a `Button`, a badge) — not a fixed ingredient.

## Integration Requirements

- **must-render-title**: The group MUST render the `title` node as an uppercase-mono
  heading (the shared `fieldCaptionClass`) in the top row.
- **must-render-title-as-heading**: The group MUST render the `title` inside an
  `<h3>` so the section is a real heading in the document outline.
- **must-render-trailing-when-set**: When `trailing` is provided, the group MUST
  render it in the title row, right-aligned opposite the title; when unset, the
  title row MUST show the title alone.
- **must-stack-children**: The group MUST render its `children` (the Fields) as a
  vertical stack below the title row, with consistent spacing between rows.
- **must-be-bordered-card**: The group MUST present as a bordered, rounded surface
  (`apt-border` / `apt-surface` tokens) that visually contains its title and fields.
- **must-merge-classname**: The group MUST merge a caller-supplied `className` onto
  its root `section` without dropping its own layout classes.

## Layout

```
┌ section (rounded, bordered, recessed surface) ─────────────────┐
│  GROUP TITLE                              [ trailing accessory ]│  ← title row
│                                                                 │
│  ┌ Field ───────────────────────────────────────────────────┐ │
│  │ CAPTION / control / hint|error                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌ Field ───────────────────────────────────────────────────┐ │
│  │ CAPTION / control / hint|error                            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- Root: `section` — `flex flex-col gap-3 rounded-lg border border-apt-border
  bg-apt-surface-2/40 p-3` (recessed card).
- Title row: `flex items-center justify-between gap-2`; the `<h3>` title on the
  `fieldCaptionClass`, the `trailing` node right-aligned via `justify-between`.
- Children: the `Field` rows follow the title row in the same column, separated by
  the section's `gap-3`.
- No raw hex; no `!important`; every color is an `apt-*` token.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| `title` | Caller | Group heading (`<h3>`) | Down | Prop |
| `trailing` | Caller | Title-row accessory slot | Down | Prop (optional) |
| `children` (Fields) | Caller | Stacked group body | Down | Prop |
| Field values / validation | Owning form (outside the group) | The `Field` controls | — | Not owned by `FieldGroup` — it is pure layout |

`FieldGroup` holds no state of its own; it is a stateless layout wrapper, so all
form state flows through the `Field` controls the caller nests, not through the
group.

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-title, must-render-title-as-heading | `title="Profile"` | An `<h3>` with uppercase-mono "Profile" renders in the top row |
| T2 | must-render-trailing-when-set | `trailing={<Button>Reset</Button>}` | The Reset button renders right-aligned in the title row, opposite the title |
| T3 | must-render-trailing-when-set | `trailing` omitted | The title row shows the title alone; no trailing slot content |
| T4 | must-stack-children | two `Field` children | Both Fields render stacked below the title row with the group's `gap-3` |
| T5 | must-be-bordered-card | any props | The root `section` has the bordered rounded recessed-surface treatment |
| T6 | must-merge-classname | `className="mt-6"` | Root keeps `flex flex-col … border …` and adds `mt-6` |

## Edge Cases

- No `trailing` → the title row still lays out with `justify-between`, so the title
  sits at the left edge exactly as with an accessory present.
- Zero `children` → an empty titled card renders (title row only); the group does
  not error on an empty body.
- A `trailing` node wider than its slot shares the row via `gap-2`; the title
  (`h3`) does not truncate here — long titles wrap unless the caller constrains them.
- `children` need not be `Field`s specifically — any nodes stack — but the group is
  designed and spaced for `Field` rows.
- `title` is a `ReactNode`, so an inline glyph/badge in the title still renders with
  the caption treatment.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/blocks/field-group.tsx`,
  exported via `@adh-shared/ui/blocks/field-group`. Carries `"use client"` (it ships
  alongside interactive form content) and composes `Field`
  (`agenticdeveloperhub://recipes/field`) as its children plus the shared
  `fieldCaptionClass` for the title.
- Demo: `ui-showcase` Topic `field-group` (regenerate `sources.generated.ts` via
  `gen-sources.py` after source changes).
- Used platform-wide as the sectioning wrapper in settings/editor panes; commonly
  the last group in such a pane is a `DeleteEntitySection`
  (`agenticdeveloperhub://recipes/delete-entity-section`).
- **Responsive:** Verify via Playwright (ui-showcase) at 375 / 768 / 1440 — the
  title/trailing row and the stacked Fields stay usable on mobile.
- **SwiftUI / Compose:** Not applicable — web-only shared block.

API (`@adh-shared/ui/blocks/field-group`):

```ts
interface FieldGroupProps {
  title: React.ReactNode
  trailing?: React.ReactNode   // right-aligned accessory in the title row
  children: React.ReactNode    // the grouped Fields
  className?: string
}
export function FieldGroup(props: FieldGroupProps): React.ReactElement
```

## Design Decisions

- **Decision**: The title reuses `fieldCaptionClass` (the same treatment as `Field`
  captions) inside an `<h3>`. **Rationale**: Group titles and field captions read as
  one caption language, and the heading gives the section real document-outline
  structure for AT.
- **Decision**: `trailing` is a single right-aligned slot rather than a fixed
  actions API. **Rationale**: Keeps the group a generic wrapper (status, a button,
  or a badge) and optimizes-for-change by not baking a specific accessory contract
  into the group.
- **Decision**: The group owns no form state. **Rationale**: It stays a pure layout
  composition over `Field`; value and validation policy live in the owning form,
  keeping the group reusable across every settings pane.
- **Decision**: Recessed `apt-surface-2/40` card on `apt-border`. **Rationale**: The
  group reads as a contained section against the pane background without a heavy
  border or any color literal.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| No raw hex / arbitrary colors / `!important` | passed | project-guidelines UI |
| Components sourced from `@adh-shared` (no bespoke UI) | passed | project-guidelines UI |
| Title rendered as a real heading (`<h3>`) | passed | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe for the titled FieldGroup sectioning wrapper. |
