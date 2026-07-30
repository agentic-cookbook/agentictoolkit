---
id: 2ad7c681-6a9e-43ae-a9d9-b448939d3455
title: InfoPanel
domain: agenticdeveloperhub://recipes/info-panel
type: ingredient
version: 1.1.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A themable dashboard panel: bordered card with a standard header ([icon] title count · center · actions) over a content-sized or fill+scroll body."
platforms:
- typescript
- web
tags:
- component
- panel
- dashboard
- card
- ui
depends-on: []
related: []
references: []
---

# InfoPanel

## Overview

`InfoPanel` (`@agentic-toolkit/ui`) is the standard dashboard panel: a bordered,
rounded card with a consistent header over a body that is either **content-sized**
(a stat card) or a **fill + scroll** pane (a list). It is generic on purpose — the
host supplies whatever goes in the header slots and the body (icons, copy buttons,
filter controls, progress bars, rows) — so every dashboard panel across the
platform shares one frame and one header rhythm.

Header anatomy (single row):

```
[icon] [title] [count] [titleAfter]  …flex…  [center]  …flex…  [actions]
```

The header has a shared minimum height (`INFO_PANEL_HEADER_HEIGHT`, 41px), also
exported, so sibling panels laid side by side on a rail line their headers up even
when their content differs.

Two symbols ship from `@agentic-toolkit/ui/blocks/info-panel`:

- `InfoPanel` — the component.
- `INFO_PANEL_HEADER_HEIGHT` — the shared default header height, exported so hosts
  can align other, non-`InfoPanel` chrome to the same baseline.

## Behavioral Requirements

- **must-render-titled-header**: The component MUST render a header row containing the `title`, preceded by `icon` when provided and immediately followed by `titleAfter` when provided.
- **must-show-count-when-positive**: The component MUST render the `count` after the title only when it is provided and greater than zero, and MUST hide it otherwise.
- **must-place-header-slots**: The component MUST place `center` in a centered, flexible header slot and `actions` in a right-justified header slot.
- **must-right-justify-actions-without-center**: When `actions` is present and `center` is absent, the component MUST push the actions to the right edge of the header.
- **must-share-header-height**: The component MUST give the header a minimum height equal to `INFO_PANEL_HEADER_HEIGHT` so sibling panels' headers align.
- **must-default-content-sized-body**: By default (`scroll` false) the component MUST size the panel to its content and MUST NOT scroll the body.
- **must-fill-and-scroll-when-scroll**: When `scroll` is true, the component MUST let the panel flex to fill its track and MUST make the body scroll vertically when its content overflows.
- **must-expose-body-ref**: The component MUST attach `bodyRef` to the scrolling body element so the host can tail or anchor it.
- **must-label-region**: The component MUST expose the panel as a labeled region, defaulting the accessible name to `title` when it is a string and using `ariaLabel` when provided.
- **must-apply-mode-default-padding**: The component MUST apply body padding defaulting by mode (card vs scroll) and MUST use `bodyPadding` when provided.
- **must-honor-layout-props**: The component MUST apply caller-supplied `flex` and `maxHeight` to the outer element for host-controlled sizing.
- **must-spread-host-attributes**: The component MUST spread remaining host attributes (`data-*`, `id`, event handlers) onto the outer `<section>`, without overriding the computed accessible name.

## Appearance

Content-sized card (default):

```
┌───────────────────────────────────────────────┐
│ [◆] Title  12          ⟨center⟩        ⟨actions⟩│  header, min-height 41
├───────────────────────────────────────────────┤
│ content sized to its children (no scroll)       │
└───────────────────────────────────────────────┘
```

Fill + scroll (`scroll`):

```
┌───────────────────────────────────────────────┐
│ [◆] Title  128         ⟨center⟩        ⟨actions⟩│
├───────────────────────────────────────────────┤
│ rows…                                         ▲ │
│ rows…                                         █ │  body scrolls; panel flexes to fill
│ rows…                                         ▼ │
└───────────────────────────────────────────────┘
```

- Outer: `flex flex-col overflow-hidden rounded-[10px] border border-apt-border
  bg-apt-surface text-apt-text`; `min-h-0` added in scroll mode so the flex child
  can shrink. Outer `flex` defaults to `0 0 auto` (card) or `1 1 0` (scroll).
