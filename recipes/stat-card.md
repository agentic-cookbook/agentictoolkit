---
id: b7a4a259-620f-42a3-8bc2-9e5c07c1819d
title: StatCard
domain: agenticdeveloperhub://recipes/stat-card
type: recipe
version: 1.1.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The dashboard stat card — an InfoPanel headed by an icon + title with a “{tool} ↗” deep link, over StatRows, freeform children, and a muted mono footnote."
platforms:
- typescript
- web
tags:
- block
- stat
- card
- dashboard
- ui
ingredients:
- agenticdeveloperhub://recipes/info-panel
- agenticdeveloperhub://recipes/stat
- agenticdeveloperhub://recipes/external-link
depends-on: []
related: []
references: []
---

# StatCard

## Overview

`StatCard` in `@agentic-toolkit/ui` is the dashboard stat card: an `InfoPanel` headed by
an icon + title with an optional "{tool} ↗" deep link (plus optional extra header
controls via `actions`) in the header actions slot, over a vertical stack of `StatRow` figures, optional freeform content, and a muted
mono footnote. It is **pure assembly** — the shell is `InfoPanel`, the rows are
`StatRow`, the link is `ExternalLink` — so this block owns only the arrangement (a
`gap-2.5` column plus the footnote treatment), not any new chrome.

From a declarative `stats[]` (each `{ label, value, tone }`) it renders one `StatRow`
per entry; `children` render after the rows for the freeform cases (a live error
line, a sparkline), and `footnote` renders last as a small dim mono qualifier (e.g.
"anonymous · cookieless · approximate"). The card is always content-sized — it uses
`InfoPanel`'s default (non-scroll) mode, so it grows to its content rather than
scrolling.

It was extracted from the status site's Traffic/Errors telemetry cards
(`websites/status-backend/web/src/components/TelemetrySections.tsx`), so every site's
"figure card with a deep link into the source tool" shares one component.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| InfoPanel | agenticdeveloperhub://recipes/info-panel | The card shell — bordered/rounded frame with the standard header (icon + title) and a content-sized body | yes | `title`, `icon`, `actions` (the link + extra `actions`), `className` and remaining host attributes forwarded; default content-sized (no `scroll`) |
| StatRow | agenticdeveloperhub://recipes/stat | One label/value figure per `stats[]` entry, in the body stack | yes (when `stats[]` non-empty) | `label`, `value`, `tone` passed through from each `StatCardStat` |
| ExternalLink | agenticdeveloperhub://recipes/external-link | The "{label} ↗" deep link into the source tool, placed in the InfoPanel actions slot | no (only when `link` given) | `href` = `link.href`, children = `link.label`; opens a new tab (noopener) |

The body-stack container, the footnote treatment, and the `stats[]`→rows mapping are
the only things this block owns; `StatCardStat` (`{ label, value, tone }`) is exported
alongside the component.

## Integration Requirements

- **must-render-infopanel-shell**: The card MUST render as an `InfoPanel` whose title is `title` and whose leading glyph is `icon`, exposing the card as a labeled region named by `title`.
- **must-place-link-in-actions**: When `link` is provided, the card MUST render an `ExternalLink` to `link.href` labeled `link.label` in the InfoPanel actions slot, and MUST omit the actions slot when both `link` and `actions` are absent.
- **must-render-actions-after-link**: When `actions` is provided, the card MUST render it in the InfoPanel actions slot, after the deep link when both are present.
- **must-spread-host-attributes**: The card MUST pass remaining host attributes (`data-*`, `id`, handlers) through to the InfoPanel root `<section>`, so hosts can tag the card without a wrapper element.
- **must-render-a-statrow-per-stat**: The card MUST render one `StatRow` per `stats[]` entry, passing that entry's `label`, `value`, and `tone`.
- **must-render-children-after-rows**: The card MUST render `children` after the stat rows, within the same body stack.
- **must-render-footnote-when-present**: The card MUST render `footnote` as a muted mono caption after the children, and MUST omit it when `footnote` is null/undefined.
- **must-stack-body-vertically**: The card MUST arrange the rows, children, and footnote in a single vertical `gap-2.5` column.
- **must-forward-classname**: The card MUST forward `className` onto the InfoPanel outer element.

## Layout

