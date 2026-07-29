---
id: b7a4e24c-3dfe-4a33-b5bc-88736e520d90
title: Hierarchical Document View
domain: agenticdeveloperhub://recipes/hierarchical-document-view
type: ingredient
version: 1.4.0
status: draft
language: en
created: '2026-07-29'
modified: '2026-07-29'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "HDV — the shared long-form document reader. This version completes it with the frame that places the columns: HierarchicalDocumentView (nav, then the document) wrapping DocPage (the reader's measure, then the rail) — alongside the collapsible tree (DocNavTree, DocNav), the centre column (DocBreadcrumbs, DocArticle, DocMetadata, ViewSourceDisclosure) and the scrollspy table of contents."
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

**The reader lands in stages** — this version completes it:

| Component | Status |
|---|---|
| `DocBreadcrumbs`, `DocArticle`, `DocMetadata` | 1.0.0 |
| `DocTableOfContents` + `useScrollSpy` | 1.1.0 |
| `ViewSourceDisclosure` | 1.2.0 |
| `DocNavTree` / `DocNav` | 1.3.0 |
| `HierarchicalDocumentView` + `DocPage` (the frame) | **this version** |

The governing constraint for the whole extraction is that **it is a move, not a
redesign**: every default here byte-matches what the cookbook site rendered before
it, so a visual delta is a bug rather than a judgement call. Redesign happens later,
on a green base.

There are exactly **two** recorded exceptions, recorded precisely so they are not
drift.

**The chevrons.** Every one is lucide's `ChevronRight` rather than the site's
hand-rolled inline `<svg>` — `ViewSourceDisclosure`'s and the nav section's
collapse control. Same box, same stroke width, same rotation — the glyph itself is
one pixel narrower at `h-3 w-3`. Copying a bespoke icon path into a toolkit that
already depends on lucide would duplicate knowledge lucide owns (`dry`); the pixel
is the price, and it is named here rather than discovered later.

**The content region is a `div`, not a `main`.** The site wrapped the document
region in `<main className="flex-1 min-w-0">` — *inside* the `main` its shared
`AppShell` already renders. Two nested `main` landmarks is invalid HTML, and
extracting the frame forced the choice: rendering a `main` here would bake the bug
into every future consumer. So the frame renders a `div` and the host keeps its one
landmark. Zero visual delta (both are `display: block`), one element name changed,
and one pre-existing a11y defect gone.

The nav column's parity was **measured, not asserted**: the server-rendered aside
was captured from the cookbook's production build before and after the cutover,
across four pages including a fully-expanded 114 KB subtree, and came out at a
constant 1105-byte delta per page — resolving to exactly four intended changes.
The lucide chevron above, a dropped `data-autoscroll` attribute nothing read, and
the `type="button"` and `aria-expanded` the original toggle lacked.

