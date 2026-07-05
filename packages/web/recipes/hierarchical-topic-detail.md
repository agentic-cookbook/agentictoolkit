---
id: 0bba1f5b-bc8d-4f76-b1c9-329b627f7ee8
title: Hierarchical Topic / Detail View
domain: agenticdeveloperhub://recipes/hierarchical-topic-detail
type: recipe
version: 1.4.2
status: draft
language: en
created: '2026-06-30'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: Deep-linkable stack of collapsible/coverable topic lists under one breadcrumb — covered parents peek with a hover reveal, dash/connector selection markers, min-width detail.
platforms:
- typescript
- web
tags:
- hierarchical
- topic-detail
- master-detail
- view
- navigation
- breadcrumb
- deep-linking
- layout
ingredients:
- agenticdeveloperhub://recipes/topic-detail
- agenticdeveloperhub://recipes/resizable-split
- agenticdeveloperhub://recipes/disclosure
- agenticdeveloperhub://recipes/alert-and-dialog
depends-on: []
related:
- agenticdeveloperhub://recipes/focused-topic-detail
- agenticdeveloperhub://recipes/topic-detail
references: []
---

# Hierarchical Topic / Detail View

## Overview

The **Hierarchical Topic / Detail View** is the general contract for a *stack* of
nested topic/detail rails — the generalisation of the adh.com `/home` nesting
(`[workspaces] | [features] | [entities] | [topics] | [detail]`). Each topic list's
selection scopes the next, so a route reads as a hierarchy: **workspace ▸ feature ▸
entity ▸ topic ▸ leaf**. It supersedes the popup-driven [[focused-topic-detail]]
for workspace routes: the entity selector is a first-class *topic list* rail, not a
dropdown.

A **single full-width chrome** spans every rail across the top — one breadcrumb of
the complete selection trail (with a right-justified help button) — and the whole
hierarchy is **deep-linkable**: every level maps to a URL path segment, so the exact
selection is shareable and restorable (back/forward navigates the hierarchy).

The view composes the shared [[topic-detail]] primitive (one per level) inside an
enclosing frame (`HierarchicalTopicDetail`) that renders the topic lists **and** the
detail pane as **flat sibling columns** in one CSS grid (not nested) — so ONE
ResizeObserver / ONE disclosure controller spans the whole row, and the detail leaf
keeps a stable slot (no remount as the list count changes). The frame owns the
breadcrumb, selection/unselection, disclosure, and drill-down; the workspace shell
makes the outermost lists (workspaces, features) **persistent** around every feature
route so the switcher never disappears.

### One stack, no sublists

There is a **single** hierarchical topic/detail stack. **Every list anywhere is a
level of it**, and the deepest pane is only ever a **detail** (a form/content),
**never a list**. The in-pane "master/detail" pattern (a list + editor inside one
pane) is **dismantled**: each such list (Applications, Buckets, Access, Users, Team
Members, Personas, Persona Services) is a **stack level**, and its editor is the
**leaf detail**. The deep-link selection (e.g. `…/applications/<appId>`) is just that
level's `selectedId`. App code only **declares** the stack (the `levels` data) — it
never nests views or writes selection logic. Terminology: **stack / topic list (a
level) / detail (the leaf)** — not "rail" / "sublist".

### onSelect / onClear — pure-intent selection

A level's selection is two pure-navigation callbacks:

```ts
interface TopicLevel {
  id: string
  title?: string                   // left-aligned list title (divider under it); reveals when covered
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void   // select THIS level (clears descendants). Pure nav: push(`…/<id>`)
  onClear: () => void              // clear THIS level + everything below. Pure nav: push(parentUrl)
  emptyLabel?: string
  railSlot?: RailSlot              // "New…" affordance (→ "+" when collapsed/narrow)
  railSlotActive?: boolean
}
```

The **package** decides which fires — a click on the already-selected row calls
`onClear()`, a click on any other row calls `onSelect(id)`. **Unselection is uniform
and package-owned**: consumers write no `prev === id ? null : id` toggle. The package
**never auto-selects** — landing on a level with no selection shows the list with
nothing focused (no resume, no coerced first item). Breadcrumb up-navigation and the
drill-down **Back** also clear via `onClear`, so all three deselect paths are one code
path.

### Small-window drill-down (the refined spec)

> **Small-window drill-down.** If the window is not wide enough to fit the Details pane
> at min size plus all the parent Topic Lists undisclosed, then as the window shrinks
> move the **leftmost** Topic Lists **off the left edge of the screen** (hiding them),
> general→specific. When a topic is chosen and a details page is shown, its topic list
> is moved off-screen.
> - When that happens, put a **Back** button in the top button bar (first item,
>   left-justified) of the Details view. Pressing it **deselects that detail in its
>   parent's topic list** (hiding the detail) and **fully discloses the parent topic
>   list**. If there is unsaved work in the detail, prompt the user to Save / Discard /
>   Cancel first.
> - If a disclosed topic list has a parent topic list that is hidden/off-screen, that
>   topic list shows its own **Back** button (top-left) that deselects it in its parent,
>   exactly like the detail's Back.
> - **This is how the feature works from the first showing on small screens (phones).**

