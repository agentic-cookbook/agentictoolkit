---
id: c57b1aed-ef38-4803-b38a-2d7e0aeced5f
title: SearchFilterBar
domain: agenticdeveloperhub://recipes/search-filter-bar
type: ingredient
version: 1.1.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-08-24'
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

A search-and-filter bar in `@agentic-toolkit/ui` that sits above a list. It combines a
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
  `options` (in order) as `<option>`s after the all-pass entry. A bare string
  option MUST be used as both the value and the visible text; a
  `{ value, label }` option MUST store `value` and read as `label`. The two forms
  MUST be mixable on one axis.
- **must-reflect-and-report-filter-value**: The SearchFilterBar MUST set each
  select's current value from the filter's `value` and call that filter's
  `onChange` with the newly selected value (the empty string when the all-pass
  entry is chosen).
- **must-render-extra-controls-in-filter-row**: The SearchFilterBar MUST render
  `children` in the filter row, after any `filters`, so a caller-supplied control
  is one more axis on the same row rather than a second bar.
- **must-omit-empty-filter-row**: The SearchFilterBar MUST NOT render the filter
  row when it would be empty — no `filters` and no `children` that React would
  actually render (a `false`/`null` child does not open the row).
- **must-lay-out-by-orientation**: The SearchFilterBar MUST stack the filter row
  under the search field by default (`orientation="stacked"`), and MUST lay the
  field and the row out as one wrapping line when `orientation="inline"`, the
  search field taking the free space with a minimum width of its own.
- **may-scope-autofill-with-a-form**: The SearchFilterBar MAY root itself on a
  `<form>` instead of a `<div>` when `asForm` is set, carrying `role="search"`
  onto that element and cancelling its `submit`. It MUST default to the `<div>`.

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

- Root: `flex flex-col gap-2` when stacked, `flex flex-wrap items-center gap-2`
  when inline (+ any `className`), `role="search"` — on a `<div>`, or on a
  `<form>` when `asForm` is set.
- Search: the shared `Input` (`type="search"`, `className="pl-8"`) with a
  `lucide-react` `Search` icon absolutely positioned at the left
  (`absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apt-text-muted`,
  `aria-hidden`, `pointer-events-none`).
- Filter row: `flex gap-2`, each child the shared `Select` (full-width, so two
  selects share the row evenly and stack gracefully on narrow viewports),
  followed by any `children`.
- Inline only: the search field's wrapper takes `min-w-48 flex-1` — a bare
  `flex-1` would let an empty field collapse to its icon, since a flex item's
  floor is its content width and an empty search box has none.
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

- The container is a `role="search"` landmark region, optionally named by
  `aria-label` — recommended when a page carries more than one search region.
  `asForm` moves that role onto a `<form>`, which changes nothing for assistive
  tech: a `<form>` is a landmark only once it is named, and this one's name and
  role are the region's.
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
| T7 | must-list-caller-options | One axis, `options: [{ value: "st-1", label: "Todo" }, { value: "st-2", label: "Done" }]`; select `Done` | Options read `Todo`/`Done` and none reads `st-1`; `onChange("st-2")` fires |
| T8 | must-list-caller-options | One axis, `options: ["Backlog", { value: "it-1", label: "Sprint 3" }]` | Option `Backlog` has value `Backlog`; option `Sprint 3` has value `it-1` |
| T9 | must-render-extra-controls-in-filter-row, must-omit-empty-filter-row | One filter plus a `<button>Platforms</button>` child; then the same child with no filters; then `{false}` as the only child | Button and select share one row; the child alone still draws the row; `{false}` draws no row (one child element under the root) |
| T10 | must-lay-out-by-orientation | Render default, then rerender `orientation="inline"` | Root has `flex-col` by default; inline drops it for `flex-wrap`, and the field wrapper carries `flex-1 min-w-48` |
| T11 | may-scope-autofill-with-a-form | Render default, then rerender `asForm` | Root is a `DIV`, then a `FORM`; exactly one `role="search"` either way; `fireEvent.submit` on the form reports the event cancelled |

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

`@agentic-toolkit/ui/components/search-filter-bar`