Three seams keep site vocabulary out of the toolkit:

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
- **must-route-through-injected-link**: `DocBreadcrumbs` and `DocNavTree` MUST render every navigational link through `LinkComponent`, passing the destination as `to`, and MUST default to a plain `<a href>` when the host injects none.
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
- **must-collapse-only-the-top-level**: `DocNavTree` MUST render a collapse control for top-level sections only; every directory below that MUST render its children unconditionally.
- **must-open-the-active-section**: `DocNavTree` MUST open, on mount, exactly those sections that contain or are the active page, and leave every other section closed.
- **must-keep-the-readers-collapse-state**: `DocNavTree` MUST NOT re-derive a section's open state when `activePath` changes — once mounted, that state belongs to the reader.
- **must-mark-the-active-page**: `DocNavTree` MUST mark exactly the node whose `href` equals `activePath` with `aria-current="page"`, and MUST move that mark rather than accumulating marks when `activePath` changes.
- **must-list-pages-before-directories**: `DocNavTree` MUST render a node's childless children before its directory children, at every level, whatever order the host passed them in.
- **must-inline-supplied-headings**: `DocNavTree` MUST render a leaf's `headings` beneath its link when the host supplies them, MUST filter none of them, and MUST render no sub-list when it supplies none.
- **must-scroll-when-already-on-the-page**: A heading link MUST scroll smoothly and write the hash without navigating when its own page is the active one, and MUST behave as an ordinary link from anywhere else.
- **must-drop-the-divider-with-the-rows**: `DocNav` MUST render the rule above the tree only when `topLinks` is non-empty.
- **must-control-the-drawer**: `DocNav`'s mobile drawer MUST be controlled by `open`, and MUST call `onClose` from both dismiss targets — the backdrop and the close button — because the control that opens it lives outside HDV.
- **must-share-one-nav**: `DocNav` MUST render the identical nav — the same fixed rows, rule, and tree — in the desktop column and in the drawer.
- **must-place-the-nav-before-the-document**: `HierarchicalDocumentView` MUST render `nav` first and the document region after it, and `DocPage` MUST render the document before the rail.
- **must-slot-columns-unwrapped**: Both frames MUST render a slotted column as a direct child of their flex row, adding no wrapper of their own, so each column's own `sticky` offset resolves against the frame.
- **must-drop-an-omitted-column**: Omitting `nav` or `toc` MUST leave no element behind — a reader with no tree gets no empty column, not a zero-width one.
- **must-cap-the-measure**: `DocPage` MUST cap the document at the reader's measure and MUST allow that column to shrink below its content, so a wide code block cannot push the rail off the page.
- **must-render-no-landmark**: Neither frame MUST render a `main` or any other landmark element. The host's app shell owns its landmarks; HDV owns the columns.
- **must-spread-host-attributes**: All of them MUST spread remaining host attributes (`data-*`, `id`, handlers) onto their root element.

## Appearance

The centre column is a `max-w-3xl` prose measure. Every colour is a flat
`--color-*` token from the shared ADH theme — the same contract
`@adh-shared/adh/styles.css` provides to every site in the family — so HDV inherits
the host's palette without a per-site restyle.

```
 OVERVIEW      │ Home / Principles / Simplicity   ← DocBreadcrumbs      │ ON THIS PAGE
 PROJECTS      │ ─────────────────────────────────                      │
 ───────────   │ # Simplicity                     ← DocArticle          ┃ Simplicity ← marked
 ˅ PRINCIPLES  │ Body prose, headings, code, tables…                    │   In practice
 ┃ Overview    │                   version 1.3.0  ← DocMetadata         │
 │ Testing     │                 modified 2026-07-29                    │  ↑ DocTableOfContents
 │ │ Pyramid   │               references a.com  b.com                  │    (w-56, sticky)
 ˃ APPENDIX    │ ## Change History                ← a SECOND DocArticle │
               │ | Version | Date | … |             (host splits)       │
 ↑ DocNav      │ ─────────────────────────────────                      │
   (w-80, +    │ › View source                    ← ViewSourceDisclosure│
    DocNavTree)│                                                        │
```

- The frame is two nested flex rows and nothing else. The outer one (`HIERARCHICAL_DOCUMENT_VIEW_CLASS`) is `flex flex-1`, its content region (`HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS`) `flex-1 min-w-0`; the inner one (`DOC_PAGE_CLASS`) is `flex`, its document column (`DOC_PAGE_ARTICLE_CLASS`) `flex-1 min-w-0 px-6 py-8 lg:px-10 max-w-3xl`. The `max-w-3xl` is the whole reason the frame is shared: prose set to the full width of a 1440px window is unreadable, and `min-w-0` is what stops a wide table from shoving the rail off the edge.
- Nav column: `aside.hidden.lg:block w-80 shrink-0 border-r
  border-[var(--color-border-subtle)] overflow-y-auto sticky top-14
  h-[calc(100vh-3.5rem)]` — sticky under the family's `3.5rem` header and scrolling
  on its own, so a 466-page tree never pushes the document down. The `nav` inside is
  `flex flex-col gap-6 px-6 py-6 overflow-y-auto h-full`, and the same element is
  rendered into the drawer.
- Fixed rows: `h3.relative font-mono text-xs font-medium uppercase tracking-widest
  text-[var(--color-accent)] transition-colors`, its link hovering to
  `text-[var(--color-accent)]`; the active row carries an absolutely-positioned
  `-left-6 w-0.5 bg-[var(--color-accent)]` bar that sits out in the column's
  padding, clear of the text. Their divider is a lone
  `div.border-t border-[var(--color-border-subtle)]`.