- Header: `flex flex-none items-center gap-2`, bottom border, `min-height` =
  `INFO_PANEL_HEADER_HEIGHT` (41). Title `text-sm font-semibold whitespace-nowrap`;
  count `font-mono text-[11px] text-apt-text-dim`.
- Body: `flex-none` (card) or `min-h-0 flex-auto overflow-y-auto` (scroll); default
  padding `12px 16px` (card) or `8px 16px 10px` (scroll), overridable via
  `bodyPadding`.
- Styled entirely with the `apt-*` token utilities; no raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Content-sized (default) | outer `flex: 0 0 auto`; body `flex-none`, no scroll |
| Fill + scroll (`scroll`) | outer `flex: 1 1 0` + `min-h-0`; body `flex-auto overflow-y-auto` |
| No icon | title starts the header (leading glyph slot omitted) |
| Count 0 / absent | count hidden |
| No center | actions block gains `ml-auto` to sit at the right edge |
| Center present | center fills the middle; actions sit to its right |
| `maxHeight` / `flex` set | outer element uses the caller's layout numbers |

## Accessibility

- The panel renders as a `<section>` with an accessible name: `ariaLabel` when
  given, else the `title` when it is a string, so the panel is a labeled landmark
  region.
- The leading `icon` is decorative and marked `aria-hidden`, so assistive tech reads
  the title rather than an unlabeled glyph.
- In scroll mode the body is a real scroll container (`overflow-y-auto`), keyboard-
  and screen-reader-scrollable; the host controls focusable content within it.
- Color and contrast come from the `apt-*` theme tokens, consistent across light and
  dark themes and every site.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-titled-header | `title="Fleet"`, `icon=<I/>`, `titleAfter=<Copy/>` | header shows icon, then "Fleet", then the copy control |
| T2 | must-show-count-when-positive | `count={12}` | "12" rendered after the title |
| T3 | must-show-count-when-positive | `count={0}` (or omitted) | no count rendered |
| T4 | must-place-header-slots | `center=<Bar/>`, `actions=<Gear/>` | center in the centered slot, actions in the right slot |
| T5 | must-right-justify-actions-without-center | `actions=<Gear/>`, no `center` | actions block carries `ml-auto` (right-aligned) |
| T6 | must-share-header-height | render two panels | both headers have `min-height: 41px` and align |
| T7 | must-default-content-sized-body | default (`scroll` unset) | outer `flex: 0 0 auto`; body has no `overflow-y-auto` |
| T8 | must-fill-and-scroll-when-scroll | `scroll` with overflowing content | outer `flex: 1 1 0`; body `overflow-y-auto` and scrolls |
| T9 | must-expose-body-ref | pass a `bodyRef` | the ref resolves to the scrolling body element |
| T10 | must-label-region | `title="Fleet"`, no `ariaLabel` | `<section aria-label="Fleet">` |
| T11 | must-label-region | non-string `title`, `ariaLabel="Fleet"` | `<section aria-label="Fleet">` |
| T12 | must-apply-mode-default-padding | `scroll` vs card, no `bodyPadding` | body padding `8px 16px 10px` (scroll) vs `12px 16px` (card) |
| T13 | must-honor-layout-props | `flex="2 1 0"`, `maxHeight={400}` | outer style carries that flex and `max-height: 400px` |
| T14 | must-spread-host-attributes | `data-testid="panel"`, `data-kind="monitor"` | outer `<section>` carries both attributes; `aria-label` still defaults from `title` |

## Edge Cases

- **Non-string title**: when `title` is a node (not a string) and no `ariaLabel` is
  given, the region has no accessible name — hosts SHOULD pass `ariaLabel` in that
  case.
- **Actions without center**: the actions container is given `ml-auto` only when
  `center` is absent, so it still hugs the right edge without a center spacer.
- **Count exactly 0**: treated as "nothing to show" and hidden (only `> 0` renders),
  so an empty list's panel doesn't show a "0".
- **Scroll flex child**: `min-h-0` is applied in scroll mode so the panel can shrink
  below its content inside a flex parent and let the body — not the panel — scroll.
