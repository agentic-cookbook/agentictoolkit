---
id: b7a4e24c-3dfe-4a33-b5bc-88736e520d90
title: Hierarchical Document View
domain: agenticdeveloperhub://recipes/hierarchical-document-view
type: ingredient
version: 1.2.0
status: draft
language: en
created: '2026-07-29'
modified: '2026-07-29'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "HDV — the shared long-form document reader. This version covers its centre column (DocBreadcrumbs, DocArticle, DocMetadata), its scrollspy table of contents, and the ViewSourceDisclosure row that closes the column."
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

**The reader lands in stages** — this version closes the centre column:

| Component | Status |
|---|---|
| `DocBreadcrumbs`, `DocArticle`, `DocMetadata` | 1.0.0 |
| `DocTableOfContents` + `useScrollSpy` | 1.1.0 |
| `ViewSourceDisclosure` | **this version** |
| `DocNavTree` / `DocNav` | next |
| `HierarchicalDocumentView` (the shell) | next |

The governing constraint for the whole extraction is that **it is a move, not a
redesign**: every default here byte-matches what the cookbook site rendered before
it, so a visual delta is a bug rather than a judgement call. Redesign happens later,
on a green base.

There is exactly **one** recorded exception, and it is recorded precisely so it is
not drift: `ViewSourceDisclosure`'s chevron is lucide's `ChevronRight` rather than
the site's hand-rolled inline `<svg>`. Same box, same stroke width, same rotation —
the glyph itself is one pixel narrower at `h-3 w-3`. Copying a bespoke icon path
into a toolkit that already depends on lucide would duplicate knowledge lucide owns
(`dry`); the pixel is the price, and it is named here rather than discovered later.

Two seams keep site vocabulary out of the toolkit:

- **Routing.** HDV never imports `next/link` or `next/navigation`. A host injects
  its router as `LinkComponent` (a component taking `to`, not `href`) and tells HDV
  which page is current with a plain `activePath` string. The default is a bare
  `<a href>`, so a non-Next app needs no adapter at all.
- **Vocabulary.** HDV lays a frontmatter block out; it never decides what a
  document's frontmatter *contains*. The host maps its own fields to a list of
  label/value pairs.
- **Chrome.** HDV lists every heading it is given. Which headings are *chrome*
  rather than argument — a change history, a licence footer — is the host's call,
  made by naming ids in `excludeIds`. Omit it and nothing is filtered.

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
- **must-list-every-heading-by-default**: `DocTableOfContents` MUST list every entry of `headings`, in document order, when `excludeIds` is omitted — it MUST hold no opinion of its own about which headings belong.
- **must-omit-excluded-headings**: `DocTableOfContents` MUST omit exactly the headings whose `id` appears in `excludeIds`, from both the rendered list and the set of observed elements.
- **must-hide-empty-outline**: `DocTableOfContents` MUST render nothing when no heading survives filtering.
- **must-indent-by-depth**: `DocTableOfContents` MUST indent a depth-3 heading further than a shallower one, and MUST render the list flat rather than nesting sub-lists.
- **must-mark-the-current-heading**: `DocTableOfContents` MUST mark exactly one heading — the one the reader has most recently reached — and MUST move that marker rather than accumulating marks.
- **must-scroll-not-navigate**: `DocTableOfContents` MUST prevent the anchor's default navigation and scroll to the heading smoothly, leaving the URL unchanged.
- **must-track-by-id-value**: `useScrollSpy` MUST re-subscribe when the ids' VALUES change and MUST NOT re-subscribe when only the array's identity changes, so a caller may derive its ids inline on every render.
- **must-observe-only-existing-elements**: `useScrollSpy` MUST skip ids with no matching element, and MUST disconnect its observer on unmount.
- **must-start-collapsed**: `ViewSourceDisclosure` MUST render no source panel until asked, and MUST omit it from the DOM entirely rather than hiding it, so the document's text is never duplicated for search or assistive tech.
- **must-toggle-both-ways**: `ViewSourceDisclosure` MUST reveal the source on activation and hide it again on the next, and MUST honour `defaultOpen` for the initial state.
- **must-render-source-verbatim**: `ViewSourceDisclosure` MUST render `source` as text, never as markup — a document whose source contains HTML shows that HTML.
- **must-announce-its-state**: `ViewSourceDisclosure`'s trigger MUST carry `aria-expanded` reflecting the current state and `aria-controls` naming the panel it reveals.
- **must-spread-host-attributes**: All of them MUST spread remaining host attributes (`data-*`, `id`, handlers) onto their root element.