> **Implementation status (2026-06-30).** Fully implemented. Built: the **flat**
> `HierarchicalTopicDetail` frame (sibling-column `levels[]`, one ResizeObserver, stable
> leaf slot), the persistent `WorkspaceShell` rendering **one merged stack** over
> `[workspace, feature, …feature-published levels]` (features publish their levels up
> through the `WorkspaceChrome` context — `useWorkspaceLevels` / `useWorkspaceListLevel`
> — instead of nesting their own frame), `ResourceTab` + the dismantled master/detail
> panes on top of it, first-item alignment, and `New …` in the list `railSlot`. Also
> built: **package-owned unselection** (re-click `onClear`), **no auto-select**,
> **off-screen drill-down** (leftmost lists slide off, general→specific, computed
> pre-paint so phones start drilled-down) with a **top-left Back** button and a **3-action
> Save / Discard / Cancel** unsaved-work guard (`exitGuard`), the **manual disclosure
> toggle** (coexists with drill-down), **drag-resize with snap**, **detail-pane min-width +
> horizontal scroll**, the **breadcrumb help button** (right-justified), the **unified
> `site-config` help store**, and **per-segment deep linking of the whole hierarchy**
> including the dismantled list levels. See **Platform Notes**.

### Disclosure styles — minimized vs covered

The frame supports two `disclosureStyle`s for how parent lists yield room to their children:

- **`minimized`** (the original): the lists are flat grid **columns**; as the window narrows the
  leftmost lists shrink to icon strips, then slide **off the left edge** (the two-phase drill-down
  above). Parents disappear entirely as you drill in.
- **`covered`** (the **default**): the lists are absolute-positioned and **overlap** like a stack of
  cards — each child list partially **covers** its parent, and the covered parent keeps a fixed
  **40 px peek** (a left-aligned icon strip) at its left edge, so the whole ancestry stays glanceable
  while the child + detail take the room. A list is covered automatically when there isn't room to show
  it in full, and the user can **manually** cover/uncover a list with its `«`/`»` toggle (user intent
  persists across resizes; the auto layer never uncovers a list the user covered). The **frontier** list
  (the one being chosen from, with no selection yet) is never covered. When even the peeks + the child +
  the detail minimum don't fit, covered lists drill off-screen exactly as in `minimized`.

### Reveal popover for covered rows

Because a covered list shows only icons, the frame makes each covered row **reachable without uncovering
the whole list**: hovering (or keyboard-focusing) a covered icon **instantly reveals a full, uncovered
copy of that row** — the same `[icon] [name]` as the undisclosed list, floated over the row's **exact
spot**. A covered list's **title `«`** reveals the same way. The reveal is **interactive**: clicking it
is a **pure select** of that item — it only *changes* the selection (it never unselects, and does nothing
if the row is already selected), removing the deeper lists and showing the chosen item's detail. The
popover closes when the pointer leaves its box, on blur (for a focus reveal), on scroll, or on Escape —
and can't get stuck if the pointer left before it mounted.

### Per-list titles

Each level MAY carry a `title`, rendered **left-aligned** (aligned with the row text, not the toggle) with
a **divider** beneath it; the disclosure toggle sits in a fixed leading control slot so the title and the
first row share the same left edge.

### Selection markers — dash + connectors (no bar in the stack)

In the stack, selection is shown **without** the topic-detail gold left-bar (`selectionStyle="marker"`):

- the **root** list's selected row carries a leading **gold dash** in front of `[icon] [name]` (with extra
  leading padding), and
- each **child** list's selected row is joined to its selected **parent** row by a gold **elbow connector**
  — a line from the end of the parent row (its label end, or its icon's right edge when the parent is
  covered) to just before the child row's icon. The connectors are measured entirely from the DOM and
  re-tracked across the cover/uncover slide, so they stay attached for covered/peeking lists too.

Standalone `TopicDetail` (the single two-pane primitive, used by [[focused-topic-detail]] and the showcase)
keeps the classic **`selectionStyle="bar"`** gold left-border — the dash/connector markers are a property of
the hierarchical stack, not the primitive.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| Topic Detail | agenticdeveloperhub://recipes/topic-detail | One rail per hierarchy level (icon+name rows, optional left-aligned `title`, controllable collapse/cover, leading rail slot, `selectionStyle` bar/marker, covered-row hover/focus reveal). | yes | `title`, `items`, `selectedId`, `onSelect`, `railSlot` (render-prop), `collapsed`/`onCollapsedChange`, `covered`, `isRoot`, `selectionStyle`, `panePadding={false}`. |
| Resizable Split | agenticdeveloperhub://recipes/resizable-split | Drag-to-resize the boundary between a topic list and the rest, with snap-to-undisclose / snap-to-full. | yes | Per-rail draggable divider; min/max + snap thresholds. |
| Disclosure | agenticdeveloperhub://recipes/disclosure | The animated disclosure (collapse/expand) of a topic list to/from its icon strip. | yes | Upper-right toggle; animated unless reduced-motion. |
| Alert & Dialog | agenticdeveloperhub://recipes/alert-and-dialog | The modal opened by a list's "new topic" button to create an item, AND the 3-action Save/Discard/Cancel unsaved-work prompt the package raises before a drill-down Back / breadcrumb-up discards a dirty leaf. | yes | New-item modal (returns the created id); the package's `UnsavedChangesModal` (driven by `exitGuard`). |

## Integration Requirements

### Hierarchy & deep linking

- **must-nest-topic-lists**: The view MUST render an ordered stack of topic lists where each list's selection scopes the next; the deepest open level's pane renders the leaf detail.
- **must-deep-link-every-level**: Every level of the hierarchy MUST be addressable by a URL path segment, so the full selection is shareable and restorable — e.g. `https://adh.com/mikefullerton/ecosystems/temporal/applications/notes`.
- **must-restore-from-url**: On load (and on browser back/forward), the view MUST restore each topic list's selection and the open leaf from the URL path.
- **must-update-url-on-select**: Selecting an item in any topic list MUST update the URL to that level's path (and reset the deeper segments to that item's default).