- Section: a `flex items-center gap-1` row of a `p-0.5` chevron button — `h-3 w-3
  shrink-0 transition-transform duration-150` at `strokeWidth={2.5}`, gaining
  `rotate-90` while open — and a label sharing the fixed rows' type exactly. Its
  child list is `flex flex-col border-l border-[var(--color-border)] mt-1`; every
  list below that is the same rule indented past its parent's text, `ml-3.5`, so the
  rails stack one indent apart down the column.
- Entries: a leaf is `relative block py-0.5 text-sm transition-colors`, a mid-tree
  directory `py-1` — one notch more air where the tree branches. Selected is
  `font-semibold text-[var(--color-text-primary)]` plus a `w-px
  bg-[var(--color-accent)]` bar down its own left edge; an ancestor of the active
  page is `font-medium text-[var(--color-text-primary)]`; everything else is
  `text-[var(--color-text-secondary)]` hovering to primary. Links and inlined
  headings share one `padding-inline-start: 0.875rem`, so their text lines up
  whatever depth they sit at.
- Inlined headings: `relative block py-0.5 text-xs text-[var(--color-text-dim)]`
  hovering to secondary — a notch smaller and dimmer than the page links they hang
  under, so an outline never competes with the tree.
- Drawer: `div.fixed.inset-0.z-50.lg:hidden` holding a full-bleed `bg-black/50`
  backdrop button and `aside.fixed.inset-y-0.left-0 w-72
  bg-[var(--color-surface)] shadow-xl overflow-y-auto`, headed by
  `flex items-center justify-between px-6 py-4 border-b
  border-[var(--color-border-subtle)]` with a `font-mono text-sm font-medium` title
  and a lucide `X` at `h-5 w-5`. The panel is `w-72` where the desktop column is
  `w-80` — a drawer leaves the page behind it visible.
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
| `DocNavTree` | section outside the active page | closed; chevron unrotated |
| `DocNavTree` | section containing, or equal to, the active page | open on mount |
| `DocNavTree` | section the reader toggled | stays as they left it across route changes |
| `DocNavTree` | directory at depth ≥ 1 | always expanded; no control rendered |
| `DocNavTree` | node whose `href` is `activePath` | `aria-current="page"`, bold, accent bar |
| `DocNavTree` | node that is an ancestor of the active page | `font-medium`, no bar, no `aria-current` |
| `DocNavTree` | leaf with no `headings` | link only; no sub-list in the DOM |
| `DocNav` | `topLinks` empty or omitted | no fixed rows **and** no divider |
| `DocNav` | `open: false` | the desktop aside only — no drawer, no backdrop |
| `DocNav` | `open: true` | aside + backdrop + drawer, the same nav in both shells |
| `HierarchicalDocumentView` | `nav` omitted | one child, the content region — no empty column |
| `HierarchicalDocumentView` | `nav` given | the column, then the content region, as siblings |
| `DocPage` | `toc` omitted | the document column alone, at full width of the region |
| `DocPage` | `toc` given | the document at its measure, the rail beside it |
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

`HierarchicalDocumentView`, `DocPage`, `DocBreadcrumbs`, `DocArticle`, and
`DocMetadata` are pure and stateless — no internal state, no effects, and therefore
no `"use client"` boundary; they render identically on the server and the client.
The two frames hold no props but their slots and a `className`, which is why they
can sit in a server layout with a client tree passed into them. `DocTableOfContents` is a client
component: it holds the marked id and subscribes an `IntersectionObserver`. It
server-renders its full list with nothing marked, so the outline is in the HTML
before hydration. `ViewSourceDisclosure` is a client component too, but holds only
open/closed state — it server-renders its rule and trigger, collapsed.

`DocNavTree` is a client component holding one boolean per top-level section, and
it server-renders the tree with the active section **already open** — so a reader's
first paint is the correct tree, not a closed one that expands on hydration.
`DocNav` is a client component only because it wraps that tree; it holds no state
of its own, since the drawer's belongs to the host.