## Appearance

The centre column is a `max-w-3xl` prose measure. Every colour is a flat
`--color-*` token from the shared ADH theme — the same contract
`@adh-shared/adh/styles.css` provides to every site in the family — so HDV inherits
the host's palette without a per-site restyle.

```
 Home / Principles / Simplicity          ← DocBreadcrumbs      │ ON THIS PAGE
 ─────────────────────────────────────                         │
 # Simplicity                            ← DocArticle          ┃ Simplicity   ← marked
 Body prose, headings, code, tables…                           │   In practice
                          version 1.2.0  ← DocMetadata         │
                        modified 2026-07-28                    │  ↑ DocTableOfContents
                      references a.com  b.com                  │    (w-56, sticky)
 ## Change History                       ← a SECOND DocArticle │
 | Version | Date | … |                    (host splits)       │
 ─────────────────────────────────────                         │
 › View source                           ← ViewSourceDisclosure│
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
- Table of contents: `aside.hidden.xl:block w-56 shrink-0 sticky top-14
  h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4`; header
  `font-mono text-[10px] font-medium uppercase tracking-widest
  text-[var(--color-text-dim)] mb-3`; list
  `flex flex-col gap-1 border-l border-[var(--color-border-subtle)]` with each
  `li` pulled back `-ml-px` so its own left border sits *on* the rail. Entries are
  `block border-l py-0.5 text-sm transition-colors` + `pl-3` (depth ≤ 2) or `pl-6`
  (depth 3); marked entries add
  `border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium`,
  unmarked ones `border-transparent text-[var(--color-text-dim)]`.
- The rail is desktop-only (`hidden xl:block`): below `xl` there is no room beside
  a `max-w-3xl` measure, and the document's own headings are the outline.
- View source: the row is `mt-8 border-t border-[var(--color-border-subtle)] pt-4`
  — a hairline rule *above* the trigger, separating it from the document rather
  than framing it. The trigger is `flex items-center gap-1.5 font-mono text-xs
  text-[var(--color-text-dim)]` hovering to `text-[var(--color-text-secondary)]`,
  with an `h-3 w-3 transition-transform duration-150` chevron that gains
  `rotate-90` while open. The panel is `mt-3 p-4 rounded-md
  bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)]
  overflow-x-auto font-mono text-xs text-[var(--color-text-secondary)]
  leading-relaxed whitespace-pre-wrap` — it wraps rather than truncating, and
  scrolls only when a single unbreakable token is wider than the column.
- The row is deliberately the quietest thing on the page: dim mono micro-type at
  the very bottom. A reader who wants the markdown will look for it; one who does
  not should never notice it.
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
| `DocTableOfContents` | no heading survives filtering | renders nothing |
| `DocTableOfContents` | before any heading is reached | every entry unmarked |
| `DocTableOfContents` | a heading enters the band | that entry marked, the previous one cleared |
| `DocTableOfContents` | viewport below `xl` | hidden |
| `ViewSourceDisclosure` | collapsed (default) | rule + trigger only; no panel in the DOM |
| `ViewSourceDisclosure` | expanded | chevron rotated 90°, `<pre>` panel below the trigger |
| `ViewSourceDisclosure` | `source: ""` | an empty panel — a document with no body still has a source |

`DocBreadcrumbs`, `DocArticle`, and `DocMetadata` are pure and stateless — no
internal state, no effects, and therefore no `"use client"` boundary; they render
identically on the server and the client. `DocTableOfContents` is a client
component: it holds the marked id and subscribes an `IntersectionObserver`. It
server-renders its full list with nothing marked, so the outline is in the HTML
before hydration. `ViewSourceDisclosure` is a client component too, but holds only
open/closed state — it server-renders its rule and trigger, collapsed.

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
- The table of contents is a real list of real `href="#id"` anchors, so it works
  with JavaScript disabled and is keyboard-navigable by default. The click handler
  only upgrades the jump to a smooth scroll.
- `prose-headings:scroll-mt-20` keeps a scrolled-to heading clear of the sticky
  header, so a keyboard user landing on an anchor sees the heading rather than the
  text beneath it.
- The marked entry is styled, not `aria-current`: the rail reflects scroll
  position, which changes continuously and is not a navigation state a screen
  reader should announce on every pixel.
- The view-source trigger is a real `button` carrying `aria-expanded` and
  `aria-controls`, so assistive tech announces both that it expands something and
  what. The site's original button carried neither — this is a deliberate
  improvement on extraction, with no visual delta.
- Its chevron is `aria-hidden`: the trigger's text already names the action, and
  the rotation is redundant with `aria-expanded`.
- The source panel is removed from the DOM when collapsed rather than hidden with
  CSS, so the document's text is never announced twice or matched twice by
  find-in-page.

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
| T14 | must-list-every-heading-by-default | 3 headings, no `excludeIds` | all 3 listed, including one a host would call chrome |
| T15 | must-omit-excluded-headings | `excludeIds={['change-history']}` | 2 listed, and exactly those 2 elements observed |
| T16 | must-hide-empty-outline | `headings={[]}`; and every id excluded | nothing rendered, both times |
| T17 | must-indent-by-depth | depth 2 and depth 3 | `pl-3` and `pl-6` respectively; `href` is `#<id>` |
| T18 | must-mark-the-current-heading | drive the observer to heading B | B accented and bold; A still `border-transparent` |
| T19 | must-scroll-not-navigate | click an entry | the click is default-prevented and `scrollIntoView({behavior:'smooth'})` is called |
| T20 | must-track-by-id-value | re-render with an equal-valued NEW ids array | one observer total; the marked id survives |
| T21 | must-track-by-id-value | re-render with DIFFERENT ids | the first observer is disconnected and a second observes the new set |
| T22 | must-observe-only-existing-elements | an id with no element; then unmount | only the real element is observed; the observer disconnects |
| T23 | must-start-collapsed | `<ViewSourceDisclosure source={md} />` | no `pre` in the DOM and the source text is not present |
| T24 | must-toggle-both-ways | click, then click again | the panel appears with the source, then is removed |
| T25 | must-toggle-both-ways | `defaultOpen` | the panel is present on first render |
| T26 | must-render-source-verbatim | a source containing `<script>` | the panel's text equals the source; it has zero child ELEMENTS |
| T27 | must-announce-its-state | before and after activation | `aria-expanded` flips `false`→`true`; `aria-controls` equals the panel's non-empty `id` |
| T28 | must-toggle-both-ways | activate | the chevron gains `rotate-90` only while open |
| T29 | must-spread-host-attributes | default, then `label` | the trigger reads "View source", then the host's label |
| T30 | must-spread-host-attributes | `data-testid`, `defaultOpen` | row, trigger, and panel `className`s equal their exported contracts EXACTLY |
| T31 | must-render-source-verbatim | `source=""` with `defaultOpen` | the panel renders and is empty — not absent |

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
- **A document with one heading.** The rail still renders — a one-entry outline is
  the honest answer, and suppressing it would make the layout jump between pages.
