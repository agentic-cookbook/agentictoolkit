---
id: fce1333d-7f42-49f8-86da-508159701043
title: SectionLabel
domain: agenticdeveloperhub://recipes/section-label
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The display micro-heading — a quiet uppercase-mono in-pane label (sectionLabelClass) with an optional trailing slot; distinct from a Field caption or title."
platforms:
- typescript
- web
tags:
- component
- typography
- heading
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/user-card
- agenticdeveloperhub://recipes/field
references: []
---

# SectionLabel

## Overview

The shared `SectionLabel` in `@agentic-toolkit/ui` — the **display micro-heading**: the
quiet, wide-tracked uppercase-mono label that heads a pane or an in-card section
("RECENT ACTIVITY", "SOCIAL LINKS", "MONITORED SITES"). It ships as two exports
from `@agentic-toolkit/ui/components/section-label`: the `sectionLabelClass` string (so
any element can wear the treatment) and the `SectionLabel` component (the div
that applies it, with an optional trailing slot).

The treatment is `font-mono text-[0.625rem] font-medium uppercase
tracking-[0.1em] text-apt-text-dim` — smaller, dimmer, and wider-tracked than a
form caption. When a `trailing` node is given, the label lays out as a
`justify-between` row so an action (a "Refresh" button, a gear) sits opposite the
label on the same baseline; with no trailing node it is a bare div.

**This is one of three deliberately distinct heading treatments — keep them apart:**

| Treatment | Home | Role | Look |
|---|---|---|---|
| `sectionLabelClass` / `SectionLabel` | `components/section-label.tsx` | **Display** in-pane / in-card micro-heading | `text-[0.625rem]` mono, `apt-text-dim`, `tracking-[0.1em]` |
| `fieldCaptionClass` | `lib/typography.ts` | **Form** caption / group title / column header | `text-[0.7rem]` mono, `apt-text-muted`, `tracking-wider` |
| `SectionHeader` | `blocks/section-header.tsx` | **Page/section title** (with `?` help + actions) | `text-sm` mono, **`apt-gold`**, `font-medium` |

SectionLabel is the *quietest* of the three: dimmer and smaller than a field
caption, and a different element entirely from the gold page title. Reach for
`fieldCaptionClass` when labeling a form field; reach for `SectionHeader` for the
gold headline of a page area; reach for `SectionLabel` for the muted label inside
a pane or card. It is a stateless div with no `"use client"` directive.

## Behavioral Requirements

- **exports-class-string**: The module MUST export `sectionLabelClass` as a string so any element can adopt the display micro-heading treatment without the component.
- **applies-display-treatment**: The component MUST apply `sectionLabelClass` (`font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-apt-text-dim`) to the label element.
- **renders-children-as-label**: The component MUST render its `children` as the label text.
- **bare-div-without-trailing**: With no `trailing` node, the component MUST render a single div carrying `sectionLabelClass` (no wrapping row).
- **row-with-trailing**: Given a `trailing` node, the component MUST render a `flex items-center justify-between` row with the label on the left and the trailing node on the right.
- **merges-classname-on-label**: The component MUST merge any `className` after `sectionLabelClass` on the label div via `cn()`, so a consumer MAY tweak it without losing the treatment.
- **distinct-from-caption-and-title**: The component MUST NOT reuse `fieldCaptionClass` or the `SectionHeader` gold-title treatment — it is a separate, quieter display label.

## Appearance

```
bare (no trailing)
  RECENT ACTIVITY
  Deployed build #147 to staging.

with trailing (justify-between row)
  MONITORED SITES                             [ Refresh ]
  57 sites · all green.
```

- Label element: `sectionLabelClass` =
  `font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-apt-text-dim`.
- Bare form: `<div className={cn(sectionLabelClass, className)}>{children}</div>`.
- Trailing form: an outer `flex items-center justify-between gap-2` row wrapping
  the same label div plus the `trailing` node.
- Token-driven color (`apt-text-dim`); no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Bare | Single div with the display micro-heading treatment |
| With `trailing` | `justify-between` row: label left, trailing node right |
| Restyled (`className`) | Extra classes merged onto the label div after `sectionLabelClass` |

## Accessibility

- SectionLabel renders a plain `div`, **not** a semantic heading (`h1`–`h6`) or
  `role="heading"` — it is a *display* label, so it does not enter the document's
  heading outline. Consumers who need the label in the outline SHOULD supply
  their own heading semantics.
- It carries no interactivity of its own; the `trailing` slot's node (a button,
  say) brings its own accessible name and focus behavior.
