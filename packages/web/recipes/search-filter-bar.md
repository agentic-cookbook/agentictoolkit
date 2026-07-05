---
id: c57b1aed-ef38-4803-b38a-2d7e0aeced5f
title: SearchFilterBar
domain: agenticdeveloperhub://recipes/search-filter-bar
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A role=search bar combining a labelled search field with a configurable row of controlled filter selects above a list; option sets are caller-supplied."
platforms:
- typescript
- web
tags:
- search
- filter
- input
- select
- toolbar
depends-on:
- agenticdeveloperhub://recipes/combobox
related: []
references: []
---

# SearchFilterBar

## Overview

A search-and-filter bar in `@adh-shared/ui` that sits above a list. It combines a
single icon-led search `Input` with a configurable row of filter `Select`s. Every
axis is **fully controlled** by the caller (value + `onChange`), and the option
sets for each select are supplied by the caller — so narrowing the list (which
typically refetches the rows) never empties a dropdown of its own options.

It is the single home for the "search + filters above a list" pattern. First
consumer: the hub `/research` document list (`ResearchFilters` is a thin domain
adapter that maps its `{ q, category, tag }` state onto this component).

## Behavioral Requirements

- **must-wrap-in-search-region**: The SearchFilterBar MUST render its controls
  inside a single element with `role="search"`.
- **must-control-search-field**: The SearchFilterBar MUST render the search field
  as a controlled `type="search"` input bound to `search.value`, calling
  `search.onChange` with the new string on every keystroke.
- **must-label-search-field**: The SearchFilterBar MUST expose `search.label` as
  the search field's accessible name (the field is icon-only, with no visible
  label).
- **must-render-one-select-per-filter**: The SearchFilterBar MUST render exactly
  one `Select` per entry in `filters`, each labelled by its `label`, in the given
  order, with a leading all-pass option whose value is the empty string and whose
  text is `allLabel`.
- **must-list-caller-options**: The SearchFilterBar MUST render each filter's
  `options` (in order) as `<option>`s after the all-pass entry, using the string
  as both the value and the visible text.
- **must-reflect-and-report-filter-value**: The SearchFilterBar MUST set each
  select's current value from the filter's `value` and call that filter's
  `onChange` with the newly selected value (the empty string when the all-pass
  entry is chosen).
- **must-omit-empty-filter-row**: The SearchFilterBar MUST NOT render the filter
  row when `filters` is empty or omitted (a search-only bar).

## Appearance

```
role="search"
┌──────────────────────────────────────────────┐
│ (search)  Search documents…                    │   <- Input (type=search), icon inset
└──────────────────────────────────────────────┘
┌─────────────────────┐ ┌─────────────────────┐
│ All categories    v │ │ All tags          v │   <- one Select per filter, in a row
└─────────────────────┘ └─────────────────────┘
```

- Root: `flex flex-col gap-2` (+ any `className`), `role="search"`.
- Search: the shared `Input` (`type="search"`, `className="pl-8"`) with a
  `lucide-react` `Search` icon absolutely positioned at the left
  (`absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apt-text-muted`,
  `aria-hidden`, `pointer-events-none`).
- Filter row: `flex gap-2`, each child the shared `Select` (full-width, so two
  selects share the row evenly and stack gracefully on narrow viewports).
- Colors are inherited from the `Input`/`Select` primitives — `apt-*` tokens only,
  no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Default | Search empty (placeholder shown); each select on its all-pass option |
| Search focused | `Input` gold focus ring (`focus-visible:ring-apt-gold/25`) |
| Filter active | Select shows the chosen option value |
| Filter focused | `Select` gold focus ring |
| No filters configured | Only the search field renders; no filter row |
| Disabled (per-primitive) | Inherited `Input`/`Select` disabled styling if the caller disables the underlying controls |

## Accessibility

- The container is a `role="search"` landmark region.
- The search field is labelled by `search.label` via `aria-label` (icon-only, no
  visible `<label>`), and is a `type="search"` box (`role="searchbox"`).
- Each filter `Select` is labelled by its `label` via `aria-label`.
- The decorative search icon is `aria-hidden` and not focusable.
- All controls are native, so keyboard operability and focus order are inherited
  from the platform.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-wrap-in-search-region | Render with only `search` | A single `role="search"` element wraps the controls |