- **A heading id with no element.** The spy skips it; the entry still renders and
  its anchor simply does nothing. HDV does not own the document, so it cannot
  assert the element exists.
- **Two headings visible at once.** The last one reported by the observer wins, so
  scrolling down advances the marker and scrolling up walks it back.
- **A host that renders its own headings client-side.** The spy resolves elements
  by id when it subscribes; content appearing later is not observed until the ids
  change.
- **A document whose source contains HTML.** `ViewSourceDisclosure` is the one
  block in the family that does *not* trust its input: the source is a text child
  of a `<pre>`, so markup is shown rather than executed. It is safe to point at
  content `DocArticle` would not be.
- **A very long source.** The panel grows with the document rather than scrolling
  internally — the reader who asked for the source wants all of it, and a nested
  scroll region inside a scrolling page is a trap. Only over-wide lines scroll.
- **An empty source.** The panel still renders. A document with no body still has
  a source, and a toggle that opened onto nothing would read as broken.
- **A host that wants the source open by default.** `defaultOpen` seeds the state;
  the reader owns it from then on. There is deliberately no controlled mode until
  a host needs one (`yagni`).

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
| `DocTableOfContents` | `headings` | — | `{ id, text, depth }[]` in document order, as the host's loader extracted them |
| | `excludeIds` | none | ids to leave out; omit to list everything |
| | `title` | `"On this page"` | the rail's own label |
| `ViewSourceDisclosure` | `source` | — | the raw document text; rendered verbatim, never parsed |
| | `label` | `"View source"` | the trigger's text |
| | `defaultOpen` | `false` | start expanded; uncontrolled from then on |
| `useScrollSpy` | `ids` | — | element ids to watch, in document order |
| | `rootMargin` | `"-80px 0px -60% 0px"` | the band that counts as "here": discounts a sticky header at the top and the lower 60% |
| | `threshold` | `0` | any visible pixel counts |

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