### Top chrome — breadcrumb + help

- **must-render-one-breadcrumb-bar**: The view MUST render exactly ONE breadcrumb bar across the full width of the top, spanning all topic lists and the detail pane (not one per rail).
- **must-show-full-trail**: The breadcrumb MUST show the selected item of every topic list in order (workspace ▸ feature ▸ entity ▸ topic ▸ …); the last crumb is the current location (`aria-current`).
- **must-navigate-from-crumb**: Clicking an ancestor crumb MUST navigate to that level, deselecting everything deeper (via that level's `onClear`, gated by the unsaved-work guard).
- **must-render-breadcrumb-help**: The breadcrumb bar MUST carry a right-justified help button that pops up a description of the current view (sourced from the help config).

### Alignment

- **must-align-list-and-pane-top-edges**: The top edges of every topic list and the detail pane MUST be vertically aligned on one row (directly under the breadcrumb).
- **must-align-list-and-pane-bottom-edges**: Every topic list and the detail pane MUST fill to the same height, so their bottom edges are vertically aligned.
- **must-align-first-row**: The first item of every topic list MUST sit at the same vertical position whether or not the list has a "new topic" button — the leading slot is always reserved at a fixed height (empty when there is no button).

### Per-view layout — detail panes

- **must-left-justify-content**: Content in topic lists and detail panes MUST be left-justified. Centered content is a special-case exception (e.g. an empty-state prompt), not the default.
- **must-expand-detail-horizontally**: A detail pane MUST expand to fill the available horizontal space, honouring a minimum width.
- **must-scroll-horizontally-below-min**: When the available space is narrower than the detail pane's minimum width, the pane MUST scroll horizontally rather than crush its content.
- **must-fill-detail-vertically**: A detail pane MUST fill the available vertical space of its container.
- **must-avoid-fixed-vertical-scroll**: A detail pane MUST NOT contain fixed-size content that forces a vertical scrollbar where the content could instead grow to fit; vertical scrolling is a last resort.
- **must-render-detail-action-bar**: A leaf editor detail MUST render its action bar (Save / Cancel / Delete, and the package-injected Back when drilled) as the top of the leaf pane (not hoisted to the top chrome). The full-width breadcrumb names the pane, so a separate centered title is redundant.
- **must-render-detail-help-icon**: Help for the current view is the right-justified icon on the breadcrumb bar (sourced from the help config); a leaf editor MAY additionally carry a topic-specific help icon on its action bar.

### Per-view layout — topic lists

- **must-render-icon-name-rows**: Each topic row MUST render as `[icon] [name]`.
- **must-fix-list-width**: A topic list MUST be a fixed width — slightly wider than its widest topic — with consistent leading and trailing padding.
- **may-offer-new-topic-button**: A topic list MAY render a "new topic" button at its top; activating it MUST open a modal dialog to create a new item.
- **must-offer-disclosure-toggle**: A topic list MUST offer a disclosure toggle at its upper right; disclosing/undisclosing MUST be animated (subject to **must-respect-reduced-motion**).
- **must-render-undisclosed-icon-strip**: An undisclosed topic list MUST render as a vertical list of the topics' icons; if the list has a "new topic" button, that row MUST collapse to a `+`.
- **must-fill-list-vertically**: A topic list MUST fill the available vertical space (pinned to its container's height) and MUST scroll only when its items overflow.
- **must-resize-by-drag**: A topic list MUST be horizontally resizable by dragging its trailing border.
- **must-snap-undisclosed-when-narrow**: If dragged narrower than 1/3 of its full width, a topic list MUST animate to undisclosed.
- **must-snap-full-when-wide**: If dragged wider than its content plus the default padding, a topic list MUST animate (back) to its full content width.

### Selection — pure intent, package-owned

- **must-split-select-clear**: A level MUST expose `onSelect(id)` (select this level, clear descendants) and `onClear()` (clear this level + everything below) as PURE navigation; the package decides WHEN each fires.
- **must-own-unselection**: A click on the already-selected row MUST clear that level (`onClear`); a click on any other row MUST select it (`onSelect`). Consumers MUST NOT write toggle logic.
- **must-not-auto-select**: The view MUST NOT auto-select anything — landing on a level with no selection shows the list with nothing focused (no resume of a last id, no coerced first item); only the deepest pane that IS selected renders a detail.
- **must-be-one-stack**: Every list anywhere MUST be a level of the single stack; the deepest pane MUST be a detail (form/content), never a list. An in-pane master/detail MUST be dismantled into a published list level + a leaf editor.

### Whole hierarchy — disclosure + off-screen drill-down

- **must-single-disclosure-controller**: ONE ResizeObserver over the whole row MUST drive disclosure/drill-down for every list (not one observer per list).
- **must-keep-manual-toggle**: Each list MUST keep its manual disclosure toggle (the `«` that shrinks it to a vertical icon strip); a manually-collapsed list counts as its icon width in the fit math, then slides off-screen if there is still no room.
- **must-undisclose-before-off-screen**: Shrinking the window is a TWO-PHASE response. Phase 1 — as the window shrinks, the **leftmost** still-full lists MUST first **undisclose** to their icon strips (general → specific) until everything fits or every list is an icon strip. Phase 2 — ONLY once every list is already an icon strip AND those icon strips plus the detail's minimum STILL don't fit may lists begin to slide off-screen. A list MUST NOT slide off-screen while it (or a list to its right) could still be undisclosed instead.
- **must-drill-off-screen-when-cramped**: In phase 2, the **leftmost** icon-strip lists MUST slide **off the left edge** (hidden: `0`-width column + `inert` + `aria-hidden`), general → specific, until the detail fits at its minimum. On a phone width every list slides off (detail full-width), computed before paint so the first frame is already drilled-down.
- **must-not-hide-frontier-choosing-list**: The view MUST NOT hide the frontier list while it has no selection (its "detail" is only a landing) — only once that level is selected (the detail is real content) may the frontier list also slide off.
- **must-disclose-when-room**: When the window widens, hidden lists MUST slide back on (specific → general) as space allows.
- **must-show-back-when-drilled**: When at least one list is hidden AND something is selected, a **Back** button MUST appear top-left of the leftmost-visible pane (the detail's button bar if the detail is leftmost-visible, else the top-left of the leftmost-visible list).
- **must-back-clears-one-level**: Back MUST clear exactly the deepest selected level (`onClear`), re-disclosing one parent; repeated Back walks up to root.
- **must-guard-unsaved-on-exit**: If the leaf editor is dirty (`exitGuard.isDirty()`), any action that would clear OR replace the open detail — Back, re-click-deselect, breadcrumb up-nav, selecting a shallower row, and selecting a **different row in the deepest selected level itself** (a sibling swap that unmounts the open leaf) — MUST first open a **3-action Save / Discard / Cancel** modal — Save → `await save()` then proceed; Discard → proceed; Cancel → keep editing. Only a forward drill-down into a not-yet-selected level (no open detail to lose) is unguarded; equivalently, `railOnSelect` guards whenever the target level already has a selection (`level.selectedId != null`).
- **must-not-redisclose-user-collapsed**: Automatic disclosure MUST NOT re-disclose a list that the user explicitly undisclosed (user intent wins over the layout heuristic).

### Covered disclosure — peek, reveal, titles, selection markers

- **must-default-to-covered**: The hierarchical frame MUST default to the `covered` disclosure style; `minimized` is opt-in via `disclosureStyle="minimized"`.
- **must-peek-covered-parent**: In the `covered` style, a covered parent list MUST stay partially visible as a fixed ~40 px icon-strip peek at its left edge (a stacked-card overlap), not disappear entirely; child lists overlap their parents with increasing z-index and the detail is topmost.
- **must-cover-automatically**: A list MUST be covered automatically when there is not room to show it in full alongside the child lists and the detail at its minimum; the **frontier** choosing list (nothing selected yet) MUST NOT be covered, and MUST NOT be slid off-screen by the detail's minimum-width shift — an unselected frontier's detail is a landing placeholder that enforces NO minimum, so the choosing list always keeps its place.
- **must-allow-manual-cover**: The user MUST be able to manually cover/uncover a list via its `«`/`»` toggle; a manually-covered list MUST stay covered across resizes (user intent wins), and the auto layer MUST NOT uncover a list the user covered.
- **must-reveal-covered-row-on-hover**: Hovering a covered (peeking) row's icon MUST instantly show a full, uncovered copy of that row (its `[icon] [name]`) floated over the row's exact on-screen position.
- **must-reveal-covered-row-on-focus**: Keyboard-focusing a covered row MUST show the same reveal popover (so covered rows are reachable without a pointer); blurring it MUST close that focus reveal.
- **must-reveal-covered-title**: Hovering the `«` of a covered list's title MUST show the same reveal popover as a covered row.
- **must-pure-select-from-reveal**: Clicking the reveal popover MUST be a PURE select of that item — it changes the selection only (it MUST NOT unselect, and MUST do nothing if the row is already selected), removing the deeper lists and showing the chosen item's detail.
- **must-close-reveal-robustly**: The reveal popover MUST close when the pointer leaves its box, on blur (focus reveal), on scroll, or on Escape — and MUST NOT get stuck open if the pointer left before it mounted.
- **may-title-each-list**: A level MAY carry a `title`; when present it MUST render left-aligned (aligned with the row text) with a divider beneath it, the disclosure toggle in a fixed leading control slot.
- **must-mark-selection-without-bar**: In the stack (`selectionStyle="marker"`) the selected row MUST NOT use the topic-detail gold left-bar; the root's selected row MUST show a leading gold dash, and each child's selected row MUST be joined to its selected parent row by a gold elbow connector.
- **must-keep-connectors-attached-when-covered**: The selection connectors MUST stay attached to the correct rows when lists are covered/peeking and across the cover/uncover slide (measured from the DOM, re-tracked through the transition).
- **must-keep-bar-for-standalone**: The standalone `TopicDetail` primitive MUST keep `selectionStyle="bar"` (the gold left-border); the dash/connector markers are a property of the hierarchical stack only.

### General

- **must-respect-reduced-motion**: All animations (disclosure, resize snap, auto-disclosure) MUST be disabled when the user's "reduce animation" preference is set.
- **must-source-help-from-config**: All help content (the breadcrumb help button and every detail-pane help icon) MUST come from a single unified help config in `websites/site-config`, keyed by the route to the detail page + the ui element.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ workspace ▸ feature ▸ entity ▸ topic ▸ leaf            [?] help (right)    │  ← one full-width breadcrumb
├─────────┬──────────┬──────────┬──────────┬────────────────────────────────┤
│ + New   │          │ + New    │          │ ‹ Back  Delete │ Cancel Save [?]│  ← leaf editor action bar (Back when drilled)
│ ◻ Wksp  │ ◻ Feat 1 │ ◻ Ent A  │ ◻ Topic1 │ ┌────────────────────────────┐ │
│ ◻ Wksp2 │ ◻ Feat 2 │ ◻ Ent B  │ ◻ Topic2 │ │  left-justified content     │ │
│         │ ◻ …      │          │ ◻ …      │ │  fills vertically; min-width│ │
│  «      │  «       │  «       │  «       │ │  horizontal scroll if tiny  │ │
└─────────┴──────────┴──────────┴──────────┴─┴────────────────────────────┴─┘
  fixed-width, resizable, disclosable topic lists   flexible, min-width detail
  (narrow → leftmost lists slide OFF-SCREEN, general→specific; Back walks up)
```

- **Top edges** of every rail + the detail pane align on one row under the breadcrumb;
  **bottom edges** align (all fill to the container height). The first item of each
  rail aligns (the leading `New …`/`+` slot is always reserved).
- **Rails**: `bg-apt-nav`, fixed width ≈ widest topic + padding, right divider, a
  disclosure/cover `«`/`»` toggle, an optional leading `New …` slot (→ `+` when collapsed) and an
  optional left-aligned `title` + divider above the first row. Undisclosed/covered = a `~2.25rem` /
  40px icon strip; in the stack selection is the **marker** (root dash + parent→child connectors), not a
  per-rail bar. A covered icon (or the covered title's `«`) reveals a full row copy on hover/focus.
- **Detail pane**: `bg-apt-surface`, flexible width with a minimum (horizontal scroll
  below it), fills height; a centered-title button bar on top with a right-justified
  help icon. Colour only via `apt-*` tokens; no raw hex; no `!important`.
- **Breadcrumb**: `bg-apt-nav`, mono `text-xs`, `›` separators, ancestor crumbs are
  buttons, current crumb `aria-current` in `apt-gold`; help button right-justified.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| Per-level selection | URL path segments (or internal state) | every topic list + the detail pane | URL → view | `selectedId`; `onSelect`/`onClear` write the URL/state |
| Published feature levels | the active feature | the shell's one merged frame | child → shell | `WorkspaceChrome` context (`useWorkspaceLevels` + `useWorkspaceListLevel`) |
| Unsaved-work guard | the leaf editor (`useMasterDetailForm.guard`) | the package's `attemptExit` | child → shell → package | `useWorkspaceExitGuard` → `exitGuard` prop (stable ref-backed proxy) |
| Hidden (off-screen) count | window size (ONE ResizeObserver) | the drill-down + Back | layout → frame | summed list widths vs the detail min; capped at the frontier |
| Disclosure (collapsed?) per list | user toggle | each `TopicRail` | frame ↔ rail | manual `«` toggle (`override`); counts as icon width, then hides |
| New-item result | the new-topic modal | the owning topic list | modal → list | dialog returns the created id; the list selects it |
| Help text | `websites/site-config` help store | breadcrumb help icon | config → view | keyed by route + ui element |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-nest-topic-lists, must-align-first-row | render 4 levels, deepest selected | 4 rails + a detail pane; first rows aligned; deepest pane renders the leaf |
| T2 | must-deep-link-every-level, must-restore-from-url | load `/mike/ecosystems/temporal/applications/notes` | each rail selects its segment; the `notes` leaf opens |
| T3 | must-update-url-on-select | click entity "temporal" | URL becomes `/…/ecosystems/temporal/<defaultTopic>` |
| T4 | must-render-one-breadcrumb-bar, must-show-full-trail | entity+topic selected | one breadcrumb `Acme › Ecosystems › Temporal › Applications`; last is `aria-current` |
| T5 | must-navigate-from-crumb | click the "Ecosystems" crumb | navigates to the feature, deeper selection cleared |
| T6 | must-render-breadcrumb-help, must-source-help-from-config | click the breadcrumb help button | popover shows the config text for this route |
| T7 | must-align-list-and-pane-top-edges, must-align-list-and-pane-bottom-edges | viewport 1440 | all rail + pane top edges share a row; all bottom edges share a row |
| T8 | must-render-detail-action-bar, must-render-detail-help-icon | open a leaf editor | the action bar (Save/Cancel/Delete) is the top of the leaf; the breadcrumb help icon opens the view's description |
| T9 | must-expand-detail-horizontally, must-scroll-horizontally-below-min | shrink viewport below detail min-width | detail keeps min-width and scrolls horizontally (content not crushed) |
| T10 | must-render-icon-name-rows, must-fix-list-width | render a rail | rows are `[icon] [name]`; fixed width ≈ widest topic + padding |
| T11 | may-offer-new-topic-button | click a rail's "New …" | a creation modal opens; on save the new item is selected |
| T12 | must-offer-disclosure-toggle, must-render-undisclosed-icon-strip | click a rail's `«` | rail animates to an icon strip; `New …` becomes `+`; active icon keeps the bar |
| T13 | must-resize-by-drag, must-snap-undisclosed-when-narrow | drag a rail below 1/3 width | rail animates to undisclosed |
| T14 | must-snap-full-when-wide | drag a rail wider than content+padding | rail animates back to full content width |
| T15 | must-drill-off-screen-when-cramped, must-single-disclosure-controller | narrow the window past the detail min-width with a leaf selected | leftmost lists slide off-screen (general→specific) until the detail fits at min |
| T16 | must-disclose-when-room | widen the window | hidden lists slide back on (specific→general) as space allows |
| T17 | must-not-redisclose-user-collapsed | user collapses list 2, then widen window | list 2 stays icon-collapsed; others may re-disclose |
| T18 | must-respect-reduced-motion | `prefers-reduced-motion: reduce` | disclosure / resize / drill-down apply with no animation |
| T19 | must-own-unselection | click the already-selected entity/topic/list row | that level clears + every deeper pane hides (no consumer toggle logic) |
| T20 | must-not-auto-select | land on `/<slug>/ecosystems` | the entity list shows nothing selected; selecting one shows the topics list with nothing selected (no resume, no first-topic) |
| T21 | must-show-back-when-drilled, must-back-clears-one-level | drill in at phone width, press Back | Back appears top-left of the leftmost-visible pane; pressing it clears the deepest selected level + re-discloses one parent |
| T22 | must-guard-unsaved-on-exit | edit the leaf editor (dirty), then press Back | a Save / Discard / Cancel modal opens; Discard proceeds, Cancel keeps editing, Save persists then proceeds |
| T23 | must-not-hide-frontier-choosing-list | narrow `/<slug>/home` (workspace selected, no feature) | the features list (the frontier) stays visible; only the workspaces list may slide off |
| T24 | must-be-one-stack | open a dismantled topic (Applications) | the apps are a published list level (not an in-pane sublist); the editor is the leaf detail |
| T25 | must-default-to-covered, must-peek-covered-parent | render ≥3 covered levels, deepest selected | parents peek as ~40px icon strips under the child; child + detail take the room |
| T26 | must-reveal-covered-row-on-hover | hover a covered list's icon | a full `[icon] [name]` copy of that row appears over its exact spot |
| T27 | must-pure-select-from-reveal | click the reveal of an unselected row | that row becomes selected, deeper lists clear, its detail shows; clicking the reveal of the already-selected row does nothing |
| T28 | must-reveal-covered-row-on-focus | Tab to a covered row | the reveal popover appears; blurring closes it |
| T29 | may-title-each-list | render levels with `title` | each list shows its left-aligned title + a divider above the first row |
| T30 | must-mark-selection-without-bar, must-keep-connectors-attached-when-covered | select root + child in the covered stack | no gold bar; the root selected row has a leading dash; a gold elbow connects the selected parent row to the selected child row, staying attached when the parent is covered |
| T31 | must-keep-bar-for-standalone | render a standalone `TopicDetail` with a selection | the selected row shows the classic gold left-bar (no dash/connector) |
| T32 | must-allow-manual-cover | click a list's `»` cover toggle, then resize | the list stays covered (icon-strip peek) across the resize |

## Edge Cases

- **No selection (the "All" frontier):** when a level has no selection, its pane shows
  that level's landing (e.g. the cards index) and the deeper rails are not rendered;
  the breadcrumb ends at the last selected crumb.
- **Stale/deleted segment in the URL:** an unknown id falls back to that level's landing
  rather than a phantom-scoped pane (mirrors the FTD `knownId` rule).
- **Heterogeneous leaves:** a leaf may itself be a master/detail (e.g. Applications =
  list + editor); the leaf's own action bar renders **in its leaf-most details panel**,
  not in the top chrome.
- **Persistent outer rails:** on workspace routes the workspaces + features rails are
  rendered by the shell layout (persist across feature navigation); a feature view must
  not re-render them.
- **Window too small for any rail:** all rails auto-undisclose to icon strips before the
  detail pane drops below its min width; below that the detail scrolls horizontally.
- **Single level:** with one topic list the view is just `[rail] | [detail]` — still a
  valid (degenerate) hierarchy with the same chrome.

## Platform Notes

- **React / Web (TypeScript).** Enclosing frame:
  `websites/shared/ui/src/blocks/hierarchical-topic-detail.tsx`
  (`HierarchicalTopicDetail`, props `levels: TopicLevel[]`, `disclosureStyle?: "covered" |
  "minimized"` (default `covered`), `showBreadcrumb`, `rootLabel`, `trailingCrumbs`, `help`,
  `minDetailWidth`, `exitGuard: PaneExitGuard`, `manualCollapse`, `children`). It dispatches to a
  `CoveredStack` (absolute, overlapping, `COVERED_PEEK` = 40px) or a `MinimizedStack` (grid columns);
  it renders each level's `TopicRail` **and** the detail
  `<section key="__detail__">` as **flat sibling grid columns** (one
  `grid-template-columns` CSS var) — so the leaf has a stable slot (no remount) and ONE
  ResizeObserver drives the whole row. Rail primitive: `topic-detail.tsx` (`TopicRail`
  extracted from `TopicDetail`; `railSlot: RailSlot` is a `ReactNode | (collapsed) =>
  ReactNode` render-prop; optional `backSlot` for the drill-down Back; per-rail drag
  handle with snap-to-collapse/full; animated via `md:transition-[grid-template-columns]`).
  **Covered style:** covered rows render as left-aligned icon strips; a covered row or list `title`
  reveals a full uncovered copy via a `RevealPortal` (`createPortal` to `document.body`, fixed over the
  row's captured `DOMRect`) on hover/focus, closed by one effect (pointer-outside / blur / scroll /
  Escape). **Selection markers:** the shared `useSelectionConnectors` hook + `SelectionConnectorOverlay`
  SVG (`stroke-apt-gold`) draw the parent→child elbows, measured from the DOM via `data-htd-col` /
  `aria-current="true"` / `data-htd-label` / `data-htd-icon` and re-tracked on a short rAF loop across the
  cover slide (`selectionStyle="marker"` in the stack — root dash + connectors; `"bar"` for standalone).
  The frame owns: package-owned `onSelect`/`onClear` (re-click → `onClear`), the
  breadcrumb (derived from `levels`, up-nav via `onClear`, `help` + `trailingCrumbs`),
  the single-controller **off-screen drill-down** (`hidden` count from the observer:
  slide the leftmost lists to `0`-width + `inert`; never the frontier choosing-list while
  unselected), the **Back** button (leftmost-visible pane), and the **3-action
  Save/Discard/Cancel** modal driven by `exitGuard` (`attemptExit`).
  **Unify-via-context.** Features publish their levels up rather than nesting their own
  frame: `workspace-chrome.tsx` (`useWorkspaceLevels` for a feature's topic levels via
  `useLayoutEffect`; `useWorkspaceListLevel` for a dismantled in-pane list, appended
  after the feature levels; `useWorkspaceExitGuard` publishing a **stable ref-backed
  proxy** so the per-render guard identity never loops the provider). The shell
  `WorkspaceShell.tsx` renders ONE merged `HierarchicalTopicDetail` over
  `[...shellLevels, ...chrome.levels, ...chrome.listLevel]`, with `help` =
  `helpFor(activeFeature)` wrapped in `HelpPopover`, and `exitGuard = chrome.exitGuard`.
  `ResourceTab` + the converted panes are **dual-mode**: inside the shell they publish
  levels and render only the leaf; standalone they render their own frame. The
  dismantled master/detail bridge is `useMasterDetailLevel` (publishes the list level +
  registers the editor's `guard` from `useMasterDetailForm`, whose `save()` returns a
  boolean). Reduce-motion is honoured by the global `@adh-shared/themes` accessibility
  CSS (zeroes transition durations). Hub home is gated — verify shared UI on the
  **ui-showcase** (`hierarchical-topic-detail` demo) via Playwright at 375 / 768 / 1440,
  and the hub routes via `e2e/hierarchical-resource.spec.ts` (seeded mock-auth).
- **Deep-link create caveat:** in URL-driven (`urlSelection`) mode, *create* does not
  route — a new record has no id, and pushing a leaf-less URL remounts the catch-all
  route and would drop the in-progress draft — so it keeps the URL put and reports no
  selection until *save* routes to the created id.
- The **resizable-split** ingredient is referenced for the snap thresholds but the drag
  is implemented directly in `TopicDetail` (resizable-split is a vertical ratio split).
- **SwiftUI / Compose:** not applicable — web-only shared composition.

## Design Decisions

- **Flatten, don't nest.** The frame renders the lists + the detail as flat sibling grid
  columns, not nested panes. The rendered row is visually identical, but ONE
  ResizeObserver sees the whole row (correct general→specific collapse) and the leaf keeps
  a stable slot (no remount/flash on list-count change). This is what makes the
  single-controller drill-down possible (separation-of-concerns, simplicity).
- **One stack, no sublists.** Every list is a level of the single stack; the deepest pane
  is only ever a detail. Dismantling the in-pane master/detail (list+editor in one pane)
  into a published list level + a leaf editor keeps the model uniform and deep-linkable,
  and removes a whole class of nested-observer bugs (principle-of-least-astonishment, dry).
- **One chrome, fed by context.** A single full-width breadcrumb + help spans every list;
  the feature **publishes its levels up** through the `WorkspaceChrome` context (rather
  than nesting its own frame), so the shell renders ONE merged frame. The entity selector
  is a first-class list, not a popup — this recipe supersedes [[focused-topic-detail]] for
  workspace routes.
- **Pure-intent selection, package-owned.** `onSelect`/`onClear` are pure navigation; the
  package decides which fires (re-click → `onClear`) and never auto-selects. Consumers
  write no toggle/resume logic — unselection and no-auto-select hold uniformly (dry).
- **Drill-down is the phone layout.** Off-screen drilling isn't a special small-screen
  mode bolted on — it is the same single-controller fit math, so phones simply start with
  every list drilled off and the detail full-width, Back walking up. The manual disclosure
  toggle coexists (a collapsed list counts as its icon width, then hides) (optimize-for-change).
- **Reserve the leading slot always.** A fixed-height `New …`/`+` slot in every list keeps
  first rows aligned with or without a create button (visual consistency).
- **The leaf is a detail; the guard rides with it.** The editor's button bar is the top of
  its leaf pane; its dirty/save state is published as a `PaneExitGuard` so the package can
  prompt Save/Discard/Cancel before any Back / up-nav discards work.
- **Help is data, not markup.** A single keyed `site-config` store keeps help text out of
  components and consistent across the platform (dry).
- **Covered, not just minimized.** The default `covered` style overlaps the lists like a stack of cards
  so the whole ancestry stays glanceable (a 40px peek) while the child + detail take the room — versus
  `minimized`, which slides parents fully off-screen. Both share the one fit controller; covered is the
  better default on wide screens, and the same off-screen drill-down is the phone layout
  (principle-of-least-astonishment).
- **Reveal, don't uncover.** A covered list shows only icons, so each row reveals a full copy on
  hover/focus over its exact spot rather than forcing the user to uncover the whole list — and clicking
  the reveal is a pure select (never a toggle), keeping the covered interaction predictable
  (principle-of-least-astonishment).
- **Markers over a bar.** In the stack the selection is shown by a root dash + parent→child elbow
  connectors rather than a per-list left-bar, so the *relationship* between the selected rows reads at a
  glance across covered lists; the standalone primitive keeps its bar. The connector measurement and SVG
  are one shared `useSelectionConnectors` / `SelectionConnectorOverlay` used by both stacks (dry).

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — `apt-*` tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |
| Live demo exists in ui-showcase (`hierarchical-topic-detail`) | passed | demo-exists |
| One merged stack via context; off-screen drill-down + Back; unsaved guard | passed | implementation |
| Dismantled master/details (one stack, no sublists); package-owned selection | passed | implementation |
| Covered disclosure: 40px peek + hover/focus reveal popover + per-list titles + dash/connector markers | passed | implementation |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-30 | Mike Fullerton | Initial draft — full hierarchical view contract (deep linking, one breadcrumb + help, alignment, resizable/disclosable rails, auto-disclosure, help-config). |
| 1.1.0 | 2026-06-30 | Mike Fullerton | Implemented animated disclosure, drag-resize with snap, window-gated auto-disclosure, detail min-width + horizontal scroll, centered detail title bar + per-pane help, breadcrumb help button, and the site-config help store. Remaining: 5th-level deep linking + shell-rail auto-disclosure. |
| 1.2.0 | 2026-06-30 | Mike Fullerton | Recipe fully implemented: shell workspace/feature rails inherit auto-disclosure (general→specific, nav kept longest); whole-hierarchy deep linking including the 5th leaf level inside a topic's master/detail (`urlSelection` controlled selection + `useLeafUrlSelection` + `leafCrumb` channel), surfaced as the deepest breadcrumb crumb. |
| 1.3.1 | 2026-06-30 | Mike Fullerton | Correct the shrink behavior to the TWO-PHASE spec: undisclose the leftmost lists to icon strips (general→specific) FIRST, and slide lists off-screen ONLY once every list is already an icon strip and they + the detail minimum still don't fit. Also: drill-down applies at every width (not `md:`-gated) so phones drill-down from first paint; the leaf reflows (`min(<min>,100%)`) instead of forcing a horizontal scroll; hidden columns use a real `inert` boolean. New requirement `must-undisclose-before-off-screen`. |
| 1.4.0 | 2026-06-30 | Mike Fullerton | Added the `covered` disclosure style (now the default): lists overlap like cards with a 40px peek of each covered parent (vs `minimized`'s off-screen slide), with auto + manual cover and a hover/focus **reveal popover** (a full row copy floated over a covered icon; click = pure select; closes on pointer-outside/blur/scroll/Escape; also reveals a covered list's title). Added **per-list `title`** (left-aligned + divider). Replaced the in-stack gold selection bar with **`selectionStyle="marker"`** — a root **dash** + parent→child **elbow connectors** (shared `useSelectionConnectors` / `SelectionConnectorOverlay`, DOM-measured via `data-htd-*`, re-tracked across the slide, attached for covered lists); the standalone `TopicDetail` keeps `selectionStyle="bar"`. New requirements `must-default-to-covered`, `must-peek-covered-parent`, `must-cover-automatically`, `must-allow-manual-cover`, `must-reveal-covered-row-on-hover`/`-on-focus`, `must-reveal-covered-title`, `must-pure-select-from-reveal`, `must-close-reveal-robustly`, `may-title-each-list`, `must-mark-selection-without-bar`, `must-keep-connectors-attached-when-covered`, `must-keep-bar-for-standalone`. |
| 1.3.0 | 2026-06-30 | Mike Fullerton | Encapsulated single-stack rewrite: flattened the frame to sibling grid columns (one ResizeObserver / stable leaf slot); `onSelect`/`onClear` pure-intent contract with package-owned unselection + no-auto-select; ONE merged stack — features publish levels up through `WorkspaceChrome` (`useWorkspaceLevels`/`useWorkspaceListLevel`) instead of nesting; dismantled every in-pane master/detail (Applications, Buckets, Access, Users, Team Members) into a published list level + leaf editor, and split Personas into Personas + Persona Services; replaced auto-collapse-to-icons with **off-screen drill-down** + top-left **Back** + a 3-action **Save/Discard/Cancel** unsaved-work guard (`exitGuard`/`PaneExitGuard`), the manual disclosure toggle coexisting. Removed `maxExpanded`/`onCrumbNavigate`. |
| 1.4.2 | 2026-07-03 | Mike Fullerton | Close a `must-not-hide-frontier-choosing-list` gap in the covered stack: the off-screen shift enforced the detail's minimum width even for an UNSELECTED frontier, so on a narrow viewport (e.g. a one-level stack on a phone) it slid the sole choosing list off the left edge to give a landing PLACEHOLDER its minimum — leaving nothing to pick from. The shift now enforces the detail minimum only when a real leaf is selected (`detailMin = firstUnselected === -1 ? minPx : 0`); an unselected frontier's placeholder claims no minimum, so the choosing list keeps its place and the landing takes the remaining width. `must-cover-automatically` clarified. |
| 1.4.1 | 2026-06-30 | Mike Fullerton | Close a `must-guard-unsaved-on-exit` gap: `railOnSelect` previously ran a select UNGUARDED whenever the target rail was not shallower than the deepest selection (`i < deepestSelected`), so swapping to a **sibling row in the deepest selected level** replaced/unmounted a dirty leaf editor with no prompt (silent data loss — e.g. switching tables in the `/all-data` browser). It now guards any select of a different row in a level that already has a selection (`level.selectedId != null`), covering the sibling swap; only a forward drill-down into a not-yet-selected level stays unguarded. No-op for guard-less consumers (`attemptExit` is a no-op without a dirty `exitGuard`). |
