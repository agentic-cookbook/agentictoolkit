---
id: b7a4e24c-3dfe-4a33-b5bc-88736e520d90
title: Hierarchical Document View
domain: agenticdeveloperhub://recipes/hierarchical-document-view
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-29'
modified: '2026-07-29'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "HDV — the shared long-form document reader. This version covers its centre column: DocBreadcrumbs, DocArticle, and DocMetadata."
platforms:
- typescript
- web
tags:
- block
- document
- reader
- navigation
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/hierarchical-topic-detail
- agenticdeveloperhub://recipes/disclosure
references: []
---

# Hierarchical Document View

## Overview

**HDV** (Hierarchical Document View) is the family's long-form **document reader**:
a three-column layout of a collapsible multi-depth nav tree, a prose centre column
(breadcrumbs → article → frontmatter → change history → view-source), and a
scrollspy table of contents. It is extracted from the cookbook site, which had the
best reader in the family trapped inside one Next app.

HDV is **not** a variant of `HierarchicalTopicDetail`. HTDV's `TopicDetailItem` is
flat — it has no `children` — so it structurally cannot render a nested document
tree; and HTDV stacks *panes* horizontally where HDV nests *one* tree vertically at
arbitrary depth with per-branch collapse. They are different shapes that happen to
share the word "hierarchical".

**This version covers the centre column only**, landing in stages:

| Component | Status |
|---|---|
| `DocBreadcrumbs`, `DocArticle`, `DocMetadata` | **this version** |
| `DocTableOfContents` + `useScrollSpy` | next |
| `ViewSourceDisclosure` (composes `Disclosure`) | next |
| `DocNavTree` / `DocNav` | next |
| `HierarchicalDocumentView` (the shell) | next |

The governing constraint for the whole extraction is that **it is a move, not a
redesign**: every default here byte-matches what the cookbook site rendered before
it, so a visual delta is a bug rather than a judgement call. Redesign happens later,
on a green base.

Two seams keep site vocabulary out of the toolkit:

- **Routing.** HDV never imports `next/link` or `next/navigation`. A host injects
  its router as `LinkComponent` (a component taking `to`, not `href`) and tells HDV
  which page is current with a plain `activePath` string. The default is a bare
  `<a href>`, so a non-Next app needs no adapter at all.
- **Vocabulary.** HDV lays a frontmatter block out; it never decides what a
  document's frontmatter *contains*. The host maps its own fields to a list of
  label/value pairs.

## Behavioral Requirements

- **must-render-crumbs-in-order**: `DocBreadcrumbs` MUST render a fixed home crumb first, then one crumb per entry of `crumbs` in the given order, separated by a `/` glyph before every crumb but never before home.
- **must-render-current-page-as-text**: `DocBreadcrumbs` MUST render the LAST crumb as non-interactive text and every earlier crumb, plus home, as a link.
- **must-hide-empty-trail**: `DocBreadcrumbs` MUST render nothing at all when `crumbs` is empty, rather than a lone home crumb pointing at the current page.
- **must-route-through-injected-link**: `DocBreadcrumbs` MUST render every link through `LinkComponent`, passing the destination as `to`, and MUST default to a plain `<a href>` when the host injects none.
- **must-accept-a-relabelled-home**: `DocBreadcrumbs` MUST honour `homeLabel` and `homeHref` so a host can re-point or rename the first crumb.
- **must-render-trusted-html**: `DocArticle` MUST render the `html` string as markup inside its element, and MUST apply the family prose typography contract to it.
- **must-expose-the-prose-contract**: The prose class list MUST be exported so a host can apply the same typography to prose it renders itself.
- **must-honor-article-element**: `DocArticle` MUST render as an `article` by default and as the element named by `as` otherwise.
- **must-render-one-row-per-field**: `DocMetadata` MUST render one `dt`/`dd` row per entry of `fields`, in the given order, right-aligned as a single column.
- **must-group-list-values**: `DocMetadata` MUST render an array `value` as a wrapping right-aligned group of its items, and any other `value` as-is with no wrapper.
- **must-hide-empty-metadata**: `DocMetadata` MUST render nothing when `fields` is empty.
- **must-spread-host-attributes**: All three MUST spread remaining host attributes (`data-*`, `id`, handlers) onto their root element.