None. The centre-column components are pure render functions. The table of
contents' only effect is an `IntersectionObserver` subscription with no network,
no persistence, and no error path — there is nothing to log that the host's own
render tracing would not already show.

## Platform Notes

- **React / Web (TypeScript):**
  `packages/web/packages/ui/src/blocks/doc-breadcrumbs.tsx`, `doc-article.tsx`,
  `doc-metadata.tsx`, `doc-table-of-contents.tsx`, `view-source-disclosure.tsx`,
  `doc-link.tsx`, and the shared types in `doc-types.ts`. Exported from
  `@agentic-toolkit/ui/blocks`.
- **`useScrollSpy` lives at `src/hooks/useScrollSpy.ts`** and needed its own
  `./hooks/useScrollSpy` key in the package's `exports` map: unlike
  `./components/*` and `./blocks/*`, **`./hooks/*` is not a wildcard**, so a new
  hook is unreachable until its key exists. (`tsup`'s entry list *is* globbed, so
  the dist build needs no edit.)
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
  Its own copies (`layout/Breadcrumbs.tsx`, `layout/TableOfContents.tsx`,
  `content/RawMarkdownToggle.tsx`) are deleted as each stage lands, so the site
  never runs two implementations of the same row.
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
- **Decision**: the table of contents filters by an `excludeIds` prop rather than
  knowing which headings are chrome. **Rationale**: cookbook hides its change
  history because it relocates it below the frontmatter; another host will want it
  listed. Baking one site's convention in would make the block wrong for the second
  consumer, and the default — filter nothing — is the one with no opinion in it
  (`explicit-over-implicit`).
- **Decision**: `useScrollSpy` keys its effect on the ids' joined VALUE, not the
  array's identity. **Rationale**: every real caller derives its ids inline
  (`headings.filter(...)`), producing a fresh array each render; keying on identity
  would tear the observer down and rebuild it on every render, losing the marked
  heading. The site's original component sidestepped this by depending on an
  unfiltered prop, which is a coincidence rather than a contract
  (`principle-of-least-astonishment`).
- **Decision**: the rail's entry classes are composed with a template literal, not
  `cn()`. **Rationale**: `tailwind-merge` cannot reliably tell `border-l` (a width)
  from `border-[var(--color-accent)]` (a colour), and dropping either would cost the
  marker. Nothing merges a host class onto the entries, so `cn()` buys nothing there
  — it is still used on the root, where the host's `className` does merge.