## Accessibility

- Each section's collapse control is a real `button` with `type="button"` and
  `aria-expanded`, labelled "Expand <section>" / "Collapse <section>" — the label
  names the section, so a screen-reader user moving through six controls in a row
  can tell them apart. The site's original toggle carried neither `type` nor
  `aria-expanded`; adding both is a deliberate improvement with no visual delta.
- Exactly one node in the tree carries `aria-current="page"`. The accent bar
  beside it is decoration; the attribute is what is announced.
- A directory is a link *and* a parent, so it is announced once — as a link —
  with its children as the list that follows rather than as items nested inside
  it. The tree does not read as doubly nested.
- Inlined headings are ordinary `href="…#id"` anchors, so they work with
  JavaScript off; the click handler only upgrades a same-page jump to a smooth
  scroll, and writes the hash so the position stays linkable.
- The drawer's backdrop is a real `button` carrying the same accessible name as
  the close control, so dismissing is reachable by keyboard instead of being a
  click-only affordance on a `div`. Both share one name deliberately: they do the
  same thing, and two names for one action reads as two actions.
- The drawer is absent from the DOM when closed rather than hidden, so its links
  are never in the tab order behind the page.
- Neither frame renders a landmark. The nav column brings its own `aside` and `nav`, the rail its own `aside`, and the page's single `main` belongs to the host's app shell — so a screen-reader user gets one main region and three named ones, not a nested pair of mains.
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
| T32 | must-collapse-only-the-top-level, must-open-the-active-section | `activePath="/"` | the section's children are absent; its control reads `aria-expanded="false"` and is named "Expand Principles" |
| T33 | must-open-the-active-section | `activePath` = a depth-3 page | that section's pages are present; the sibling section's are not |
| T34 | must-open-the-active-section | `activePath` = the section itself | the section is open |
| T35 | must-collapse-only-the-top-level | click Expand, then Collapse | children appear, then vanish; the chevron carries `rotate-90` only while open |
| T36 | must-keep-the-readers-collapse-state | open a section, then re-render with a DIFFERENT `activePath` | the section is still open |
| T37 | must-collapse-only-the-top-level | a directory at depth 1 | its children render, and there are exactly 2 buttons — one per section, none for the directory |
| T38 | must-mark-the-active-page | `activePath` = a depth-3 leaf | exactly one link carries `aria-current="page"`, and it is that leaf |
| T39 | must-mark-the-active-page | re-render with a new `activePath` | the mark leaves the old page and lands on the new one |
| T40 | must-list-pages-before-directories | a host array with the directory FIRST | the rendered order is page, directory, directory's page |
| T41 | must-route-through-injected-link | a `LinkComponent` marking its output | every link in the tree carries the adapter's marker |
| T42 | must-collapse-only-the-top-level | inspect the two lists | their `className`s equal `DOC_NAV_SECTION_LIST_CLASS` and `DOC_NAV_BRANCH_LIST_CLASS` exactly |
| T43 | must-inline-supplied-headings | a leaf with 2 headings | both render, and the first's `href` is `<leaf>#<id>` |
| T44 | must-inline-supplied-headings | a leaf with none | no sub-list under its link |
| T45 | must-scroll-when-already-on-the-page | click a heading while its page is active | default-prevented, `scrollIntoView({behavior:'smooth'})`, and `replaceState(null,'',<leaf>#<id>)` |
| T46 | must-scroll-when-already-on-the-page | click that heading from another page | NOT default-prevented, and no `replaceState` |
| T47 | must-drop-the-divider-with-the-rows | 2 `topLinks` | the rows render and there is exactly one `nav > div.border-t` |
| T48 | must-drop-the-divider-with-the-rows | `topLinks` omitted | zero `nav > div.border-t` |
| T49 | must-mark-the-active-page | `activePath` equal to a fixed row's `href` | exactly one accent bar, inside that row's `h3` |
| T50 | must-control-the-drawer | `open` omitted | one `aside`, whose `className` equals `DOC_NAV_ASIDE_CLASS`; the `nav`'s equals `DOC_NAV_NAV_CLASS` |
| T51 | must-share-one-nav | `open` | two `aside`s in order [aside, drawer], and two `nav`s |
| T52 | must-control-the-drawer | click each control named "Close navigation" | there are exactly 2, and `onClose` fires twice |
| T53 | must-control-the-drawer | `title="Contents" closeLabel="Dismiss"` | the drawer reads "Contents" and both dismiss targets are named "Dismiss" |
| T54 | must-spread-host-attributes | `className="w-96"` + `data-testid` | the column keeps `sticky`, carries `w-96`, has no `w-80`, and the attribute lands on it |
| T55 | must-place-the-nav-before-the-document | `nav` + children | 2 children: the nav node itself, then a region whose class equals `HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS` and which holds the document |
| T56 | must-slot-columns-unwrapped | `nav` | the nav's `parentElement` is the frame itself, so its `sticky` resolves against the frame |
| T57 | must-drop-an-omitted-column | no `nav` | exactly 1 child, the content region |
| T58 | must-render-no-landmark | `nav` + children | no `main` element and no `main` role anywhere in the output |
| T59 | must-spread-host-attributes | `className="gap-4"` | the frame keeps `flex-1` and gains `gap-4` |
| T60 | must-spread-host-attributes | `id` + `data-*` | both land on the frame |
| T61 | must-place-the-nav-before-the-document, must-cap-the-measure | `toc` + children | 2 children: the measure column holding the document, then the rail node |
| T62 | must-cap-the-measure | — | `DOC_PAGE_ARTICLE_CLASS` contains both `max-w-3xl` and `min-w-0` |
| T63 | must-drop-an-omitted-column | no `toc` | exactly 1 child, the measure column |
| T64 | must-slot-columns-unwrapped | `toc` | the rail's `parentElement` is the row itself |
| T65 | must-spread-host-attributes | `className="items-start"` + `id` | the row keeps `flex`, gains `items-start`, and carries the `id` |
| T66 | must-slot-columns-unwrapped | a `DocPage` inside a `HierarchicalDocumentView` | nav → content region → row → measure → document, with the rail on the row and the nav on the frame — neither frame reaches into the other |