## Appearance

The centre column is a `max-w-3xl` prose measure. Every colour is a flat
`--color-*` token from the shared ADH theme — the same contract
`@adh-shared/adh/styles.css` provides to every site in the family — so HDV inherits
the host's palette without a per-site restyle.

```
 Home / Principles / Simplicity          ← DocBreadcrumbs (font-mono text-xs, dim)
 ─────────────────────────────────────
 # Simplicity                            ← DocArticle (.prose, trusted HTML)
 Body prose, headings, code, tables…
                          version 1.2.0  ← DocMetadata (right-aligned dl, 11px mono)
                        modified 2026-07-28
                      references a.com  b.com
 ## Change History                       ← a SECOND DocArticle (host splits the HTML)
 | Version | Date | … |
```

- Breadcrumbs: `nav[aria-label="Breadcrumb"] mb-4` → `ol.flex.items-center.gap-1
  font-mono text-xs text-[var(--color-text-dim)]`; separator
  `text-[var(--color-border)]`; current page `text-[var(--color-text-secondary)]`;
  links hover to `text-[var(--color-text-secondary)]`.
- Article: `prose max-w-none prose-headings:scroll-mt-20
  prose-code:before:content-none prose-code:after:content-none`. The
  `scroll-mt-20` is load-bearing — it keeps a heading clear of the sticky header
  when the ToC scrolls to it.
- Metadata: `dl.flex.flex-col.items-end.gap-0.5 font-mono text-[11px] mb-6`; rows
  `flex gap-2`; `dt` dim, `dd` secondary; a list value wraps in
  `flex flex-wrap justify-end gap-x-3`.
- No raw hex, no `!important`.

## States

| Component | State | Rendering |
|---|---|---|
| `DocBreadcrumbs` | trail non-empty | home + crumbs, last as text |
| `DocBreadcrumbs` | `crumbs: []` (site root) | renders nothing |
| `DocBreadcrumbs` | crumb link hover | text lifts dim → secondary |
| `DocArticle` | `html: ""` | an empty prose container (the host decides whether to render it) |
| `DocMetadata` | `fields: []` | renders nothing |
| `DocMetadata` | array value | items wrap right-aligned across lines |

All three are pure and stateless — no internal state, no effects, and therefore no
`"use client"` boundary. They render identically on the server and the client.

## Accessibility

- The breadcrumb trail is a `nav` labelled `Breadcrumb`, so assistive tech
  announces it as the trail rather than as generic links.
- The current page is a `span`, not a link — there is no self-referential link to
  land on, and the trail's end is unambiguous.
- The `/` separators are text inside the list item; they carry no role and are not
  announced as interactive.
- The frontmatter block is a real `dl`/`dt`/`dd`, so each value is announced with
  its label rather than as a run of loose text.
- Reference links that open a new tab carry `rel="noopener noreferrer"` — supplied
  by the host, since the host owns the link nodes.
- `DocArticle`'s heading structure comes from the host's rendered HTML; HDV adds no
  headings of its own and so cannot break the document outline.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-hide-empty-trail | `<DocBreadcrumbs crumbs={[]} />` | nothing rendered |