```
┌ InfoPanel  aria-label = title ─────────────────────────────┐
│ [icon] Title                              PostHog ↗         │  header (icon + title; link in actions)
├────────────────────────────────────────────────────────────┤
│ ┌ body stack: flex flex-col gap-2.5 ────────────────────┐   │
│ │ PAGEVIEWS · 7D                                637      │   │  ← StatRow (stats[0])
│ │ VISITORS · 7D                                 538      │   │  ← StatRow (stats[1])
│ │ …children (freeform, after the rows)…                 │   │
│ │ anonymous · cookieless · approximate                  │   │  ← footnote (muted mono 10px)
│ └───────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

- Shell: `InfoPanel` in its default content-sized (non-scroll) mode; `title`, `icon`,
  `className`, and remaining host attributes pass straight through; the InfoPanel
  actions slot receives the `ExternalLink` (when `link` is set) followed by any
  extra `actions`, and is omitted when both are absent.
- Body: a single `<div className="flex flex-col gap-2.5">` holding, in order, the
  mapped `StatRow`s, then `children`, then the footnote.
- Footnote: `pt-0.5 font-mono text-[10px] text-apt-text-dim` — matched to the StatRow
  label's micro-caption grammar; rendered only when `footnote != null`.
- No raw hex, no `!important` — all color/typography via `apt-*` tokens and the
  composed shared parts.

## Shared State

`StatCard` holds no state — it is pure, declarative assembly. Every prop flows down
into a composed part; nothing flows back up except the browser navigation an
`ExternalLink` triggers (a new tab).

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| `title` / `icon` / `className` | Caller | InfoPanel | Down | Prop pass-through |
| `link` (`{href,label}`) | Caller | ExternalLink (actions slot) | Down | Prop → `actions` |
| `actions` | Caller | InfoPanel actions slot (after the link) | Down | Prop → `actions` |
| host attributes (`data-*`, `id`) | Caller | InfoPanel root `<section>` | Down | Rest-prop spread |
| `stats[]` | Caller | StatRow (one per entry) | Down | Array `map` |
| `children` | Caller | Body stack (after rows) | Down | Prop |
| `footnote` | Caller | Footnote caption | Down | Prop (rendered when non-null) |
| deep-link navigation | ExternalLink | New browser tab | Up (side effect) | `target="_blank"` anchor |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-infopanel-shell, must-place-link-in-actions, must-render-a-statrow-per-stat, must-render-footnote-when-present | `<StatCard title="Traffic" link={{href:'https://us.posthog.com',label:'PostHog'}} stats={[{label:'pageviews · 7d',value:'637'},{label:'visitors · 7d',value:'538'}]} footnote="anonymous · cookieless · approximate" />` | region named "Traffic"; a "PostHog ↗" link with `href="https://us.posthog.com"`; rows "pageviews · 7d"/"637" and "visitors · 7d"/"538"; footnote text present |
| T2 | must-render-children-after-rows, must-stack-body-vertically | `<StatCard title="Errors" stats={[{label:'open issues',value:'0'}]}><div>✓ No errors reported</div></StatCard>` | "✓ No errors reported" rendered after the "open issues"/"0" row, inside the one `flex flex-col gap-2.5` body stack |
| T3 | must-place-link-in-actions | `<StatCard title="Errors" stats={[...]} />` (no `link`) | no `ExternalLink`/anchor in the header actions slot |
| T4 | must-render-a-statrow-per-stat | `stats={[{label:'open issues',value:'2',tone:'error'}]}` | value "2" carries the error tone (`text-apt-red`) via StatRow |
| T5 | must-render-footnote-when-present | StatCard with no `footnote` | no footnote caption element rendered |
| T6 | must-render-infopanel-shell | `icon={<Bug/>}` | icon rendered as the decorative leading glyph (`aria-hidden` via InfoPanel) before the title |
| T7 | must-forward-classname | `className="col-span-2"` | InfoPanel outer `<section>` carries `col-span-2` |
| T8 | must-render-actions-after-link, must-place-link-in-actions | `link={{href:'https://g.example',label:'Grafana'}} actions={<span>healthy</span>}` | header actions slot holds the "Grafana ↗" link, then the status word |
| T9 | must-spread-host-attributes | `data-testid="monitor-card" data-monitor="lewis" data-phase="ok"` | outer `<section>` carries all three attributes |

## Edge Cases

- **No `stats`**: `stats?.map(...)` no-ops, so a card with only `children` and/or a
  `footnote` renders fine (`stats` is optional).
- **No `link` and no `actions`**: the InfoPanel actions slot is omitted entirely
  (the header shows just icon + title).
- **`actions` without `link`**: the slot renders just the extra controls (e.g. a
  monitor card's live status word), right-justified by InfoPanel.
- **`footnote` guard is `!= null`**: `null`/`undefined` hide the footnote; an empty
  string (`""`) is *not* null and WOULD render an empty caption — pass `undefined` to
  hide, not `""`.
- **Rows + children + footnote together**: order is always rows → children → footnote
  within the one `gap-2.5` stack; `children` is the escape hatch for anything the
  declarative `stats[]` can't express (e.g. the status Errors card's live error line
  with a `StatusDot` and a count).
- **Always content-sized**: it never passes `scroll` to InfoPanel, so a long stat list
  grows the card rather than scrolling; use InfoPanel directly if scroll is needed.
- **`icon` is decorative**: InfoPanel marks the leading glyph `aria-hidden`, so the
  card's accessible name is the `title` alone — keep `title` a string for a named region.
- **Per-stat `tone`**: omitted `tone` falls back to StatRow's `neutral`; the card adds
  no tone of its own.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/blocks/stat-card.tsx`,
  exported from `@agentic-toolkit/ui` (`@agentic-toolkit/ui/blocks/stat-card`). Composes
  `InfoPanel` (`../blocks/info-panel`), `StatRow` (`../components/stat`), and
  `ExternalLink` (`../components/external-link`). Exports `StatCard`, `StatCardProps`,
  and the `StatCardStat` type.