## Edge Cases

- **A tree 466 documents deep in places.** Only the top level latches. Cookbook's
  guidelines section alone holds hundreds of pages at depth ≥ 3; a control at every
  level would turn reaching one into four clicks, and a section the reader had just
  opened would still look empty. They pick a section; everything inside it is then
  visible.
- **A section the reader closed, and then navigated inside.** It stays closed. The
  state is derived once, at mount, and is theirs from then on.
- **A node with children whose `href` is also a real page.** A directory is both:
  its own link, then its contents. Cookbook's `/principles` is a section index page
  *and* a parent.
- **A host that sorted its nodes.** HDV re-sorts anyway — pages before directories,
  at every level — so the tree scans the same way whatever order arrives. A host
  wanting its own order has to ask, and none has (`yagni`).
- **`activePath` with a trailing slash or a query string.** Matching is exact string
  equality against `href`; anything else is simply not the active page. The host
  normalises before passing — cookbook's `usePathname()` already yields the
  canonical path.
- **No `topLinks`.** The rows and their divider both disappear, so a site whose
  whole nav is the tree gets a clean column rather than a rule with nothing above
  it.
- **The drawer's opener lives in the site header.** That is why `open` is
  controlled. An uncontrolled drawer would compile, render, and unit-test green
  while the header's hamburger did nothing — the single most likely way to get this
  component wrong, and not catchable by `DocNav`'s own tests.
- **A leaf whose `headings` name ids that are not on the page.** The click falls
  through to the anchor's default and the browser does nothing. HDV does not own the
  document, so it cannot assert the element is there.
- **The cookbook's ADR outlines.** The site's `decisionHeadings` plumbing was dead
  on arrival: `showHeadings` was passed only from a top-level section to its direct
  leaves, gated on the path `/appendix/decisions` — and a top-level section's path
  is always `/<section>`, so the gate never fired. No built page ever contained an
  outline anchor. The extraction therefore renders what the site rendered (nothing)
  and deletes the dead plumbing; `headings` stays as a capability for the first host
  that actually wants it.