- **Body padding override**: `bodyPadding` fully replaces the mode default; hosts
  needing edge-to-edge content (e.g. a table) pass `bodyPadding="0"`.
- **maxHeight with card mode**: a content-sized card given a `maxHeight` will clip via
  the outer `overflow-hidden`; use `scroll` to make the body scroll within that cap.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `ReactNode` | — (required) | Header title. |
| `children` | `ReactNode` | — (required) | Body content. |
| `icon` | `ReactNode` | — | Leading glyph before the title (decorative, `aria-hidden`). |
| `titleAfter` | `ReactNode` | — | Rendered immediately after the title (e.g. a copy button). |
| `count` | `number` | — | Dim count after the title; hidden when absent or ≤ 0. |
| `center` | `ReactNode` | — | Centered header slot (e.g. a progress bar). |
| `actions` | `ReactNode` | — | Right-justified header slot (e.g. filter + gear). |
| `scroll` | `boolean` | `false` | Fill + scroll body; false = content-sized card. |
| `flex` | `string` | `scroll ? "1 1 0" : "0 0 auto"` | Outer flex shorthand. |
| `maxHeight` | `string \| number` | — | Outer max height. |
| `bodyPadding` | `string` | `scroll ? "8px 16px 10px" : "12px 16px"` | Body padding. |
| `bodyRef` | `Ref<HTMLDivElement>` | — | Ref to the scrolling body element. |
| `ariaLabel` | `string` | `title` if string | Accessible region name. |
| `className` / `style` | `string` / `CSSProperties` | — | Merged onto the outer `<section>`. |
| …rest | `Omit<HTMLAttributes<HTMLElement>, "title">` | — | Remaining host attributes (`data-*`, `id`, handlers) spread onto the outer `<section>`. |

`INFO_PANEL_HEADER_HEIGHT` (= 41) is exported so hosts can align non-`InfoPanel`
chrome to the same header baseline.

## Logging

No logging. `InfoPanel` is a presentational container; any data-loading or
interaction telemetry belongs to the host content it wraps.

## Platform Notes

- File: `websites/shared/ui/src/blocks/info-panel.tsx`.
- `"use client"` (uses `Ref` typing / client composition), though it holds no state
  itself.
- Styled with the family `apt-*` token utilities (`apt-border`, `apt-surface`,
  `apt-text`, `apt-text-dim`) registered centrally via `@source`, so the utilities
  exist on every site without per-site config.
- Demo: `ui-showcase` Topic `info-panel` (regenerate `sources.generated.ts` via
  `gen-sources.py` after source changes).

## Design Decisions

- **One frame, host-owned slots.** The panel fixes the border/radius/surface and the
  header rhythm but leaves every slot (`icon`, `title`, `titleAfter`, `count`,
  `center`, `actions`, body) to the host, so a stat card and a scrolling list share
  one component instead of two bespoke frames.
- **Shared, exported header height.** Header alignment across sibling panels on a rail
  requires a common baseline; exporting `INFO_PANEL_HEADER_HEIGHT` (a `min-height`,
  not a fixed height) lets headers align while still growing for taller content.
- **Two body modes on one prop.** `scroll` switches both the outer flex (`0 0 auto`
  vs `1 1 0` + `min-h-0`) and the body (`flex-none` vs `flex-auto overflow-y-auto`),
  so "stat card" and "fill + scroll list" are a single boolean rather than two
  components.
- **`apt-*` tokens over inline hex.** The panel uses the central token utilities so it
  themes correctly on every site; the older inline-style + hex-fallback layer was
  dropped once `@source` guaranteed the utilities exist everywhere.
- **`bodyRef` for tail/anchor.** Exposing the scroll element lets hosts implement
  scroll-to-bottom / anchoring without the panel owning that behavior.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` (uses `apt-*` tokens) | pass | project-guidelines UI |
| Labeled region; decorative icon `aria-hidden`; real scroll container | pass | accessibility |
| Generic/host-owned slots (no bespoke per-site frames) | pass | project-guidelines UI |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the header anatomy, content-sized vs fill+scroll body, and the shared header-height alignment. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | Host-attribute passthrough: remaining HTML attributes spread onto the root `<section>` (data-* tagging without a wrapper). |