| T2 | must-render-crumbs-in-order | 2 crumbs | 3 `li` (home + 2) and exactly 2 `/` separators |
| T3 | must-render-current-page-as-text | 2 crumbs | links are `/` and the first crumb's path; the last crumb is a `span` |
| T4 | must-route-through-injected-link | a `LinkComponent` marking its output | every link carries the adapter's marker, and HDV's `className` survives its prop spread |
| T5 | must-accept-a-relabelled-home | `homeLabel="Docs" homeHref="/docs"` | first crumb reads "Docs" and points at `/docs` |
| T6 | must-render-trusted-html | `html="<h2 id='intro'>Intro</h2><p>Body</p>"` | an `article` containing an `h2#intro` and the body text |
| T7 | must-expose-the-prose-contract | `<DocArticle html="" />` | `className` equals `DOC_ARTICLE_PROSE_CLASS` exactly (nothing rewrote or reordered it) |
| T8 | must-honor-article-element | `as="div"` | the root is a `div` |
| T9 | must-hide-empty-metadata | `<DocMetadata fields={[]} />` | nothing rendered |
| T10 | must-render-one-row-per-field | 2 fields | `dt` text in order; `dd` text in order; `dt` dim, `dd` secondary |
| T11 | must-group-list-values | an array of 2 nodes | one `dd > span.flex.flex-wrap.justify-end.gap-x-3` with 2 children |
| T12 | must-group-list-values | a scalar value | no wrapping `span` inside the `dd` |
| T13 | must-spread-host-attributes | `data-testid` on each | the attribute lands on the root element |

## Edge Cases

- **Site root.** `crumbs: []` hides the whole nav — a lone "Home" pointing at the
  page you are on is noise, not navigation.
- **A document with no change history.** The host's split returns an empty second
  half and simply renders one `DocArticle`; HDV has no opinion about the split.
- **A frontmatter field whose value is a list.** References and tags wrap
  right-aligned rather than pushing the row off the edge.
- **Non-URL citations.** Books and papers are cited in prose ("Osborn, *Applied
  Imagination*, 1953"); an `<a href>` around one points nowhere, so the host decides
  per item whether it is a link. HDV renders whatever nodes it is given.
- **Heading ids.** Anchors come from the host's markdown slugger (cookbook uses
  `rehype-slug`). HDV takes them as given — a change to that slug config silently
  breaks scroll-to-heading without HDV changing.
- **Untrusted HTML.** `DocArticle` uses `dangerouslySetInnerHTML` and does no
  escaping. See Configuration.

## Configuration

| Component | Prop | Default | Meaning |
|---|---|---|---|
| `DocBreadcrumbs` | `crumbs` | — | `{ label, path }[]`, root-first; the last is the current page |
| | `homeLabel` | `"Home"` | label for the fixed first crumb |
| | `homeHref` | `"/"` | destination for the fixed first crumb |
| | `LinkComponent` | `DefaultDocLink` | the host's router link, taking `to` |
| `DocArticle` | `html` | — | pre-rendered, already-trusted document HTML |
| | `as` | `"article"` | `article` for a document, `div`/`section` for a fragment |
| `DocMetadata` | `fields` | — | `{ label, value }[]` in display order; an array `value` renders as a wrapping group |

⚠️ **`DocArticle` is trusted-input only.** `html` goes through
`dangerouslySetInnerHTML`, so it must be markup the host itself produced — a
build-time markdown render of files in its own repo, say. Never pass
user-submitted or third-party HTML without sanitising it first; HDV does no
escaping and cannot.

The host derives `crumbs` itself rather than HDV deriving them from a slug: every
site slices its URL space differently (cookbook title-cases domain segments; another
site would look labels up in a manifest), and deriving them here would bake one
site's URL convention into the toolkit.

## Logging

None. All three components are pure render functions with no effects, no network,
and no error paths to report — there is nothing to log that the host's own render
tracing would not already show.

## Platform Notes

- **React / Web (TypeScript):**
  `packages/web/packages/ui/src/blocks/doc-breadcrumbs.tsx`, `doc-article.tsx`,
  `doc-metadata.tsx`, `doc-link.tsx`, and the shared types in `doc-types.ts`.
  Exported from `@agentic-toolkit/ui/blocks`.
- **`doc-types.ts` is a `.ts` file**, so the package's `./blocks/*` export wildcard
  (which resolves `.tsx` only) does not reach it. The `./blocks` barrel is its one
  public import path — import the types from there.