- **A document set with no tree.** Omit `nav` and the frame is a single-column reader; nothing renders an empty 20rem gutter. Same for `toc` — a document with no headings gets the full width, because `DocTableOfContents` already returns nothing and the frame adds no wrapper around it.
- **A host whose app shell already renders `main`.** Every one in this family does, which is why the frame renders a `div`. A host that has *no* landmark wraps HDV in its own `main` — one line, and it owns where the landmark starts, which HDV cannot know.
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
| `HierarchicalDocumentView` | `nav` | none | the nav column, normally a `DocNav`; rendered unwrapped, omit for a single-column reader |
| | `children` | — | the routed document region: one `DocPage` per route |
| `DocPage` | `toc` | none | the right rail, normally a `DocTableOfContents`; rendered unwrapped, omit to give the document the full width |
| | `children` | — | the document: breadcrumbs, article, metadata, source |
| `DocNavTree` | `nodes` | — | top-level sections in display order; each `{ label, href, headings?, children? }` |
| | `activePath` | — | the current route, spelled exactly as it appears in a node's `href` |
| | `LinkComponent` | `DefaultDocLink` | the host's router link, taking `to` |
| `DocNav` | `nodes` / `activePath` / `LinkComponent` | — | passed straight through to `DocNavTree` |
| | `topLinks` | `[]` | fixed `{ label, href }` rows above the tree; empty drops their divider too |
| | `open` | `false` | whether the mobile drawer is showing — controlled, always |
| | `onClose` | none | called from the backdrop and from the close button |
| | `title` | `"Navigation"` | the drawer's heading |
| | `closeLabel` | `"Close navigation"` | accessible name for both dismiss targets |
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
  `doc-nav.tsx`, `hierarchical-document-view.tsx`,
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
- First consumer: `frontend/src/main/cookbook` — `src/components/content/EntryView.tsx`
  and `src/components/layout/LayoutChrome.tsx`, with its adapters in
  `src/components/content/HdvLink.tsx`, `src/lib/hdv-meta.tsx`, `src/lib/hdv-nav.ts`
  (`toHdvNodes()`, narrowing away the four `NavNode` fields the tree never draws —
  on the server, so the narrowed copy is what crosses into the client), and
  `src/components/content/CookbookDocNav.tsx` (the only place calling
  `usePathname()`, wired to the header's existing `sidebarOpen`/`setSidebarOpen`).
  Its own copies (`layout/Breadcrumbs.tsx`, `layout/TableOfContents.tsx`,
  `content/RawMarkdownToggle.tsx`, `layout/Sidebar.tsx`) are deleted as each stage
  lands, so the site never runs two implementations of the same row. The frame
  lands last and leaves both files thin: `LayoutChrome` is the frame plus the
  search dialog, `EntryView` is one `DocPage` of six blocks.
- **The two frames go in different files on purpose.** `HierarchicalDocumentView`
  belongs in the host's *layout* and `DocPage` in its *page*. Put the nav in the
  page and the App Router remounts the tree on every navigation, shutting whatever
  the reader had opened — the one behaviour `DocNavTree` exists to preserve.
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
- **Decision**: only the top level of the tree collapses; every directory below it
  is always expanded. **Rationale**: the site's rules doc demanded "if a section has
  ANY sub-items, it MUST be toggleable. No exceptions" — and the site's code has
  never done that, because `DirLink` renders its children unconditionally. The code
  is right. Cookbook holds 466 documents, most at depth ≥ 3; a latch at every level
  makes reaching a page four clicks and makes a section the reader just opened still
  look empty. The rules doc was corrected to match the code, not the reverse
  (`principle-of-least-astonishment`).
- **Decision**: a section's expanded state is seeded from `activePath` at mount and
  owned by the reader afterwards. **Rationale**: deriving it on every render is the
  obvious implementation and it is wrong — it slams a section shut under a reader
  who opened it to browse while standing on a page elsewhere. Seeding once is the
  only version where the control does what its user just asked it to.
- **Decision**: the tree re-sorts a node's children — pages before directories —
  rather than honouring the host's array order. **Rationale**: this is the site's
  existing behaviour (`NavSection` and `DirLink` each partition their children), and
  it is what makes every level scan the same way. Making it a prop would be surface
  with no caller (`yagni`); if a host ever needs its own order, deleting the
  partition is a smaller change than removing a knob.
- **Decision**: the mobile drawer's `open` is controlled, with no uncontrolled
  fallback. **Rationale**: the button that opens it is in the site header, outside
  HDV's subtree. An uncontrolled drawer would compile, render, and test green while
  the header's hamburger did nothing (`explicit-over-implicit`).
- **Decision**: `onClose`, not `onOpenChange`. **Rationale**: nothing inside
  `DocNav` ever opens the drawer — the opener is the host's. A callback that can
  only ever be called with `false` should not take an argument
  (`explicit-over-implicit`).
- **Decision**: `HdvNavNode` has no `id` and no `trailing` slot, and its `href` is
  required. **Rationale**: all three were in the plan of record. `href` already
  identifies a node uniquely — it is a URL — so an `id` would be a second key to
  keep in step; no host has a badge to hang on a nav row; and every node in a
  document tree is a real page, since a directory is its own index. Admitting a
  destination-less group would put an `href ? link : span` branch at three levels of
  the tree to serve a shape nothing produces. All three are additive later
  (`yagni`).
- **Decision**: there is no `collapsibleDepth` knob. **Rationale**: its only honest
  values are "top level only" — what every host wants — and "all levels", what
  nothing wants per the decision above. If uniform toggling ever becomes right, the
  change is to delete the level switch, not to expose it as configuration.
- **Decision**: the site's `data-autoscroll="true"` attribute on the nav is dropped.
  **Rationale**: nothing in the repo reads it — no CSS rule, no script, no test. It
  was a hook for a scroll-into-view behaviour that was never built
  (`design-for-deletion`).
- **Decision**: cookbook's `decisionHeadings` side-channel is deleted rather than
  ported. **Rationale**: it was dead code, verified against the built HTML — no page
  contained an outline anchor — because `showHeadings` was passed only from a
  top-level section to its direct leaves when that section's path was
  `/appendix/decisions`, and a top-level section's path is always `/<section>`.
  Porting a feature that never rendered would be inventing one. HDV keeps the
  `headings` capability, tested and documented, for the first host that wants it;
  whether cookbook should now turn its ADR outlines **on** is a visible product
  change and the site owner's call, not the extraction's.
- **Decision**: a mid-tree directory renders its link and its child list as two
  SIBLING `<li>`s rather than nesting the list inside the item. **Rationale**: this
  is the site's markup and it is load-bearing — the child list's rule starts at the
  parent's left edge instead of inside its list item, which is what makes the rails
  stack one indent apart down the column. Nesting would shift every rule right by a
  text indent.
- **Decision**: the site's three mutually-recursive nav functions (`NavSection`,
  `DirLink`, `FileLink`) collapse into one recursive component whose rendering is
  chosen by depth and by `children.length`. **Rationale**: the three shared a
  `showHeadings` side-channel and duplicated the pages-before-directories partition
  twice; one component keyed on where a node *sits* has a single copy of each
  (`dry`, `simplicity`).