- Historical source: the status site's Traffic/Errors telemetry cards
  (`websites/status-backend/web/src/components/TelemetrySections.tsx`) — StatCard
  generalizes that pattern for every site.
- Demo: `ui-showcase` Topic `stat-card` (group "Blocks — cards & sections"); the demo
  shows a Traffic card (declarative stats + footnote), an Errors card (stats +
  freeform children), and a monitor card (header `actions` status word, no link).
  Regenerate `sources.generated.ts` via `gen-sources.py` after source changes.
- **Responsive:** the demo lays the cards in a `sm:grid-cols-2` grid; each card is
  content-sized and full-width in its cell — verify at 375 / 768 / 1440.
- **SwiftUI / Compose:** not applicable — web-only shared block.

## Design Decisions

- **Decision**: StatCard is pure assembly of `InfoPanel` + `StatRow` + `ExternalLink`,
  owning only the body stack and footnote. **Rationale**: the "figure card with a
  deep link" shape recurred across the status board and admin console; centralizing
  the *arrangement* (not new chrome) keeps every such card identical and lets the
  parts evolve independently.
- **Decision**: stats are declarative (`stats[]`) with `children` as an escape hatch.
  **Rationale**: the common case (a list of label/value figures) is data, not markup;
  `children` covers the rare freeform tail (a live error line) without forcing every
  caller into imperative rows.
- **Decision**: the `link` maps to an `ExternalLink` in the InfoPanel actions slot.
  **Rationale**: a stat card almost always deep-links into its source tool (PostHog,
  GlitchTip); putting that "{tool} ↗" in the header's actions slot is the established
  dashboard grammar and keeps the affordance out of the figure rows.
- **Decision**: the footnote is a fixed muted mono 10px qualifier matched to the
  StatRow label. **Rationale**: caveats like "approximate · cookieless" read as chrome
  around the figures, so they share the label's micro-caption treatment rather than
  competing with the values.
- **Decision**: always content-sized (never `scroll`). **Rationale**: a stat card is a
  short, fixed set of figures; letting it grow keeps all figures visible, and callers
  needing a scrolling list use `InfoPanel` directly.
- **Decision**: `actions` is a passthrough slot rendered after the deep link, and host
  attributes spread onto the root. **Rationale**: the fleet status page's monitor card
  needed a live status word in the header and `data-*` hooks on the card root; exposing
  InfoPanel's existing slot and attribute spread keeps that card on the one StatCard
  grammar instead of forcing a site back onto raw InfoPanel + a duplicated footnote.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | pass | artifact-formatting |
| No raw hex / arbitrary colors / `!important` (uses `apt-*` tokens) | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Labeled region (InfoPanel), decorative icon `aria-hidden`, deep link opens `noopener` new tab | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the InfoPanel + StatRow + ExternalLink assembly extracted from the status telemetry cards. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | `actions` header slot (extra controls after the deep link) + host-attribute passthrough to the panel root; adopted by the fleet status monitor card. |