| Option | Type | Default | Description |
|---|---|---|---|
| `search` | `SearchFieldConfig` | — (required) | The search field config (see below) |
| `filters` | `FilterSelectConfig[]` | `[]` | Filter selects rendered in the filter row |
| `orientation` | `"stacked" \| "inline"` | `"stacked"` | Filter row under the field, or one wrapping line with it |
| `children` | `React.ReactNode` | — | Extra filter controls, rendered in the row after `filters` |
| `asForm` | `boolean` | `false` | Root on a `<form>` (submit cancelled) rather than a `<div>`, to scope autofill |
| `className` | `string` | — | Extra classes on the `role="search"` root |
| `aria-label` | `string` | — | Accessible name for the `role="search"` landmark |

```ts
interface SearchFieldConfig {
  value: string                       // controlled text
  onChange: (value: string) => void   // called per keystroke
  label: string                       // accessible name (icon-only field)
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

interface FilterSelectOption {
  value: string                       // what the axis stores and reports
  label: string                       // what the option reads as
}

interface FilterSelectConfig {
  name: string                        // stable React key / axis id
  label: string                       // accessible name for the select
  value: string                       // selected value ("" = all-pass)
  options: readonly (string | FilterSelectOption)[]  // bare string = value is the text
  allLabel: string                    // text of the leading all-pass option
  onChange: (value: string) => void   // called with the new value ("" = all-pass)
}

interface SearchFilterBarProps {
  search: SearchFieldConfig
  filters?: FilterSelectConfig[]
  orientation?: "stacked" | "inline"
  children?: React.ReactNode
  asForm?: boolean
  className?: string
  "aria-label"?: string
}
export function SearchFilterBar(props: SearchFilterBarProps): React.ReactElement
```

## Logging

This ingredient is presentational and emits no structured log events. Searches and
filter changes are observed by the consuming feature (e.g. the research pane's list
fetch + telemetry), not by the bar.

## Platform Notes

- **React / Web (TypeScript):** Component at
  `packages/web/packages/ui/src/components/search-filter-bar.tsx` in the
  agentictoolkit repo, composing the shared `Input` and `Select` primitives.
  Demoed in `ui-showcase` (Forms group). The hub `ResearchFilters` adapts its
  `{ q, category, tag }` `FilterState` onto it.
- **iOS / Safari:** a search field with no `<form>` ancestor is scoped for
  autofill against the whole document, so on a page that also carries
  contact-shaped content iOS can offer "AutoFill Contact" over the search box.
  `asForm` is the fix for those pages; the attribute bag the shared `Input`
  applies (`autocomplete="off"` plus the password-manager opt-outs) is not
  sufficient on its own.
- **SwiftUI / Compose:** Not applicable — web-only shared component.

## Design Decisions

- **Decision**: Both the search field and every filter select are fully
  controlled, with caller-supplied option sets. **Rationale**: explicit-over-
  implicit — the bar owns no list/data state; it cannot desync from the consumer,
  and the consumer keeps option universes stable so narrowing never empties a
  dropdown.
- **Decision**: An option is a bare string *or* a `{ value, label }` pair, and the
  two mix on one axis. **Rationale**: the original `string[]` was a yagni bet that
  a consumer proved wrong — an axis over *records* (a status, an iteration, an
  owner) filters by id and reads as a name. Making the caller keep a label↔id
  codec of its own would be a lossy guess about data it already holds correctly:
  two ids can share a display name, and two names can share an id. The bare string
  stays as the shorthand for the case where they coincide, so no existing caller
  had to change.
- **Decision**: `children` land in the filter row rather than in a config union.
  **Rationale**: yagni / optimize-for-change — `filters` covers the single-select
  axis, which is most of them; an axis that is genuinely a different control (a
  multi-select, a date range, a toggle group) composes at the call site instead of
  growing a union that has to describe every control the platform will ever filter
  with. The bar supplies the landmark, the field and the row.
- **Decision**: `asForm` lives here, off by default, rather than each host
  wrapping the bar in its own `<form>`. **Rationale**: dry — "a search field with
  no form ancestor is autofilled against the whole document" is a property of
  search fields, not of any one page, and it is a measured platform quirk that
  needs a paragraph to be legible at a call site. Default-off because a bar
  rendered inside a host's own form would nest one, which the parser resolves by
  dropping it.
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
| 1.1.0 | 2026-08-24 | Mike Fullerton | Added `asForm` for the iOS autofill scoping the registry search needs. Brought the spec back level with the component: `{ value, label }` options, `orientation`, `children`, `aria-label`, `onKeyDown`, and the moved source path. |