- **Decision**: `DocBreadcrumbs` takes resolved crumbs instead of a slug.
  **Rationale**: slug→label is a per-site URL convention; deriving it here would
  make the toolkit wrong for the second consumer (`dry` — the convention has one
  home, in the site that owns the URLs).

- **Decision**: the frame is two components — `HierarchicalDocumentView` and
  `DocPage` — rather than one taking three slots. **Rationale**: the three columns
  do not live in one place. The nav persists across navigations and belongs to the
  host's layout; the article and rail are the page. A single component taking all
  three would force the nav into the page, remounting the tree on every route change
  and resetting the reader's expanded sections. The split follows the React boundary
  that already exists (`separation-of-concerns`), and the seam is where the host
  already has one.
- **Decision**: the content region is a `div` and the frames render no landmark.
  **Rationale**: the site nested a second `main` inside its app shell's, which is
  invalid; baking that into the toolkit would spread it to every consumer. Landmarks
  are a whole-page concern the host owns, and HDV cannot know where the page's main
  region begins (`separation-of-concerns`, `principle-of-least-astonishment`).
- **Decision**: the frames take slots and a `className`, and nothing else — no
  `contentClassName`, no `articleClassName`, no configurable gap. **Rationale**: the
  exported class constants are the escape hatch already, and every knob added here is
  a way for a consumer to disagree with the measure that is the block's reason to
  exist (`yagni`, `simplicity`).