- **Decision**: `ViewSourceDisclosure` does **not** compose the toolkit's existing
  `Disclosure`. **Rationale**: `Disclosure` is a framed card — rounded border,
  raised surface, padded header, `text-sm font-medium` title, a ruled content box —
  and that is exactly what its three consumers (`DeleteEntitySection`, the API
  explorer's three panels, the showcase) want. This row is the opposite: a hairline
  rule *above* a mono micro-label, with an unframed `<pre>` beneath. Reaching it
  through `Disclosure` would mean cancelling every visual decision it makes — card
  chrome, header padding, chevron size and colour, title family/size/weight/colour,
  content frame: nine overrides to keep about twenty lines of open/close state, plus
  a standing coupling that would let a future `Disclosure` restyle silently break
  the document reader. When every visual property must be cancelled, you are paying
  a component's cost and taking none of its value. Two disclosures is not a `dry`
  violation either: `dry` is one representation per piece of *knowledge*, and a
  framed section and an inline text toggle are different knowledge
  (`srp` — `Disclosure` stays answerable to its card consumers alone).
- **Decision**: no `bare` / `contentClassName` escape hatches were added to
  `Disclosure`. **Rationale**: they were the plan of record until the two components
  were compared line by line. Once HDV stopped composing `Disclosure`, they would
  have been props with no caller — speculative surface on a primitive three things
  depend on (`yagni`).
- **Decision**: the chevron is lucide's `ChevronRight`, not the site's inline
  `<svg>`. **Rationale**: the toolkit already depends on lucide and every other
  block draws from it; copying a bespoke path in would fork the icon set. The cost
  is one pixel of glyph width at `h-3 w-3` (lucide's chevron spans 6 units of its
  24-unit box where the site's spanned 7) — the extraction's single recorded visual
  delta, named in the Overview so it reads as a decision rather than as drift.
- **Decision**: `aria-expanded` and `aria-controls` were added, which the site's
  button lacked. **Rationale**: a control that reveals a region must say so; the
  omission was a bug, and fixing it costs nothing visually. "A move, not a
  redesign" constrains the *rendering*, not the semantics.
- **Decision**: the panel is removed from the DOM when collapsed rather than hidden
  with CSS. **Rationale**: the source is the same text as the rendered document.
  Keeping a hidden copy would double every document's text for find-in-page, screen
  readers, and any crawler that ignores `display:none` (`explicit-over-implicit`).
- **Decision**: `ViewSourceDisclosure` owns the `<pre>` rather than taking
  `children`. **Rationale**: the panel's typography *is* part of the reader's
  contract, and every host revealing a document's source wants the same box. A
  `children` slot would push that decision to each site and let them drift
  (`dry`).
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
| Real anchors + list semantics in the outline; works without JS | pass | accessibility |
| Source panel renders as TEXT — the one block that does not trust its input | pass | security |
| `aria-expanded` + `aria-controls` on the view-source trigger; chevron `aria-hidden` | pass | accessibility |
| `dangerouslySetInnerHTML` is documented as trusted-input only | reviewed | security |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.2.0 | 2026-07-29 | Mike Fullerton | Added `ViewSourceDisclosure`, the "View source" row that closes the centre column, ported from the cookbook site's `RawMarkdownToggle`. It deliberately does NOT compose the existing `Disclosure` — see Design Decisions — and gains `aria-expanded`/`aria-controls`, which the original lacked. One recorded visual delta: lucide's chevron replaces the hand-rolled inline SVG. |
| 1.1.0 | 2026-07-29 | Mike Fullerton | Added the right rail: `DocTableOfContents` and `useScrollSpy`, ported from the cookbook site's `TableOfContents`. Its `HIDDEN_HEADINGS` set became the `excludeIds` prop, passed from the host — so the toolkit holds no opinion about which headings are chrome. |
| 1.0.0 | 2026-07-29 | Mike Fullerton | Initial recipe. HDV's centre column — `DocBreadcrumbs`, `DocArticle`, `DocMetadata` (plus `DefaultDocLink` and the shared `doc-types`) — extracted verbatim from the cookbook site's reader. |