- **No `transpilePackages` needed.** A Next consumer resolves the package's
  `development` condition to raw `src/` under `next dev` and `import` to `dist/` in
  a production build; both paths were verified against the cookbook site.
- Tailwind classes in these files are self-registered by the package's
  `src/styles/components.css` (`@source "../blocks/**/*.{ts,tsx}"`), so a consuming
  site needs no extra `@source` entry.
- First consumer: `frontend/src/main/cookbook` — `src/components/content/EntryView.tsx`,
  with its adapters in `src/components/content/HdvLink.tsx` and `src/lib/hdv-meta.tsx`.
- Demo: `ui-showcase` Topic `hierarchical-document-view` (group
  "Assemblies — master / detail"); regenerate `sources.generated.ts` via
  `gen-sources.py` after source changes.
- **Responsive:** the centre column is capped at `max-w-3xl`; verify at 375 / 768 /
  1440 that breadcrumbs wrap rather than overflow and the metadata block stays
  right-aligned.
- **SwiftUI / Compose:** not applicable — web-only shared block.

## Design Decisions

- **Decision**: HDV is a new block family rather than a mode of
  `HierarchicalTopicDetail`. **Rationale**: `TopicDetailItem` is flat, so HTDV
  cannot represent a nested document tree without changing its core type; and the
  two lay out differently (stacked panes vs. one nested column). Forcing them
  together would couple two shapes that change for different reasons
  (`separation-of-concerns`).
- **Decision**: the router is injected as `LinkComponent`, and the current route
  arrives as a plain `activePath` string. **Rationale**: importing `next/link` would
  make the package unusable outside Next and untestable without a router harness.
  Passing `to` rather than `href` makes the adapter an explicit mapping instead of
  an accidental structural match with `<a>` (`explicit-over-implicit`).
- **Decision**: types are re-declared here rather than imported from
  `@agentic-toolkit/model`. **Rationale**: `model` is not in the consuming build's
  package filter, its `NavNode` lacks the fields HDV needs, and it also exports a
  whole alternate site-shell framework — depending on it would re-couple consumers,
  by the back door, to the lineage cookbook deliberately forked away from. Two type
  declarations is the cheaper, more reversible trade
  (`small-reversible-decisions`).
- **Decision**: `DocMetadata` takes rendered `{ label, value }` pairs, not a
  frontmatter object. **Rationale**: which fields exist, how they format, and which
  are links is site vocabulary. Keeping it out means adding a field to a site never
  touches the toolkit (`srp` — the block answers to layout, not to any one site's
  schema).
- **Decision**: the change-history table stays a second `DocArticle` rather than
  becoming a `DataTable`. **Rationale**: it arrives as markdown-rendered HTML inside
  the document; converting it would need a new loader-side GFM-table parser and
  would visibly change the rendered output — a redesign, which this extraction
  explicitly is not (`yagni`).
- **Decision**: `DocBreadcrumbs` takes resolved crumbs instead of a slug.
  **Rationale**: slug→label is a per-site URL convention; deriving it here would
  make the toolkit wrong for the second consumer (`dry` — the convention has one
  home, in the site that owns the URLs).

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | pass | artifact-formatting |
| No raw hex / arbitrary colours / `!important` (flat `--color-*` family tokens) | pass | project-guidelines UI |
| No bespoke re-implementation — the site's copies are deleted in the same change | pass | project-guidelines UI |
| No framework coupling (`next/link` / `next/navigation` never imported) | pass | project-guidelines UI |
| Labelled breadcrumb `nav`; current page is text, not a self-link; real `dl` semantics | pass | accessibility |
| `dangerouslySetInnerHTML` is documented as trusted-input only | reviewed | security |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-29 | Mike Fullerton | Initial recipe. HDV's centre column — `DocBreadcrumbs`, `DocArticle`, `DocMetadata` (plus `DefaultDocLink` and the shared `doc-types`) — extracted verbatim from the cookbook site's reader. |