| T2 | must-control-search-field, must-label-search-field | `search.label="Search documents"`; type `agents` | `getByRole("searchbox", { name: "Search documents" })` resolves; `onChange("agents")` fires |
| T3 | must-omit-empty-filter-row | Render with no `filters` | No `combobox`/select is present |
| T4 | must-render-one-select-per-filter, must-list-caller-options | Two filters (`category` opts `[Agents, Retrieval]`, `tag` opts `[rag]`) | Two labelled selects; `category` lists `All categories`, `Agents`, `Retrieval` (in order); `tag` lists `All tags`, `rag` |
| T5 | must-reflect-and-report-filter-value | `category.value="Agents"`; select `Retrieval` | Select shows `Agents` initially; `category.onChange("Retrieval")` fires |
| T6 | must-reflect-and-report-filter-value | `category.value="Agents"`; choose `All categories` | `category.onChange("")` fires |

## Edge Cases

- **Empty option list**: a filter with `options: []` still renders its all-pass
  option, so the select is never empty.
- **Stale selected value**: if a filter's `value` is not present in `options`, the
  native select falls back to no matching option; the caller owns keeping `value`
  within the option universe (e.g. the research pane sources options from the
  *unfiltered* document universe for this reason).
- **Search-only bar**: omit `filters` (or pass `[]`) for a bare search field.
- **Duplicate option strings**: `options` are keyed by their own string, so the
  caller must pre-dedupe; duplicates would collide on the React key.

## Configuration

`@adh-shared/ui/components/search-filter-bar`

| Option | Type | Default | Description |
|---|---|---|---|
| `search` | `SearchFieldConfig` | — (required) | The search field config (see below) |
| `filters` | `FilterSelectConfig[]` | `[]` | Filter selects rendered in a row under the search field |
| `className` | `string` | — | Extra classes on the `role="search"` root |

```ts
interface SearchFieldConfig {
  value: string                       // controlled text
  onChange: (value: string) => void   // called per keystroke
  label: string                       // accessible name (icon-only field)
  placeholder?: string
}

interface FilterSelectConfig {
  name: string                        // stable React key / axis id
  label: string                       // accessible name for the select
  value: string                       // selected value ("" = all-pass)
  options: string[]                   // value === visible text
  allLabel: string                    // text of the leading all-pass option
  onChange: (value: string) => void   // called with the new value ("" = all-pass)
}

interface SearchFilterBarProps {
  search: SearchFieldConfig
  filters?: FilterSelectConfig[]
  className?: string
}
export function SearchFilterBar(props: SearchFilterBarProps): React.ReactElement
```

## Logging

This ingredient is presentational and emits no structured log events. Searches and
filter changes are observed by the consuming feature (e.g. the research pane's list
fetch + telemetry), not by the bar.

## Platform Notes

- **React / Web (TypeScript):** Component at
  `websites/shared/ui/src/components/search-filter-bar.tsx`, composing the shared
  `Input` and `Select` primitives. Demoed in `ui-showcase` (Forms group). The hub
  `ResearchFilters` adapts its `{ q, category, tag }` `FilterState` onto it.
- **SwiftUI / Compose:** Not applicable — web-only shared component.

## Design Decisions

- **Decision**: Both the search field and every filter select are fully
  controlled, with caller-supplied option sets. **Rationale**: explicit-over-
  implicit — the bar owns no list/data state; it cannot desync from the consumer,
  and the consumer keeps option universes stable so narrowing never empties a
  dropdown.
- **Decision**: Options are plain `string[]` (value === text), not
  `{ value, label }`. **Rationale**: yagni — the only consumer uses string-equals
  options; a richer option type is a cheap, reversible addition if a future
  consumer needs value != label.
- **Decision**: Compose the existing `Input` + `Select` primitives rather than
  restyle. **Rationale**: dry / consistency — the bar inherits the standard
  focus-ring and token treatment, so it matches every other field on the platform.
- **Decision**: The filter row is omitted entirely when `filters` is empty.
  **Rationale**: principle-of-least-astonishment — a search-only bar shows no empty
  control row.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — apt-* tokens only, no raw hex, no `!important` | passed | adh-ui-guidelines |
| Accessibility — `role="search"`, labelled controls, aria-hidden icon | passed | a11y |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe — extracted from the hub research filter bar into `@adh-shared/ui`. |