- Sufficient for a quiet in-pane label whose associated content follows visually;
  the treatment relies on size/case/tracking, not color alone, to read as a
  heading.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | applies-display-treatment, renders-children-as-label | `<SectionLabel>Recent activity</SectionLabel>` | text "Recent activity" is present; its className contains every token of `sectionLabelClass` |
| T2 | bare-div-without-trailing | same as T1 | label is a single div (no justify-between wrapper row) |
| T3 | row-with-trailing, renders-children-as-label | `<SectionLabel trailing={<button>gear</button>}>Stats</SectionLabel>` | "Stats" is present and a button named "gear" is present on the same row |
| T4 | exports-class-string | import `sectionLabelClass` | it is a string containing `font-mono`, `text-[0.625rem]`, `uppercase`, `tracking-[0.1em]`, `text-apt-text-dim` |
| T5 | merges-classname-on-label | `<SectionLabel className="mb-2">Env</SectionLabel>` | label className contains both `mb-2` and `text-apt-text-dim` |
| T6 | distinct-from-caption-and-title | compare to `fieldCaptionClass` | `sectionLabelClass` differs (`text-[0.625rem]`/`apt-text-dim` vs `text-[0.7rem]`/`apt-text-muted`) |

## Edge Cases

- **`trailing={null}` / omitted.** `trailing == null` selects the bare-div
  branch, so an explicit `null` behaves exactly like omitting the prop.
- **Falsy-but-present trailing.** `trailing={false}` is not `== null`, so it
  takes the row branch and renders an empty right cell — pass `undefined`/`null`
  (or omit) to get the bare div.
- **Rich children.** `children` is any `ReactNode`, so a label MAY include an
  inline count or icon, though the treatment is tuned for short uppercase text.
- **Not a heading.** Because it is a div, it will not appear in a screen reader's
  heading list — intentional for a display micro-label, but a trap if you needed
  outline semantics.
- **Overriding the color.** A `className` that sets a text-color token overrides
  `apt-text-dim` via `cn()` merge; classes that touch other properties leave the
  dim color in place.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | The label text (typically short uppercase words). |
| `trailing` | `ReactNode` | — | Optional node placed opposite the label in a `justify-between` row (e.g. a Refresh button). |
| `className` | `string` | — | Extra classes merged after `sectionLabelClass` on the label div via `cn()`. |
| `sectionLabelClass` | `string` (export) | — | The raw treatment string, for applying the micro-heading look to any element directly. |

## Logging

No logging. `SectionLabel` is a presentational label; it holds no state and takes
no action.

## Platform Notes

- File: `websites/shared/ui/src/components/section-label.tsx`.
- No `"use client"` — it is a stateless div; it renders in a server component.
- Sibling treatments live in `lib/typography.ts` (`fieldCaptionClass`) and
  `blocks/section-header.tsx` (`SectionHeader`); do not collapse them together.
- Consumed by `blocks/user-card.tsx` (Social / Email / Phone / Address / Personas
  section labels) and available across panes and cards.
- Demo: `ui-showcase` Topic `section-label` in the "Primitives — display" group
  (regenerate `sources.generated.ts` via `gen-sources.py` after source changes).
- Web/TypeScript only; token-driven so it themes with the rest of
  `@agentic-toolkit/ui`.

## Design Decisions

- **Class export + component.** Shipping `sectionLabelClass` alongside the
  component lets an element that can't be a `SectionLabel` (a `<legend>`, an
  existing div) still wear the exact treatment, keeping the look in one place.
- **Three distinct heading treatments, on purpose.** SectionLabel is not
  `fieldCaptionClass` and not `SectionHeader`: the display micro-label is
  quieter (dimmer, smaller, wider-tracked) than a form caption, and it is a plain
  label rather than the gold page title. Keeping them separate prevents a
  one-size heading that fits none of the three roles.
- **Trailing slot instead of a separate row component.** The most common pane
  head is "label + one action opposite it", so the `justify-between` row is built
  in via a single `trailing` prop rather than forcing every caller to hand-roll a
  flex row.
- **Div, not a heading element.** It is a display label, not an outline node, so
  it renders a `div` — semantic headings are the caller's choice when the outline
  matters.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` (color is `apt-text-dim`) | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Treatment kept distinct from `fieldCaptionClass` / `SectionHeader` | pass | project-guidelines UI |
| Display label does not masquerade as a semantic heading | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents SectionLabel + sectionLabelClass and its boundary vs caption/title. |