- **Decision**: a slotted column is rendered unwrapped. **Rationale**: `DocNav` and
  `DocTableOfContents` are `sticky` with their own `top-14` offsets, which resolve
  against the nearest scrolling ancestor. Any wrapper the frame added — even a bare
  `div` — would silently be that ancestor, and both columns would stop holding
  position with no error to explain it (`explicit-over-implicit`).

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
| One recursive tree component replaces the site's three mutually-recursive functions | pass | project-guidelines UI |
| Nav byte-parity measured against the pre-extraction production build, 4 pages | pass | project-guidelines UI |
| The tree server-renders with the active section already open — no hydration flash | pass | project-guidelines UI |
| `type="button"` + `aria-expanded` + a section-naming label on every collapse control | pass | accessibility |
| Both drawer dismiss targets are real `button`s sharing one accessible name | pass | accessibility |
| Drawer absent from the DOM when closed — its links never sit in the tab order behind the page | pass | accessibility |
| The frames render no landmark; the pre-existing nested `main` is gone, asserted on the real page | pass | accessibility |
| The reader's measure has one home — no page re-derives `max-w-3xl` | pass | project-guidelines UI |
| Slotted columns are unwrapped, so their `sticky` contract survives composition | pass | project-guidelines UI |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.4.0 | 2026-07-29 | Mike Fullerton | Completed the reader with the frame that places its columns: `HierarchicalDocumentView` (the nav, then the document region) wrapping `DocPage` (the `max-w-3xl` measure, then the rail). Two components rather than one, because the nav belongs to the host's persistent layout and the document to its page — one component would remount the tree on every navigation. Both are slot-only and render no landmark, which retires a pre-existing bug: the cookbook site nested a second `main` inside its app shell's. `EntryView` and `LayoutChrome` are now compositions of toolkit blocks with no layout of their own. |
| 1.3.0 | 2026-07-29 | Mike Fullerton | Added the left column: `DocNavTree`, the collapsible multi-depth document tree, and `DocNav`, the sticky desktop aside and controlled mobile drawer that carry it — ported from the cookbook site's `Sidebar`, which is deleted. The site's three mutually-recursive nav functions collapse into one recursive component; its dead `decisionHeadings` side-channel is deleted rather than ported, because it never rendered, and the unread `data-autoscroll` attribute goes with it. Parity was measured, not asserted: a constant 1105-byte delta across four pre/post pages, resolving to the lucide chevron plus the `type="button"` and `aria-expanded` the original toggle lacked. |
| 1.2.0 | 2026-07-29 | Mike Fullerton | Added `ViewSourceDisclosure`, the "View source" row that closes the centre column, ported from the cookbook site's `RawMarkdownToggle`. It deliberately does NOT compose the existing `Disclosure` — see Design Decisions — and gains `aria-expanded`/`aria-controls`, which the original lacked. One recorded visual delta: lucide's chevron replaces the hand-rolled inline SVG. |
| 1.1.0 | 2026-07-29 | Mike Fullerton | Added the right rail: `DocTableOfContents` and `useScrollSpy`, ported from the cookbook site's `TableOfContents`. Its `HIDDEN_HEADINGS` set became the `excludeIds` prop, passed from the host — so the toolkit holds no opinion about which headings are chrome. |
| 1.0.0 | 2026-07-29 | Mike Fullerton | Initial recipe. HDV's centre column — `DocBreadcrumbs`, `DocArticle`, `DocMetadata` (plus `DefaultDocLink` and the shared `doc-types`) — extracted verbatim from the cookbook site's reader. |
