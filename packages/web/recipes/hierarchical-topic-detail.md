---
id: 0bba1f5b-bc8d-4f76-b1c9-329b627f7ee8
title: Hierarchical Topic / Detail View
domain: agenticdeveloperhub://recipes/hierarchical-topic-detail
type: recipe
version: 1.16.0
status: draft
language: en
created: '2026-06-30'
modified: 2026-07-15
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: Deep-linkable stack of collapsible/coverable topic lists under one breadcrumb — covered parents peek and reveal the whole branch (that list AND its children) on hover, a header "+" create affordance, dash/connector selection markers, min-width detail, and a narrow (iOS navigation-controller) mode when only a detail fits.
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

There is a **single** hierarchical topic/detail stack. **Every NAVIGATION list is a
level of it**, and the deepest pane is only ever a **detail**. The in-pane
"master/detail" pattern (a list you navigate + the editor it opens, inside one pane) is
**dismantled**: each such list (Applications, Buckets, Access, Users, Team
Members, Personas, Persona Services) is a **stack level**, and its editor is the
**leaf detail**. The deep-link selection (e.g. `…/applications/<appId>`) is just that
level's `selectedId`. App code only **declares** the stack (the `levels` data) — it
never nests views or writes selection logic. Terminology: **stack / topic list (a
level) / detail (the leaf)** — not "rail" / "sublist".

#### Navigation vs. display — the line this rule actually draws

The rule bans a second **navigator**, not a second *list*. The distinction is what the
list is FOR:

- **Navigation** — you pick a row to go *somewhere*: the row becomes the selection, the
  URL grows a segment, and the pane beside it becomes that record's detail. That is the
  stack's whole job, and duplicating it inside the leaf is what "no sublists" forbids.
  Such a list MUST be a level.
- **Display** — the pane is *showing you data*, and a list is one of the ordinary shapes
  data comes in (beside a board, a table, a timeline, a calendar, a chart). A display is
  **content**, and content is exactly what a detail pane holds. A display MAY be a list;
  it MAY carry its own details pane and edit its rows in place. None of that is
  navigation: the stack doesn't move, no level is selected, the URL doesn't grow.

So "the deepest pane is a detail" is a statement about the pane's ROLE, not its shape — a
detail is content, and content may perfectly well *render* as a list. Work Items is the
worked example: its five views (List / Board / Table / Timeline / Calendar) are five
DISPLAYS of one collection, and the List one is a [[list-with-details-pane]] with in-place
row editing. Nothing about it navigates. What WOULD violate the rule is a rail inside the
leaf that you drill *through* to reach a record — that record's list belongs in the stack.

### onSelect / onClear — pure-intent selection

A level's selection is two pure-navigation callbacks:

```ts
interface TopicLevel {
  id: string
  title?: string                   // left-aligned list title (divider under it); reveals when covered
  items: TopicDetailItem[]
  selectedId: string | null
  defaultSelectedId?: string       // OPT-IN landing selection: chosen when this list APPEARS empty
  onSelect: (id: string) => void   // select THIS level (clears descendants). Pure nav: push(`…/<id>`)
  onClear: () => void              // clear THIS level + everything below. Pure nav: push(parentUrl)
  emptyLabel?: string
  onNew?: () => void               // "New…" create affordance → a right-justified "+" in the list header
  newLabel?: string                // accessible name + tooltip for the "+" (e.g. "New Persona")
  newActive?: boolean              // tint the "+" gold while a create is in progress
  titleActions?: ReactNode         // extra compact controls in the TITLE row, just ahead of the "+"
}
```

The **package** decides which fires — a click on the already-selected row calls
`onClear()`, a click on any other row calls `onSelect(id)`. **Unselection is uniform
and package-owned**: consumers write no `prev === id ? null : id` toggle. The package
**never auto-selects** — landing on a level with no selection shows the list with
nothing focused (no resume, no coerced first item) — **unless that level asks it to**,
via `defaultSelectedId`: the one item to pick when the list appears with nothing chosen
(Work Items → List). It fires the level's own `onSelect`, so it is a normal selection in
every respect, and it arms once per appearance, so clearing the row inside a visit
sticks. Breadcrumb up-navigation and the drill-down **Back** also clear via `onClear`,
so all three deselect paths are one code path.

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
> panes on top of it, first-item alignment, and the `New …` header `+` (`onNew`). Also
> built: **package-owned unselection** (re-click `onClear`), **no auto-select**,
> **off-screen drill-down** (leftmost lists slide off, general→specific, computed
> pre-paint so phones start drilled-down) with a **top-left Back** button and a **3-action
> Save / Discard / Cancel** unsaved-work guard (`exitGuard`), the **manual disclosure
> toggle** (coexists with drill-down), **drag-resize with snap**, **detail-pane min-width +
> horizontal scroll**, the **breadcrumb help button** (right-justified), the **unified
> `site-config` help store**, and **per-segment deep linking of the whole hierarchy**
> including the dismantled list levels. See **Platform Notes**.

### Auto-hide — only the frontier list is disclosed; the covering click floats, never snaps

`autoHideTopics` (default **on**) makes the stack lead with its deepest list: every list **above
the FRONTIER** (the deepest rendered list — the first unselected level, else the last) is hidden by
its child even when there is room to show it. Auto-hide is the default because a feature surface is
normally *used* at its leaf — the ancestry is provenance, not navigation. The hub's workspace
routes (`/home`) pass `autoHideTopics={false}`: there the ancestry (workspace ▸ feature ▸ entity ▸
topic) IS the navigation, so every list stays disclosed while it fits.

The select that pushes a new choosing list covers the list the user clicked in **with the pointer
still inside it** — the exact state the hover reveal answers, except the pointer never moved, so no
enter event will ever fire. In the covered style that select therefore roots the **branch reveal**
at the clicked list itself (`must-root-reveal-on-covering-select`): the clicked list stays open in
place, the new choosing list slides out beside it **floating over the detail** — exactly as if the
user had moused into their freshly covered parent — and the stack settles into the covered layout
when the pointer leaves the branch. A select that instead completes the path covers nothing
at/below the clicked list, and the blindly rooted reveal is dropped as a no-op. (v1.12.5; v1.12.4
had instead kept a choosing frontier's parent disclosed IN FLOW — suspending auto-collapse rather
than answering it — and before that the parent snapped shut under the cursor on the very click,
with nothing to reopen it.) The minimized style has no floating reveal: a hidden list is an icon
strip, still visible and clickable, so there the parent goes straight to its strip.

The **root** list's header carries a left-justified toggle reporting the STATE (gold + a closed panel
while on; muted + an open panel while off). Turning it **on** hides every disclosed parent; turning it
**off** discloses every list that fits (the auto-collapse rules below then re-hide whatever doesn't).
Flipping it clears the per-list `«`/`»` pins, so it is always a clean reset to one of the two modes.

Disclosure therefore has three layers, and **each may only ever HIDE more, never disclose**:

1. **pins** — the user's own `«`/`»` intent on one list (wins over auto-hide in both directions),
2. **auto-hide** — the default for every list above the frontier when there is no pin,
3. **width pressure** — the fit rules below, which may take the room back from a list the user pinned
   open (there is none to give) but never disclose one they pinned shut.

**⌘/Ctrl-click** on any `«`/`»` applies that button's action to **every** list at once — one click to
collapse the whole ancestry, or to open all of it (subject to the fit rules).

### Auto-collapse — how the stack yields room (the authoritative rules)

The **detail pane is the priority**: it is never sacrificed to keep a topic list on screen. As the
container narrows, the lists yield in a strict order, and the detail keeps its `minDetailWidth`
until it is the SOLE view — at which point it is exactly the container's width.

**Shrinking:**

1. The detail holds its width. Every list is measured at its full width, the detail at its minimum.
2. **Phase 1 — hide.** While the lists + the detail's minimum don't fit, hide the **leftmost** still-
   disclosed list (general → specific), one at a time, until they fit or every list is hidden. A
   hidden list is a 40px peek (`covered`) / an icon strip (`minimized`) — it still occupies that width.
3. **Phase 2 — off-screen.** Only once every list is already hidden and the peeks + the detail's
   minimum STILL don't fit: slide the **leftmost** list off the left edge and shift the whole stack
   left by **exactly that list's width**, hiding it. Repeat list by list until the detail fits, or
   only the frontier remains. The shift is **quantised to whole lists** — a continuous shift would
   park a list half off the edge, which reads as a clipped rail rather than a drilled-down one.
4. The **frontier** (a list with nothing selected yet) is never hidden or slid off for the detail's
   minimum: its "detail" is only a landing placeholder, which enforces NO minimum, so the list you are
   choosing from always keeps its place.

**Growing** is the same rules run again from scratch on the wider container, so it reverses exactly:
off-screen lists slide back on (specific → general), then hidden lists disclose — but **a list only
re-discloses when `autoHideTopics` is off** (and was not pinned shut), because auto-hide is an intent
layer above the fit rules, not a consequence of narrowness.

### Selection lands in place — no slide-in

Choosing a topic changes the stack's STRUCTURE (a level appears, or the detail flips from a
minimum-less landing to real content that claims `minDetailWidth`, re-hiding the lists behind it).
That re-layout MUST be applied **instantly, in place** — the detail must never animate in from the
left edge as the lists close behind it. Only **width-driven** changes animate: a window resize, a
`«`/`»` cover toggle, the hover reveal, a drag.

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

### Whole-stack reveal for covered lists — hover opens everything, a click opens only its branch

Because a covered list shows only icons, the frame makes it **reachable without permanently uncovering
it**: the pointer ENTERING a covered/peeking list opens **every on-screen list — parents and children
alike** — chained side by side at full width from the left edge, **floating over the detail** (a lifted
card with a drop-shadow off its trailing edge). Each revealed list is the real rail: full-width rows
**and** its titled header (title, cover `«`/`»`, the New `+`).

For the HOVER, the unit is the **whole stack** (v1.13.0; it was the hovered list's branch, which left
the hovered list's own parents covered and made walking the stack leftwards a list-by-list re-rooting
exercise). One deliberate mouse-in answers the whole question: the full ancestry as it will look, which
is what the peeks were hiding in the first place. Off-screen (drilled-down) lists stay out of the
reveal — Back is their affordance.

The COVERING CLICK is different (v1.13.0): the reveal a select roots (see auto-hide below) opens ONLY
the clicked list and its children — never the user's collapsed parents. A click on a visible row is an
act of navigation, not of disclosure; springing the whole stack open on every leaf click buries the
detail the user just asked for under lists they had deliberately collapsed. The click-rooted reveal
exists solely so the clicked list does not snap shut under the pointer.

The branch opens **in place**: it starts where the hovered list already sits and lays its members out
end to end. The covered peeks behind it don't move — but the **detail is never covered**: it slides
**right** so its content stays visible beside the reveal (v1.13.1; it used to be overlapped, which hid
exactly what the user was reading), clipping at the container's right edge on deep stacks, and slides
back when the cascade closes. It stays open while
the pointer is anywhere **inside the branch** (walking from the hovered list into one of its revealed
children must NOT collapse it — that is the whole point); it closes the moment the pointer leaves every
member of it, or you **click a row**. Entering a *different* covered list re-roots the branch there.

The reveal is **pointer-driven only** (not focus): a covered row keeps focus after a click, so a focus
reveal would leave the branch open and jam the auto-cover as the window shrinks — covered rows stay
keyboard-operable via their `aria-label`. Because the revealed lists are the real rails (not copies)
they are fully **interactive**: clicking a row is a **pure select** of that item (it only *changes* the
selection, never unselects, and does nothing if the row is already selected), and the headers' `+`/`«`
work in place. There is **no per-row or per-header popover** — the branch is revealed at once.

### Wide and narrow modes — the stack becomes a navigation controller

The frame has two **layout modes**, chosen automatically (`layoutMode="auto"`):

- **wide** — everything above: the lists sit beside the detail, cover/peek/reveal as room runs out, and
  drill off-screen at the end. This is the layout the whole recipe describes.
- **narrow** — **only a detail fits**: the container can't hold one topic list beside a `minDetailWidth`
  detail. The side-by-side model has nothing left to trade — peeks, cover toggles and the hover reveal
  are all pointer affordances spending room that no longer exists (and on a phone there is no pointer at
  all). So the view stops being a row of columns and becomes a **navigation stack**, exactly Apple's
  `UINavigationController`: **one FULL-WIDTH pane at a time**.

Narrow mode is entered when the container is narrower than one topic list plus the detail's minimum, OR
when the browser is a **phone** (an iOS / Android phone user agent) at any width. Tablets and desktops
are decided by width alone — a narrow *window* on a big screen behaves exactly like a phone, and a wide
one doesn't. `layoutMode="wide" | "narrow"` forces one (a showcase, a test).

In narrow mode:

```
[ Workspaces ]  →  [ Features ]  →  [ Entities ]  →  [ detail ]
      ‹ Back            ‹ Back           ‹ Back
```

- The visible pane is the deepest one the selection reaches: the **frontier list** while it is still
  being chosen from, the **detail** once every level is selected. A landing placeholder is never shown —
  on a phone you are looking at the list you are choosing from, not a pane telling you to choose.
- **Selecting pushes** the next pane in from the right edge; the pane behind it parallaxes left (as iOS
  does) and is `inert` + `aria-hidden`, so only the visible pane is reachable by pointer, keyboard or AT.
- **Back** (top-left of every pane but the root) **pops**: it clears exactly the deepest selected level
  — the same `onClear` the breadcrumb and the wide layout's Back use, so the unsaved-work guard applies
  identically. Repeated Back walks to the root.
- Selection in a list falls back to the primitive's gold **bar** (`selectionStyle="bar"`): the marker
  system's connectors need a parent list on screen to connect FROM, and in narrow mode there is never one.
- The breadcrumb still spans the top — it is the one thing that shows the whole trail when only one pane
  is visible.

### Create is a modal — the stack's create metaphor

**A create is always a modal over the stack.** The `+` in a list's header opens it; the stack does
not move while it is open (no level selected or cleared, the breadcrumb unchanged, the pane behind it
still showing whatever was there). On save the modal returns the created id and the owning list
**selects** it, so the detail that opens is the new record's real detail. On cancel, nothing changed.

This is not a style preference — it falls out of what the detail pane *is*. **The detail always shows
a real, SELECTED record.** A record that does not exist yet has nothing for the stack to hold onto:
nothing is selected, so the frontier list has no focused row and the connectors have no child to
reach; the breadcrumb has no crumb to name it; and the deep link has no id to carry (a "new" leaf is
un-linkable — reload the URL and the draft is gone). Handing the detail pane to a not-yet-existing
record therefore strands every other part of the view. The modal sidesteps all of it by not touching
the stack at all: the hierarchy stays exactly as it was until there IS an id, and then the normal
selection path takes over.

It follows that the modal asks only for what **places** the record — a name/title, and the parent it
lands under (a status column, a group) — not the record's full editor. The rest belongs to the detail
that opens on save, which is the one place a record's fields are edited. New Project asks for a name
and a description; New Work Item asks for a title, a description, and the status column.

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

Connectors join **selected rows only** — the chain ends at the deepest selected row. A list that is
open with **nothing selected** (the frontier being chosen from) gets **no line into it**: a line that
ends at the list's edge lands beside whatever row happens to sit at the parent's height and reads as a
phantom selection (v1.13.0 — a stub into the unselected frontier was tried and rejected). The
unselected frontier's own landing is the topic overview below, not a connector.

Standalone `TopicDetail` (the single two-pane primitive, used by [[focused-topic-detail]] and the showcase)
keeps the classic **`selectionStyle="bar"`** gold left-border — the dash/connector markers are a property of
the hierarchical stack, not the primitive.

### Topic overview — the automatic no-selection landing (every HTDV)

Whenever the **frontier** list (the deepest rendered one) has **no selection**, the detail pane shows
the standard **topic overview** — a responsive grid with **one card per row of that list**: the row's
icon + label, and its `description` when the item carries one. Clicking a card **selects that row in
the list** — it is the same `onSelect`, so URL, breadcrumb and connectors follow exactly as if the row
had been clicked. The overview is titled by the **parent's selected row** (the entity whose topics
these are), else the level's own title.

This is a property of the FRAME, not of any host: **every** hierarchical view gets it automatically —
the workspaces list at bare `/home`, the workspace features at `/<slug>/home`, a product's topics, a
group's members, an editor's sections — with **no host wiring**. It exists ONLY in the no-selection
state: the moment the frontier gains a selection, the host's real detail (`children`) shows. Cards
never appear beside or instead of a selected topic's view.

Each card **fits its contents**: the title lays out `flex items-start` with a break-anywhere label span,
so a long label with no spaces to wrap on (a full reverse-domain identifier) wraps cleanly across lines
INSIDE the card — the icon pinned to its first line — instead of overflowing or clipping at the card's edge.

Three seams:

- `TopicDetailItem.description` — the card copy. Hosts should source it from the same store as the
  help popovers (the hub reads `help.en.json`), so card text and help never drift. Items without one
  render icon + label only.
- `TopicLevel.overviewHelp` — swap the whole card grid for a single **centered help blurb** (exported
  `TopicOverviewHelp`) at this level's unselected frontier. It is for a list of **one KIND of thing** (a
  Sites list, a Groups list) where a grid of 100+ near-identical cards is noise: instead, one readable,
  customizable blurb (the host's — a string or richer nodes) explains what the items are and why you'd
  pick one. The component owns only the centered framing (`max-w-prose`, `text-center`, `<strong>`
  emphasis); the content is the host's, and it too should read from the help store. `overviewHelp` wins
  over the card grid at this level, and is ignored when `overview: false`.
- `TopicLevel.overview: false` — the opt-out, for a level whose unselected state has a REAL landing of
  its own (ResourceExplorer's searchable entity landing with New). Everything else takes the default.

Implementation constraint that is easy to break: the host's `children` MUST stay **mounted (hidden)**
under the overview. In the merged one-rail stack the deeper levels are PUBLISHED by components living
in `children` (`StackLevels`); unmounting them unregisters the very frontier level the overview is for,
and the stack oscillates between the two states (React's max-update-depth crash).

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| Topic Detail | agenticdeveloperhub://recipes/topic-detail | One rail per hierarchy level (icon+name rows, optional left-aligned `title`, controllable collapse/cover, header `+` create affordance, `selectionStyle` bar/marker, whole-branch hover reveal when covered, full-width pane in narrow mode). | yes | `title`, `items`, `selectedId`, `onSelect`, `onNew`/`newLabel`/`newActive`, `collapsed`/`onCollapsedChange`, `covered`, `isRoot`, `selectionStyle`, `panePadding={false}`. |
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
- **must-align-first-row**: The first item of every topic list MUST sit at the same vertical position across lists. Alignment comes from the uniform titled header (same height + divider on every titled list), NOT a reserved leading slot — the "new topic" affordance is a header `+`, so the first row sits directly under the header at a consistent top padding (a list with no leading slot reserves no extra space).

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
- **may-offer-new-topic-button**: A topic list MAY carry a "new topic" (`onNew`) create affordance, rendered as a compact **`+` button right-justified in the list header** (NOT a leading row); activating it MUST open the create MODAL (see **must-create-in-modal**). The `+` carries its `newLabel` as its accessible name + tooltip, and MAY tint gold (`newActive`) while the modal is open.
- **may-offer-title-actions**: A topic list MAY carry extra compact controls right-justified in its TITLE row, just ahead of the `+` (`titleActions` — e.g. the status board's Sites list hosts its Auto Configure action there, freeing the `headerSlot` filter field to take the full row width via `ListHeader`'s `search.grow`). Title-row actions render only with a titled, un-collapsed header; keep them one line high.
- **must-create-in-modal**: A create MUST be a **modal over the stack** — never a blank/"new" leaf in the detail pane, and never an inline row in the list. The stack MUST NOT move while the modal is open: no level is selected or cleared, the breadcrumb is unchanged, and the pane behind it keeps showing whatever was open. On save the modal MUST return the created id, and the owning list MUST then select it — so the detail that opens is the new record's REAL detail. On cancel nothing changed. Reuse the shared `CreateResourceDialog` — the component lives in `@agentic-toolkit/ui/blocks` (so consumers that vendor only ui, e.g. the self-enclosed status/builds backends, can comply); `@agentic-toolkit/resource` re-exports it with the auth-telemetry seam (`onSaveError`) pre-wired. Guarded close: a dirty draft prompts Save / Discard / keep editing; the backdrop is inert.
- **must-scope-create-modal-to-placement**: The create modal MUST ask only for what brings the record into existence and PLACES it (a name/title, and the parent/status/column it lands in) — not the record's full editor. Everything else belongs to the detail that opens on save. (New Project = name + description; New Work Item = title, description, status.)
- **may-delete-row**: A topic row MAY declare `onDelete` to expose a **right-justified trash button, revealed only on hover (and keyboard focus)**; the list's fixed width MUST account for it (the row reserves trailing space so the label never runs under the button). It is NOT shown on the collapsed / covered icon strips.
- **must-confirm-row-delete**: Activating a row's trash button MUST open a confirmation before anything is destroyed — a destructive [[alert-and-dialog]] modal (red action, keyboard shortcuts off, initial focus on Cancel). `onDelete` runs ONLY on confirm; it MAY be async, and the dialog MUST show a busy spinner (and block dismissal) until it settles.
- **must-break-connector-around-delete**: In the stack, the selection connector line MUST break (leave a gap) around a selected parent row's trash button rather than crossing it — the overlay paints above the rail, so the break is a computed gap in the path, not occlusion.
- **must-offer-disclosure-toggle**: A topic list MUST offer a disclosure toggle at its upper right; disclosing/undisclosing MUST be animated (subject to **must-respect-reduced-motion**).
- **must-render-undisclosed-icon-strip**: An undisclosed topic list MUST render as a vertical list of the topics' icons; the header `+` collapses with the header (reachable via the whole-branch reveal when covered).
- **must-fill-list-vertically**: A topic list MUST fill the available vertical space (pinned to its container's height) and MUST scroll only when its items overflow.
- **must-resize-by-drag**: A topic list MUST be horizontally resizable by dragging its trailing border.
- **must-snap-undisclosed-when-narrow**: If dragged narrower than 1/3 of its full width, a topic list MUST animate to undisclosed.
- **must-snap-full-when-wide**: If dragged wider than its content plus the default padding, a topic list MUST animate (back) to its full content width.

### Selection — pure intent, package-owned

- **must-split-select-clear**: A level MUST expose `onSelect(id)` (select this level, clear descendants) and `onClear()` (clear this level + everything below) as PURE navigation; the package decides WHEN each fires.
- **must-own-unselection**: A click on the already-selected row MUST clear that level (`onClear`); a click on any other row MUST select it (`onSelect`). Consumers MUST NOT write toggle logic.
- **must-not-auto-select**: The view MUST NOT auto-select anything of its own accord — landing on a level with no selection shows the list with nothing focused (no resume of a last id, no coerced first item); only the deepest pane that IS selected renders a detail. The ONE exception is a level that explicitly asks for a landing selection (**may-default-select-a-level**); a level that names none is never chosen for.
- **may-default-select-a-level**: A level MAY name a `defaultSelectedId` — the item to select the moment that list APPEARS with nothing chosen (i.e. when the parent topic that opens it is picked). It MUST arrive as an ordinary selection, fired through the level's own `onSelect`, so the URL, the breadcrumb, the detail and re-click-to-clear all behave exactly as if the user had clicked the row; the package MUST NOT special-case it afterwards. It MUST arm once per APPEARANCE: clearing the row INSIDE that visit MUST stick (a default that re-fires on every clear makes the row impossible to deselect — a default may choose FOR the user, never argue WITH them), while leaving the parent topic and returning MUST re-apply it. A default naming an item the list does not (yet) have MUST simply not fire — an async list applies it when its rows land, and a stale default MUST NOT select a phantom row. Use it where the answer is all but certain and an empty pane would just ask a question with one sensible answer (Work Items → List); the default for every other level remains **must-not-auto-select**.
- **must-be-one-stack**: Every NAVIGATION list MUST be a level of the single stack — a list is "navigation" when picking a row is how you REACH a record (the row becomes the selection, the URL grows a segment, and the pane beside it becomes that record's detail). An in-pane master/detail of that kind MUST be dismantled into a published list level + a leaf editor. There MUST be exactly one navigator.
- **may-display-content-as-a-list**: A detail pane holds CONTENT, and content MAY render as a list — a list is one of the ordinary shapes data comes in, beside a board, a table, a timeline, a calendar or a chart. A display MAY carry its own details pane and MAY edit its rows in place ([[list-with-details-pane]] + [[inline-commit-control]]), because none of that is navigation: the stack does not move, no level is selected, and the URL does not grow. "The deepest pane is a detail" constrains the pane's ROLE, not its shape.

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
- **must-keep-detail-at-minimum-while-lists-yield**: Shrinking MUST take the room from the LISTS, never from the detail: the detail MUST hold `minDetailWidth` through both phases, and MUST only be narrower than it once every list is off-screen and it is the sole view — where it MUST be exactly the container's width.
- **must-shift-off-screen-by-whole-lists**: In phase 2 the off-screen shift MUST be quantised to WHOLE lists — shift the stack left by exactly the leftmost visible list's width, hiding that list, and repeat. A partial shift (parking a list half off the left edge) is a defect.
- **must-reverse-on-grow**: Widening MUST re-run the same rules on the wider container, so off-screen lists slide back on (specific → general) and hidden lists re-disclose — but a list MUST re-disclose ONLY when `autoHideTopics` is off and the user has not pinned it shut.

### Auto-hide — lead with the leaf

- **must-default-to-auto-hide**: The frame MUST default to `autoHideTopics = true`: only the LEAF-MOST topic list is disclosed and every parent is hidden by its child even when there IS room for it. A surface whose ancestry is its navigation (the hub's workspace `/home`) MUST opt out with `autoHideTopics={false}`.
- **must-offer-auto-hide-toggle**: The ROOT list's header MUST carry a left-justified toggle that reports whether auto-hide is on (a STATE, not an action — gold/closed-panel on, muted/open-panel off, `aria-pressed`). Turning it ON MUST hide every disclosed parent; turning it OFF MUST disclose every list that fits (the auto-collapse rules then re-hide whatever doesn't).
- **must-layer-hide-intent**: Disclosure MUST resolve as three layers where each may only ever HIDE more, never disclose: a user's `«`/`»` pin (wins over auto-hide both ways) → auto-hide's default for non-leaf lists → width pressure (which MAY take the room back from a list the user pinned open, but MUST NOT disclose one they pinned shut).
- **must-toggle-all-on-modifier-click**: ⌘-click (macOS) / Ctrl-click (elsewhere) on any `«`/`»` MUST apply that button's action to EVERY list at once — cover all, or uncover all — with the fit rules still applied on top (so "uncover all" only discloses the lists that actually fit).
- **must-apply-disclosure-toggles-immediately** (v1.13.3): A `«`/`»` pin click and the auto-hide toggle MUST settle the stack to the new state on the click itself — which means the click MUST also DROP any open hover reveal. A revealed group renders its members at full width regardless of pins or the auto-hide mode, and these controls live on headers that are usually only reachable INSIDE a reveal; without the drop, the click changes state invisibly (the pointer never leaves, so the reveal never closes) and the new layout "turns up later" when the pointer happens to move away — the toggle reads as dead and the mode as stuck. The pointer has not moved, so no enter event may re-open the reveal on the same click; the next real pointer entry onto a covered peek engages it as usual. (Contrast must-root-reveal-on-covering-select: a row SELECT deliberately roots a reveal so the clicked list doesn't snap shut under the pointer — the disclosure toggles are the opposite: settling IS the requested action.)

### View state belongs to the surface, not to the mount

- **must-keep-view-state-across-a-selection**: Selecting a row is a route change, and a route change REMOUNTS the page subtree — so anything the stack keeps in per-instance state is destroyed by the user's own click. Every piece of VIEW state MUST therefore outlive the mount, held per SURFACE (keyed by the root list) rather than per component: the **auto-hide** toggle, the per-list **pins**, the open **hover branch**, and the record of which levels' **defaults have already been applied**. The bugs this rule exists to forbid all look different and are one bug: lists the user opened snapping shut with the toggle flipped back on under them; a revealed branch collapsing the instant a row inside it is picked, with the pointer still in it and no event left that could reopen it; and a `defaultSelectedId` re-selecting the row the user just cleared, making it impossible to deselect. A reload MAY reset this state — a fresh load is a deliberate fresh start.
- **must-portal-modals-out-of-the-stack**: A modal opened from inside the stack (a level's `+` create dialog, a confirmation) MUST be portalled to the document body. Rendering it in place leaves it a DESCENDANT of the pane that opened it, so it inherits that pane's fate — and narrow mode marks every pane that is not on top `inert` + `aria-hidden`, which makes the dialog unusable: the form silently swallows every keystroke and Save never enables. `position: fixed` is not enough; only a different parent is.

### Motion — structure lands in place, width animates

- **must-land-structure-changes-in-place**: A STRUCTURAL change — a level appearing/disappearing, or any level's selection changing — MUST apply its new layout instantly, in place. The detail pane MUST NOT animate in from the left edge as the lists re-hide behind it, and no list may animate out.
- **must-animate-width-changes**: Width-driven changes — a window resize, a `«`/`»` cover toggle, the hover reveal, a drag — MUST keep animating (subject to **must-respect-reduced-motion**).

### Covered disclosure — peek, reveal, titles, selection markers

- **must-default-to-covered**: The hierarchical frame MUST default to the `covered` disclosure style; `minimized` is opt-in via `disclosureStyle="minimized"`.
- **must-peek-covered-parent**: In the `covered` style, a covered parent list MUST stay partially visible as a fixed ~40 px icon-strip peek at its left edge (a stacked-card overlap), not disappear entirely; child lists overlap their parents with increasing z-index and the detail is topmost.
- **must-cover-automatically**: A list MUST be covered automatically when there is not room to show it in full alongside the child lists and the detail at its minimum; the **frontier** choosing list (nothing selected yet) MUST NOT be covered, and MUST NOT be slid off-screen by the detail's minimum-width shift — an unselected frontier's detail is a landing placeholder that enforces NO minimum, so the choosing list always keeps its place.
- **must-allow-manual-cover**: The user MUST be able to manually cover/uncover a list via its `«`/`»` toggle; a manually-covered list MUST stay covered across resizes (user intent wins), and the auto layer MUST NOT uncover a list the user covered.
- **must-reveal-all-covered-lists-on-hover** (v1.13.0; supersedes must-reveal-covered-branch-on-hover): The pointer ENTERING a covered (peeking) list MUST reveal EVERY on-screen list — the hovered list's parents AND children alike — as real rails at full width, with uncovered `[icon] [name]` rows AND their titled headers (title, cover `«`/`»`, New `+`), chained side by side from the left edge as a lifted card (drop-shadows off both outer edges); the DETAIL is pushed right, never covered (must-push-detail-aside-on-reveal). Revealing less is a defect: the branch-only reveal left the hovered list's own parents covered, so walking the stack leftwards was a list-by-list re-rooting exercise. Off-screen (drilled-down) lists stay out — Back is their affordance. The reveal MUST be ANIMATED: the branch wipes open from the 40px peek to full width (and back), subject to **must-respect-reduced-motion**. There MUST be no per-row or per-header popover copy. The reveal is POINTER-driven only: it MUST NOT be triggered by focus, because a covered row keeps focus after a click and a focus reveal would leave the branch open — jamming the auto-cover as the window shrinks. (Covered rows stay keyboard-operable via their `aria-label`.)
- **must-open-branch-in-place**: The branch MUST open IN PLACE — starting at the left edge the hovered list already occupies, laying its members out end to end. The covered peeks and lists underneath keep their geometry; closing the branch animates everything straight back to the layout it came from (the state it was in before the hover).
- **must-push-detail-aside-on-reveal** (v1.13.1): The reveal MUST NOT cover the detail. While a reveal is open the detail's left edge MUST track the group's right edge — the detail slides RIGHT (animated, subject to must-respect-reduced-motion) so its content stays visible beside the open lists, clipping at the container's right edge when a deep stack leaves it no room, and slides back when the reveal closes. Only the detail yields; the peeks behind the group are still overlapped (that is what the card shadows mark).
- **must-keep-branch-open-while-inside-it**: The revealed branch MUST stay open while the pointer is inside ANY of its members — moving from the hovered list into one of its revealed children MUST NOT collapse it. It MUST close (animate back to the previous state) only once the pointer has left every member of the branch. Entering a DIFFERENT covered list MUST re-root the branch at that list.
- **must-grow-the-branch-walking-outward**: Walking the pointer OUTWARD (right → left, into a shallower peek) MUST grow the cascade: the newly entered list joins it as its new root, pushing the already-open lists to the right, and every list that was open STAYS open. Collapsing the cascade because the pointer moved to a list outside the current group throws away everything the user just opened, one step before they get to the top of the stack. Only the pointer leaving the COLUMNS entirely closes it.
- **must-close-branch-only-on-pointer-exit**: The POINTER — and nothing else — closes the branch. Selecting a row inside it MUST NOT collapse it: the pointer is still in there, and collapsing under the cursor yanks the rows out from under the gesture, so you could never pick a parent and then go on to pick its child in the list that just re-populated beside it — which is what a whole-branch reveal is FOR. The branch (including any deeper list the new selection just added to it) MUST stay open until the pointer leaves every member, and MUST then animate back to the layout the new selection implies.
- **must-not-expand-parents-on-select** (v1.13.0): A CLICK on a visible row MUST NEVER expand the user's collapsed parent lists. Clicking is navigation, not disclosure: the expand-everything reveal belongs to the pointer deliberately ENTERING a covered strip, and only there. The click-rooted reveal below is bounded at the clicked list.
- **must-root-reveal-on-covering-select**: A select that COVERS the list it happened in — auto-hide covering the clicked list because its child list just appeared, or width pressure re-covering it — MUST root a BRANCH reveal (the clicked list and its children ONLY — see must-not-expand-parents-on-select) at that list on the select itself: the pointer is still inside the list, which is exactly the state the hover reveal serves, but the pointer never moved, so no enter event can engage it. The clicked list MUST stay open in place with its new choosing child revealed beside it, floating over the detail, until the pointer leaves the branch (the covered layout then applies). A select that covers nothing at/below the clicked list MUST leave the resting stack untouched — no z-lift, no floating-card shadows (the blindly rooted reveal is dropped as meaningless). Deep links get no reveal: there is no pointer in the stack to serve.
- **must-float-branch-as-an-opaque-card**: The revealed branch MUST read as one opaque card floating over the UI. Both of its OUTER edges MUST be edges — a drop-shadow off its trailing edge (over the detail it covers) AND off its leading edge (over the peek stack it slid out of); a peek's own trailing border is clipped away with the rest of its rail, so that leading shadow is the only boundary there, and without it the opened list bleeds into the icon strip behind it. Members INSIDE the branch abut each other, separated by their own rail borders. The branch MUST also be opaque: a rail background that is deliberately translucent against the page (the nav token) MUST be composited over an opaque page-coloured layer while it floats, or the detail's text ghosts through the branch.
- **must-draw-connectors-over-the-revealed-branch**: The selection connectors MUST stay VISIBLE across the revealed branch — they are the chain the branch exists to show you. The connector overlay MUST therefore be lifted above the branch's own lift: the branch's members float above the detail, so an overlay left at the resting z-order is painted over by the very lists it links, and the selection chain vanishes exactly when the user opens the branch to read it.
- **must-pure-select-from-reveal**: Clicking a row in a revealed list MUST be a PURE select of that item — it changes the selection only (it MUST NOT unselect, and MUST do nothing if the row is already selected), removing the deeper lists and showing the chosen item's detail.
- **may-title-each-list**: A level MAY carry a `title`; when present it MUST render left-aligned (aligned with the row text) with a divider beneath it, the disclosure toggle in a fixed leading control slot.
- **must-mark-selection-without-bar**: In the stack (`selectionStyle="marker"`) the selected row MUST NOT use the topic-detail gold left-bar; the root's selected row MUST show a leading gold dash, and each child's selected row MUST be joined to its selected parent row by a gold elbow connector.
- **must-connect-selected-rows-only** (v1.13.0): A connector MUST join a selected parent row to a selected CHILD ROW — nothing else. A list that is open with nothing selected MUST get NO line into it (no stub to the list's edge: it lands beside an arbitrary row and reads as a phantom selection). The chain ends at the deepest selected row; the unselected frontier's landing is the topic overview, not a connector.
- **must-keep-connectors-attached-when-covered**: The selection connectors MUST stay attached to the correct rows when lists are covered/peeking and across the cover/uncover slide (measured from the DOM, re-tracked through the transition).
- **must-keep-bar-for-standalone**: The standalone `TopicDetail` primitive MUST keep `selectionStyle="bar"` (the gold left-border); the dash/connector markers are a property of the hierarchical stack only.

### Topic overview — the automatic no-selection landing

- **must-show-topic-overview-at-unselected-frontier** (v1.13.0): Whenever the frontier list has NO selection, the detail pane MUST show the standard topic overview: a responsive card grid with ONE card per row of that list — the row's icon + label + its `description` when present — titled by the parent's selected row (else the level's title). Clicking a card MUST fire the level's own `onSelect` for that row (URL, breadcrumb, connectors follow as for a row click). This is a FRAME behavior: every hierarchical view gets it automatically, with no host wiring — including a leading (e.g. workspaces) level when IT is the unselected frontier.
- **must-hide-overview-once-selected** (v1.13.0): The overview exists ONLY in the no-selection state. The moment the frontier gains a selection the host's real detail (`children`) MUST show — cards MUST never render beside or instead of a selected topic's view.
- **may-opt-out-overview** (v1.13.0): A level whose unselected state has a REAL landing of its own (ResourceExplorer's searchable entity landing with New) MAY opt out via `TopicLevel.overview: false`; the host's `children` then render as before.
- **may-describe-topics** (v1.13.0): A `TopicDetailItem` MAY carry a `description` (one or two sentences) feeding its overview card; hosts SHOULD source it from the same store as the help popovers so card copy and help never drift. Items without one render icon + label only.
- **must-fit-overview-cards** (v1.14.0): An overview card MUST fit its contents — a long label with no break opportunities (a full reverse-domain identifier) MUST wrap across lines inside the card, the icon pinned to the first line, and MUST NOT overflow or clip at the card's edge.
- **may-render-overview-help** (v1.14.0): A level MAY set `TopicLevel.overviewHelp` (a string or nodes) to replace the card grid at ITS unselected frontier with a single centered help blurb (`TopicOverviewHelp`) — for a list of one KIND of thing, where a grid of near-identical cards is noise and the landing should instead explain what the items are and how to choose one. It MUST win over the card grid at that level and MUST be ignored when `overview` is `false`.
- **must-keep-children-mounted-under-overview** (v1.13.0): While the overview shows, the host's `children` MUST stay MOUNTED (hidden) beneath it. In the merged one-rail stack the deeper levels are PUBLISHED by components living in `children` (StackLevels); unmounting them unregisters the very frontier level the overview is for, and the stack oscillates between the two states (React max-update-depth).

### Narrow mode — the stack as a navigation controller

- **must-switch-to-narrow-when-only-a-detail-fits**: The frame MUST switch to the NARROW layout when only a details view can fit — the container is narrower than one topic list plus `minDetailWidth` — or when the browser is a phone (an iOS / Android phone user agent) at ANY width. Tablets and desktops are decided by width alone, so a narrow WINDOW behaves exactly like a phone and a wide one does not. The mode MUST be resolved before paint (no flash of the wide layout), and `layoutMode="wide" | "narrow"` MUST force one.
- **must-show-one-full-width-pane**: In narrow mode each topic list and the detail MUST be a FULL-WIDTH pane, and exactly ONE of them is visible: the frontier list while it is still being chosen from, the detail once every level is selected. A landing placeholder MUST NOT be shown in place of the list being chosen from. Peeks, cover toggles, the auto-hide toggle, the hover reveal and drag-resize MUST NOT be rendered — they spend room that does not exist.
- **must-push-and-pop-like-a-navigation-controller**: Selecting MUST PUSH the next pane in from the right edge (animated, subject to **must-respect-reduced-motion**); the pane behind it MUST parallax and be `inert` + `aria-hidden`, so only the visible pane is reachable by pointer, keyboard or AT. A pane that is being pushed MUST animate in rather than appear in place.
- **must-fill-the-pane**: A narrow pane IS the screen, so it MUST paint the whole of it: the list inside it MUST FILL the pane rather than size to its rows. A content-height rail leaves everything under the last row transparent — the parallaxed pane behind it shows through, and the page behind that — which reads as a half-drawn screen. (The wide stack's lists are stretched grid cells and correctly size to their column; this is the flex pane's own responsibility.) A full-width pane also MUST NOT draw the rail's trailing border: it separates nothing at the edge of the screen.
- **must-slide-panes-ease-in-out**: EVERY pane — the topic lists AND the detail — MUST travel on one transition: a horizontal slide, **ease-in-out**, so the push and the pop each accelerate out of rest and settle back into it rather than snapping to a stop. Both directions animate: disclosing (push, in from the right) and undisclosing (pop, back out to the right). The animation MUST survive the REMOUNT the selection causes — the slide's origin is the pane the stack was last painted at, held per surface (**must-keep-view-state-across-a-selection**), because a pane that mounts already at its final transform has nothing to animate FROM and the push silently degrades to a jump. Under **must-respect-reduced-motion** the transition is dropped entirely: the panes cut to their new places, identical layout, no travel.
- **must-offer-back-in-narrow**: Every narrow pane except the root MUST carry a top-left **Back** that POPS one pane — clearing exactly the deepest SELECTED level via the same `onClear` the breadcrumb and the wide Back use, so **must-guard-unsaved-on-exit** applies identically. Repeated Back MUST walk up to the root, and a popped pane MUST animate OUT to the right rather than vanish.
- **must-keep-selection-across-modes**: Switching between wide and narrow (a resize) MUST preserve the selection exactly — the mode is a rendering of the same stack, never a navigation.
- **must-mark-narrow-selection-with-bar**: In narrow mode a list's selected row MUST use the primitive's gold `selectionStyle="bar"`: the dash/connector markers need a parent list on screen to connect FROM, and narrow mode never has one.
- **must-show-row-disclosure-chevron**: In narrow mode every selectable row MUST carry a trailing chevron (›) marking that picking it pushes another pane in — a full-width pane has no peeking sibling column left to hint at that, so the row itself must say so. A `disabled` row MUST NOT show it (it has nowhere to go). The chevron is narrow-only: the wide/covered stack MUST NOT render it — the selection connector line already shows what a choice leads to there.

### Cascading view — motion, ground and the selection chain

Rules specific to `disclosureStyle="cascading"` (the `HierarchicalMenuDetail` vertical menu cascade).
Everything above still applies; these pin the parts that are unique to a nested-menu shape.

**These rules are EXECUTABLE.** Each id below is a test name in
`packages/ui/src/__tests__/cascadeRules.test.ts` (pure rules) or `cascadeInteraction.test.ts` (the
DOM wiring), and the decisions themselves live as pure functions in `packages/ui/src/blocks/
cascade-rules.ts` rather than as expressions inside the 3000-line component. That is deliberate and
it is the point of this section: every rule here was reported, fixed, and then silently REGRESSED by
a later fix, because nothing named it and nothing could test it. **Before changing the cascade, run
`pnpm --filter @agentic-toolkit/ui test`; if one of these fails, the fix is not to update the
assertion — someone has just re-broken a reported bug.**

The cascade's GEOMETRY (the rect unions, the connector paths, the measured ground) is not covered by
those tests and cannot be: jsdom has no layout engine, so `getBoundingClientRect` is all zeros. That
gap is exactly why the geometry-dependent rules had to become pure decisions taking measurements as
arguments — the measuring stays in the component, the deciding is tested.

- **must-draw-one-chain-line**: The selection chain MUST read as ONE line wherever it is drawn. Three
  things draw it — a selected row's gold left bar, the gold rail down an unchosen submenu's left
  edge, and the elbow connectors joining a selected parent row to its child — and they MUST share a
  width (`CHAIN_STROKE_PX`) and a colour token (`apt-gold`). The width is **2**, and it is 2 because
  `topic-detail`'s `border-l-2` row bar is the drawing that has always shipped: the others match IT,
  never the reverse. Matching the WIDTH alone is NOT sufficient and MUST NOT be treated as the fix:
  an anti-aliased SVG stroke spreads its gold across an extra device pixel at partial alpha, so at
  the same nominal width it still reads dimmer and softer than the CSS borders beside it and the pair
  looks like two different golds. The connector overlay MUST therefore render `crispEdges` (every
  path is axis-aligned, so snapping to the pixel grid costs nothing), and the width MUST stay a whole
  number of pixels.
- **must-bounce-the-entrance**: A submenu disclosed by choosing a row MUST grow out of that row and
  BOUNCE into rest, each swing overshooting less than the last: **+10, −10, +5, −5, 0** percentage
  points around its resting size. Size and travel bounce TOGETHER and by the same figures — the
  transform origin sits on the chosen row's centre, so one `scale` track makes the box proportionally
  bigger and proportionally further from that row in one number. It MUST be a keyframe list, not a
  cubic-bezier: a bezier overshoots once and cannot reverse four times. The duration MUST leave every
  segment at least two frames at 60Hz (which is why it is 460ms, not 300 — five segments in 300ms
  leaves the last two undrawable, making the spec decorative).
- **must-not-wiggle-the-exit**: The exit MUST NOT wiggle — it shrinks straight back into the row that
  opened it, with no anticipatory swell. The bounce belongs to the GROW only. Specifically the exit
  curve MUST NOT carry a negative control point: the exit was once the entrance's exact mirror, and
  mirroring an overshoot produces an UNDERSHOOT at the start, which is the wiggle. Both control
  points' `y` MUST stay within [0, 1].
- **must-animate-every-menu-closure**: EVERY click that tears menus down MUST collapse them
  progressively — never vanish them in one frame. That includes selecting a **different** row in a
  level that already has a selection (switching workspace destroys exactly the same menus a re-click
  does), not only the re-click-to-clear. The only click that MUST NOT collapse is a forward drill
  into a level with nothing selected: nothing is open below it to take away. The real navigation
  (`onSelect`/`onClear`) runs as the animation's callback, so a broken animation MUST NOT be able to
  swallow the click.
- **must-collapse-inward**: When a parent is unselected/replaced, its descendant menus MUST collapse
  in ORDER, deepest first, each a beat after the one it opened, so the stack telescopes back toward
  the root. Deepest-first is what makes it read as inward: a menu retracts into its parent only once
  its own child is gone, so no menu is ever left floating with its opener already gone. Each menu
  shrinks into ITS OWN parent's chosen row, and the selection connectors MUST retract WITH them
  (the entrance run backwards) rather than hanging at full length until the end.
- **must-hold-the-ground-under-the-pointer**: The GROUND — the root list's right edge, which is also
  the detail's left edge — MUST NOT move while the pointer is inside the menus. It is load-bearing:
  the root's width and the detail's position both hang off it, so moving it mid-gesture shoves the UI
  around under the pointer. Selecting a row, unselecting one, and opening or closing submenus MUST
  ALL leave it exactly where it is; it may settle only once the pointer has left the menu region (the
  union of the root list and every open menu — measured from the DOM, so a hover reveal fanning out
  over the detail still counts as being in the menus). The rule MUST be expressed in terms of the
  POINTER and nothing else. It once read "no hover reveal is open" as a proxy for "the submenus are
  collapsed", and a reveal only exists while some list is COVERED — so the day `autoHideTopics` went
  false nothing was ever covered, the proxy pinned itself to "always free to move", and the ground
  tracked every click. A rule about the pointer MUST ask about the pointer.
  Both halves of the latch — the held width AND whether the pointer is in the menus — MUST survive a
  remount (**must-keep-view-state-across-a-selection**): choosing a row IS the route-param change that
  remounts the stack, so component state would report "the pointer left" on precisely the frame the
  click lands, free the ground and let it jump. The pointer has not moved; only the component has.
- **must-collapse-from-one-pointer-authority**: Whether the menus are held open MUST be decided by a
  SINGLE authority — "is the pointer inside the menu region?" — read FRESH from the DOM at pointer-event
  time, and that same authority MUST govern BOTH the reveal's held-state AND the ground latch. It is the
  ONLY thing (besides an explicit `«/»` toggle, and the FINAL CHOICE below) that may close a reveal. An
  INTERMEDIATE select — one that leaves the user still choosing — MUST only ever RE-ROOT the reveal at
  the list clicked in — never close it; a remount, a width change and a selection
  MUST NOT close it. Equivalently: the only events that close a reveal are "the pointer left the
  menus", "an explicit disclosure toggle" and — in auto-collapse mode only — "the FINAL CHOICE"
  (v1.15.0, see must-auto-collapse-menus-on-final-choice: the click that completes the path, where
  settling IS the requested action); no other click closes anything. This rule exists because the
  hold used to be computed two ways at once, both from stale sources — `hoverIndex >= 0` (which trails
  width pressure, measured a beat after the click) tested against an effect-measured rect (a render
  behind) — on exactly the remount a click triggers; the result was untraceable and regressed
  repeatedly. Reading the region fresh means only a real pointer move outside what is painted NOW can
  collapse anything: if the pointer does not move after a click, nothing collapses — the final-choice
  auto-collapse (below) being the one specified exception. And when NOTHING is measurable — the
  remount a select causes has a window where the old container is detached and the new one has not
  painted, and a real mouse always moves in it — there is NO evidence the pointer left: the last
  answer stands (v1.15.2, `pointerInMenusAfterMove`). Treating "nothing measurable" as "outside"
  is how every pointer-keyed hold kept dying under a real mouse while surviving synthetic clicks.
  This subsumes the
  covered stack's blind-root document watcher — a reveal that revealed nothing is still an open root,
  and it too clears the moment the pointer is proven outside.
- **must-hold-the-detail-until-the-final-choice** (v1.15.0): A select is the FINAL CHOICE when the chosen row does not lead to another
  topic list — the click that completes the path, whether it lands in the top (root) menu or any
  submenu. Until a final choice is made, the detail pane MUST NOT change: an INTERMEDIATE select (one
  that discloses another choosing list) leaves the detail showing exactly what it showed before the
  click — the last final choice's content, or the landing/overview the gesture began over — never the
  newly selected topic's overview, a landing placeholder, or a blank. The next thing the detail shows
  is the new final choice's detail: ONE swap, old content → new content. For the cascade this
  overrides must-show-topic-overview-at-unselected-frontier while the user is choosing (a deep link
  that lands on an unselected frontier still shows the overview — there is no held detail and no
  pointer) and the "showing the chosen item's detail" clause of must-pure-select-from-reveal for
  intermediate selects. The hold is a DISPLAY hold, not a deferred navigation: the intermediate
  select still fires the level's `onSelect`, still clears the deeper selections and still moves the
  URL — so must-guard-unsaved-on-exit still runs on the select that clears a dirty leaf, and the held
  content MUST survive the remount that select causes (must-keep-view-state-across-a-selection: held
  per surface, exactly like the ground). Whether a row "leads to another topic list" is the HOST's
  answer, delivered as a render — and a merged stack delivers it a commit LATE (its deeper levels are
  published from components living in `children`, in effects), so a single settled-looking render
  MUST NOT count as the final choice: the release requires CONSECUTIVE settled renders
  (`planChoiceSettle`'s arm-then-confirm), giving the host one commit to disclose the deeper list.
  Abandoning the menus without completing the path (the pointer leaves) leaves the held detail in
  place — the detail changes when a final choice replaces it, and not before.
- **must-auto-collapse-menus-on-final-choice** (v1.15.0): When the final choice is made in auto-collapse mode (`autoHideTopics` on),
  the menus MUST auto-collapse on the click itself: the open submenus collapse progressively
  (must-animate-every-menu-closure, must-collapse-inward) as the final choice's detail shows, WITHOUT
  waiting for the pointer to leave the menu region. This is the ONE click that closes the menus — the
  carve-out named in must-collapse-from-one-pointer-authority — and it closes them for the same
  reason the disclosure toggles settle the stack (must-apply-disclosure-toggles-immediately): the
  user has finished choosing, so settling IS the requested action, and menus held open under a
  pointer that is done with them bury the detail the click just asked for. The pointer has not moved,
  so nothing may re-open the menus until it next ENTERS a covered peek or menu — and entering IS
  how a settled cascade re-opens: the disclose trigger fires only on the outside→inside crossing of
  its approach lane, and a COVERED column's own pointer-enter opens its branch reveal (v1.15.2),
  so approaching a covered list from over the menus discloses it before any row has to be clicked
  (without that, a covered root's rows sat unreachable under the child overdrawing them and could
  never be re-clicked to unselect). An INTERMEDIATE
  select still collapses nothing, and with auto-collapse OFF no select collapses anything — the menus
  stay exactly as the user arranged them (the workspace stacks' standing rule, via their
  `autoHideTopics={false}`).
- **must-not-move-the-menus-on-an-intermediate-select** (v1.15.1): An INTERMEDIATE select MUST NOT
  move, resize or re-cover ANY list on screen: the clicked list stays exactly where it is and the
  new choosing list simply appears beside it (growing out of the chosen row per
  must-bounce-the-entrance). The stay-open MUST be STRUCTURAL, not a pointer-reveal side effect.
  The failure this forbids: the select advances the frontier, auto-hide covers every list left of
  the frontier, so the moment the new list appeared the clicked list fell behind the frontier and
  covered itself out from under the pointer — with only the hover-branch reveal
  (must-root-reveal-on-covering-select) to hold it open, and that is pointer-state racing the
  remount the select itself causes; every lost race was a menu visibly snapping to its peek on the
  click (the regression that kept coming back). The covering is therefore computed against a
  FROZEN frontier held in the surface's remount-surviving memory: a rail click RATCHETS it down to
  the clicked list's index (`ratchetFrozenFrontier` — lists the user had covered stay covered,
  must-not-expand-parents-on-select), a clear/✕ that RETREATS the real frontier is followed down
  (`coverFrontierWhileChoosing`), and the freeze advances again only at the standing settle points:
  the pointer leaving the menus, or the final choice (whose settle writes the frozen frontier
  forward so must-auto-collapse-menus-on-final-choice still lands on the click). A rail click is
  also recorded as pointer-in-the-menus EVIDENCE in that same memory — a click can only happen
  inside the menus, so every hold that keys off the pointer (the ground, the covering) survives the
  remount even when no pointermove was ever observed (a fresh surface, synthetic input).
- **must-draw-every-detection-frame**: With the "Show Mouse Detection Frames" debug switch on, EVERY
  region MUST be drawn — the menu region (blue) that is the single authority above, and the disclose
  (green) trigger rect — whether or not it is currently ARMED. A disarmed region MUST render dashed and
  labelled, not omitted. Measuring a rect and arming it are separate questions and MUST stay separate in
  the code: "no rect on screen" and "the rect is disarmed, so nothing can trigger it" look identical
  when the answer is to draw nothing, and the second one is the diagnosis. Omitting them is how the
  switch came to look broken — with nothing covered there was nothing to disclose, so the trigger rect
  was null and the switch drew nothing at all. (The blue region is ONE frame now, not the former
  separate "collapse" and "ground held" rects — the unification of must-collapse-from-one-pointer
  -authority made visible.)

### General

- **must-respect-reduced-motion**: All animations (disclosure, resize snap, auto-disclosure, the narrow push/pop) MUST be disabled when the user's "reduce animation" preference is set. **SUSPENDED** for both hierarchical views by a standing instruction from the block's owner to ignore `prefers-reduced-motion` until further notice — HTDV's `motion-reduce:` gates were removed so the two views cannot disagree once one flag picks between them. Restore both together when the instruction is lifted. (This is not a claim about anyone's OS configuration.)
- **must-source-help-from-config**: All help content (the breadcrumb help button and every detail-pane help icon) MUST come from a single unified help config in `websites/site-config`, keyed by the route to the detail page + the ui element.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ workspace ▸ feature ▸ entity ▸ topic ▸ leaf            [?] help (right)    │  ← one full-width breadcrumb
├─────────┬──────────┬──────────┬──────────┬────────────────────────────────┤
│ Wksp  + │ Feat     │ Ent    + │ Topic    │ ‹ Back  Delete │ Cancel Save [?]│  ← titled header: title left, New "+" right
│ ◻ Wksp  │ ◻ Feat 1 │ ◻ Ent A  │ ◻ Topic1 │ ┌────────────────────────────┐ │
│ ◻ Wksp2 │ ◻ Feat 2 │ ◻ Ent B  │ ◻ Topic2 │ │  left-justified content     │ │
│         │ ◻ …      │          │ ◻ …      │ │  fills vertically; min-width│ │
│  «      │  «       │  «       │  «       │ │  horizontal scroll if tiny  │ │
└─────────┴──────────┴──────────┴──────────┴─┴────────────────────────────┴─┘
  fixed-width, resizable, disclosable topic lists   flexible, min-width detail
  (narrower → leftmost lists COVER/slide OFF-SCREEN; hover a peek to open that list AND its children)
```

**Narrow mode** (only a detail fits, or a phone) — the same stack as a navigation controller:

```
┌────────────────────┐   select    ┌────────────────────┐   select    ┌────────────────────┐
│ wksp ▸ feat        │  ────────▶  │ wksp ▸ feat ▸ ent  │  ────────▶  │ … ▸ ent ▸ topic    │  ← breadcrumb still spans the top
├────────────────────┤             ├────────────────────┤             ├────────────────────┤
│ Entities        +  │   ◀────     │ Topics          +  │   ◀────     │ ‹  detail          │
│ ◻ Ent A            │    Back     │ ‹ ◻ Topic 1        │    Back     │                    │
│ ◻ Ent B            │             │   ◻ Topic 2        │             │  full width        │
└────────────────────┘             └────────────────────┘             └────────────────────┘
   ONE full-width pane: the frontier list, then the detail. Push in from the right, Back pops out.
```

- **Top edges** of every rail + the detail pane align on one row under the breadcrumb;
  **bottom edges** align (all fill to the container height). The first row of each rail aligns via the
  uniform titled header (no reserved leading slot); the first topic sits directly under the header.
- **Rails**: `bg-apt-nav`, fixed width ≈ widest topic + padding, right divider, a titled **header** with
  a disclosure/cover `«`/`»` control (left) + a left-aligned `title` + a right-justified New **`+`**
  (`onNew`) and a divider beneath. Undisclosed/covered = a `~2.25rem` / 40px icon strip; in the stack
  selection is the **marker** (root dash + parent→child connectors), not a per-rail bar. Hovering a
  covered rail reveals the whole BRANCH — that rail AND its children, full rows + headers, chained side
  by side above the detail. In **narrow** mode a rail is instead the full-width pane (bar selection, a
  top-left Back, no cover/resize affordances).
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
| T11 | may-offer-new-topic-button, must-create-in-modal | click a rail header's `+` | a MODAL opens (the `+`'s accessible name is `newLabel`); the pane behind it still shows what was open and no level's selection changed; on save the new item is selected and ITS detail opens; on cancel nothing changed |
| T11a | must-create-in-modal | open the create modal, type into it, press Esc / click the backdrop | the draft is not discarded — the guarded close prompts Save / Discard / keep editing |
| T11b | must-scope-create-modal-to-placement | open "New Work Item" | it asks for title + description + status (what PLACES the record), not the full item editor; assignee/priority/dates/parent live in the detail that opens on save |
| T12 | must-offer-disclosure-toggle, must-render-undisclosed-icon-strip | click a rail's `«` | rail animates to an icon strip; the header (with its `+`) collapses; active icon keeps the marker |
| T13 | must-resize-by-drag, must-snap-undisclosed-when-narrow | drag a rail below 1/3 width | rail animates to undisclosed |
| T14 | must-snap-full-when-wide | drag a rail wider than content+padding | rail animates back to full content width |
| T15 | must-drill-off-screen-when-cramped, must-single-disclosure-controller | narrow the window past the detail min-width with a leaf selected | leftmost lists slide off-screen (general→specific) until the detail fits at min |
| T16 | must-disclose-when-room | widen the window | hidden lists slide back on (specific→general) as space allows |
| T17 | must-not-redisclose-user-collapsed | user collapses list 2, then widen window | list 2 stays icon-collapsed; others may re-disclose |
| T18 | must-respect-reduced-motion | `prefers-reduced-motion: reduce` | disclosure / resize / drill-down apply with no animation |
| T19 | must-own-unselection | click the already-selected entity/topic/list row | that level clears + every deeper pane hides (no consumer toggle logic) |
| T20 | must-not-auto-select | land on `/<slug>/ecosystems` | the entity list shows nothing selected; selecting one shows the topics list with nothing selected (no resume, no first-topic) |
| T20a | may-default-select-a-level | a level sets `defaultSelectedId` (Work Items → `list`); pick its parent topic | the list appears with that row selected, via the level's own `onSelect` (URL segment, breadcrumb + detail all follow); re-clicking the row clears it and it STAYS clear; leaving the parent topic and re-entering selects it again |
| T21 | must-show-back-when-drilled, must-back-clears-one-level | drill in at phone width, press Back | Back appears top-left of the leftmost-visible pane; pressing it clears the deepest selected level + re-discloses one parent |
| T22 | must-guard-unsaved-on-exit | edit the leaf editor (dirty), then press Back | a Save / Discard / Cancel modal opens; Discard proceeds, Cancel keeps editing, Save persists then proceeds |
| T23 | must-not-hide-frontier-choosing-list | narrow `/<slug>/home` (workspace selected, no feature) | the features list (the frontier) stays visible; only the workspaces list may slide off |
| T24 | must-be-one-stack | open a dismantled topic (Applications) | the apps are a published list level (not an in-pane sublist); the editor is the leaf detail |
| T24a | may-display-content-as-a-list | open Work Items ▸ List (a list-with-details display) | the rows render, a row selection fills the details pane and edits in place — and the STACK does not move: no level's selection changed, no new rail appeared, the URL is unchanged |
| T25 | must-default-to-covered, must-peek-covered-parent | render ≥3 covered levels, deepest selected | parents peek as ~40px icon strips under the child; child + detail take the room |
| T26 | must-reveal-covered-branch-on-hover, must-open-branch-in-place | hover a covered list's peek (3 levels, both parents covered) | the hovered list AND every list below it open to full width, chained end to end from where the hovered list sat (lefts `0 / 240 / 480`), lifted above the detail — which does not move |
| T26a | must-keep-branch-open-while-inside-it | hover the covered root, then move the pointer into its revealed CHILD | the branch stays open (this is the walk the reveal exists for); moving the pointer out of every member closes it back to exactly the peeks it came from |
| T26b | must-keep-branch-open-while-inside-it | hover the covered root, then move the pointer into a DIFFERENT covered list | the branch re-roots there: the new list + its children open, the lists to its left return to their peeks |
| T26c | must-float-branch-as-an-opaque-card | hover a covered list in the MIDDLE of the stack (a peek to its left, the detail to its right) | the open branch shadows on BOTH outer edges — leading (over the peek behind it) and trailing (over the detail) — and no detail text shows through it; the members between them carry neither shadow |
| T26d | must-draw-connectors-over-the-revealed-branch | hover a covered list with a selection chain through it | the gold connectors remain visible ON TOP of the revealed lists (the overlay outranks the branch's lift), not hidden behind them |
| T27 | must-pure-select-from-reveal | click a row in a revealed list | that row becomes selected, deeper lists clear, its detail shows; clicking the already-selected row does nothing |
| T28 | must-close-branch-only-on-pointer-exit | hover a covered list to reveal the branch, click a row, then walk right into the child list it re-populated and click one of ITS rows | both selections land while the branch stays open under the pointer (the child list joins the open branch); the branch collapses only once the pointer leaves it, animating to the layout the new selection implies |
| T28a | must-root-reveal-on-covering-select | auto-hide ON, one disclosed list, click a row whose selection pushes a new (unselected) child list | the clicked list stays open in place (covered in layout, held by the reveal) and the new list slides out beside it OVER the detail; moving the pointer off the branch settles it — the parent to its 40px peek, the new list into the flow |
| T28b | must-root-reveal-on-covering-select | auto-hide ON, click a row in the LAST level (the selection completes the path) | no reveal engages: the stack lays out at rest (parents peek, the clicked list disclosed) with no lift and no floating-card shadow over the detail |
| T28c | must-root-reveal-on-covering-select | deep-link a URL whose frontier list is unselected (no click) | the parent renders covered (40px peek) with the frontier in the flow beside it — no reveal, since no pointer is in the stack |
| T29 | may-title-each-list | render levels with `title` | each list shows its left-aligned title + a divider above the first row |
| T30 | must-mark-selection-without-bar, must-keep-connectors-attached-when-covered | select root + child in the covered stack | no gold bar; the root selected row has a leading dash; a gold elbow connects the selected parent row to the selected child row, staying attached when the parent is covered |
| T31 | must-keep-bar-for-standalone | render a standalone `TopicDetail` with a selection | the selected row shows the classic gold left-bar (no dash/connector) |
| T32 | must-allow-manual-cover | click a list's `»` cover toggle, then resize | the list stays covered (icon-strip peek) across the resize |
| T33 | must-default-to-auto-hide | render 3 levels, deepest selected, at 1440 | only the leaf-most list is disclosed; both parents peek even though there is room for them |
| T34 | must-offer-auto-hide-toggle | click the root list header's toggle | it flips to the "off" state and every list discloses; clicking again re-hides every parent |
| T35 | must-toggle-all-on-modifier-click | ⌘/Ctrl-click a `«` | EVERY list covers to its peek (not just the clicked one's parent); ⌘/Ctrl-click a `»` uncovers them all |
| T36 | must-keep-detail-at-minimum-while-lists-yield, must-shift-off-screen-by-whole-lists | narrow the container to just under (peeks + `minDetailWidth`) with a leaf selected | the detail sits at EXACTLY `minDetailWidth`; the leftmost list is `inert` at `left = −(its width)`; the shift equals that width exactly (not the overflow amount) |
| T37 | must-land-structure-changes-in-place | select a topic where the detail's left edge moves | the detail is at its final `left`/`width` on the FIRST frame after the click (no 300ms slide) |
| T38 | must-animate-width-changes | click a `«`/`»` where the detail's left edge moves | the detail's `left` is still mid-flight one frame later (it eases) |
| T39 | must-reverse-on-grow | with auto-hide OFF, narrow until lists hide/drill off, then widen back | the lists slide back on (specific → general) and re-disclose; with auto-hide ON they slide back on but stay hidden |
| T40 | must-switch-to-narrow-when-only-a-detail-fits, must-keep-selection-across-modes | with a leaf selected, narrow the window past (one list + `minDetailWidth`) | the frame switches to the navigation stack — the detail is the sole full-width pane — with the SAME selection; widening restores the covered columns unchanged |
| T41 | must-show-one-full-width-pane | narrow, workspace selected, feature not | the FEATURES list (the frontier) is the whole view at full width — not a landing pane telling you to pick one; the workspaces pane is `inert` + `aria-hidden` behind it, and no peek / cover toggle / auto-hide toggle is rendered |
| T42 | must-push-and-pop-like-a-navigation-controller | narrow, select a topic | the detail pane animates IN from the right edge (it is still mid-flight one frame after the click, not already in place) and the list behind it parallaxes |
| T43 | must-offer-back-in-narrow, must-guard-unsaved-on-exit | narrow, detail open, press Back | the deepest selected level is cleared, the detail animates OUT to the right and the list you chose from is the visible pane; a dirty leaf raises Save / Discard / Cancel first. The ROOT pane has no Back |
| T44 | must-switch-to-narrow-when-only-a-detail-fits | load on an iPhone/Android phone UA at a viewport wide enough for the wide layout | the narrow layout is used anyway (a phone has no pointer for peeks / reveal / drag) |
| T45 | must-keep-view-state-across-a-selection | turn auto-hide OFF, then pick another row in the root list (a route change, so the subtree remounts) | the lists stay disclosed and the toggle stays off — the user's click does not silently reset the view they just arranged |
| T46 | must-keep-view-state-across-a-selection, must-close-branch-only-on-pointer-exit | hover a covered list to open its branch, then click a row inside it | the branch is still open after the remount (the pointer never left it), and closes only when the pointer leaves |
| T47 | must-keep-view-state-across-a-selection, may-default-select-a-level | on a level with a `defaultSelectedId`, clear the auto-selected row (Back, or re-click) | it STAYS cleared — the default does not re-fire on the remount the clear caused |
| T48 | must-grow-the-branch-walking-outward | hover the middle peek to open its branch, then move the pointer LEFT into the peek beside it | the shallower list joins the cascade as its new root; every list that was open stays open, pushed right |
| T49 | must-portal-modals-out-of-the-stack | narrow mode, nothing selected: open a level's `+` create dialog and type into it | the dialog is a child of `<body>` (not of the inert detail pane), the field accepts input, and Save enables |
| T52 | must-fill-the-pane | narrow, a list with fewer rows than the screen is tall | the list's background covers the full pane (its height equals the pane's); nothing behind it shows through under the last row, and no border runs down the screen edge |
| T50 | must-slide-panes-ease-in-out | narrow, in the real app (so the selection remounts the subtree): select a row, sampling the incoming pane's x each frame | it travels through intermediate positions from the right edge to 0 — not two samples (start, end) — and the offsets ease in and out (small deltas at both ends, largest in the middle). Back samples the same slide in reverse |
| T51 | must-slide-panes-ease-in-out, must-respect-reduced-motion | narrow, `prefers-reduced-motion: reduce`, select a row | the panes are at their new places on the first frame: no travel, same layout |
| T53 | must-show-row-disclosure-chevron | narrow, a pane with an enabled row and a `disabled` row | the enabled row carries a trailing chevron, the disabled one does not; the same rows in the WIDE covered stack carry no chevron at all |
| T54 | must-apply-disclosure-toggles-immediately | hover a covered peek so the reveal opens, then (without moving the pointer out) click a header's `«`/`»`, and separately the root header's auto-hide toggle | the reveal DROPS on the click and the stack settles to the new pin / mode state immediately — the layout visibly changes on the click itself, not later when the pointer happens to leave |
| T55 | must-fit-overview-cards | a frontier list whose rows carry long unbreakable labels (full reverse-domain ids), narrow the pane | each label wraps across lines inside its card (icon on the first line); no card overflows or clips its content at the edge |
| T56 | may-render-overview-help | a level with `overviewHelp` set, at its unselected frontier | the detail shows ONE centered help blurb (not the card grid); with `overview: false` the blurb is suppressed and the host's `children` show |
| T57 | must-hold-the-detail-until-the-final-choice | cascade: a final choice's detail is showing; click a topic (top menu or submenu) that discloses another topic list | the submenu opens and the detail pane is UNCHANGED — still the previous detail, not the new topic's overview or a landing |
| T58 | must-hold-the-detail-until-the-final-choice | continue from T57: click a row that leads to no further topic list (the final choice) | the detail changes ONCE, straight to the final choice's detail — no intermediate overview/landing/blank ever showed during the walk |
| T59 | must-auto-collapse-menus-on-final-choice | cascade, auto-collapse ON: make a final choice and leave the pointer where it clicked | the open menus collapse inward (animated) on the click itself — before the pointer leaves the menu region — and the final choice's detail shows |
| T60 | must-auto-collapse-menus-on-final-choice | cascade, auto-collapse OFF: make a final choice with submenus open | only the detail swaps; every open menu stays exactly as arranged (no select collapses anything) |
| T61 | must-not-move-the-menus-on-an-intermediate-select | cascade, auto-collapse ON: click a row in a disclosed list whose select discloses a submenu (the frontier advances) | the clicked list does not move or re-cover — the submenu appears beside it at the disclosed advance; every list already on screen stays exactly where it was, with no pointer movement required to hold it |

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
  detail pane drops below its min width; below that the frame switches to **narrow** mode
  (one full-width pane at a time) rather than crushing or scrolling the detail.
- **A revealed branch wider than the container:** the branch opens in place and is clipped
  by the frame's right edge — the hovered list and the children that fit are shown. It is a
  transient hover, not a layout: the fit rules own the persistent layout, and the branch
  closes back into it.
- **Single level:** with one topic list the view is just `[rail] | [detail]` — still a
  valid (degenerate) hierarchy with the same chrome.

## Platform Notes

- **Wide / narrow + the branch reveal (2026-07-11).** The frame owns ONE measured row (`useContainerWidth`
  on the wrapper around the stacks, a `useLayoutEffect` + ResizeObserver so the first measurement lands
  pre-paint) and passes `containerW` down — so the mode decision and the covered stack's fit math read the
  same number and there is still a single disclosure controller. `narrow = layoutMode === "narrow" ||
  (auto && (phone || containerW < minDetailPx + FULL_RAIL))`; `usePhoneUserAgent` reads the UA AFTER mount
  (the server has none — branching the first render on it would be a hydration mismatch) and matches
  `/iPhone|iPod/` or Android + `Mobile`, so tablets/desktops (and iPadOS, which reports a desktop UA) are
  decided by width alone. **`NarrowStack`** renders a pane per level PLUS the detail, all
  `absolute inset-0`, positioned by `translateX`: the top pane at `0`, the ones behind it at `-30%`
  (the iOS parallax) + `inert`/`aria-hidden`, the ones ahead at `100%`. Panes are rendered for EVERY
  level (not just the current path) so one exists off-screen to slide IN, and a popped one slides OUT
  instead of unmounting; `anim` (the position the panes are rendered at) lags `top` by one
  `requestAnimationFrame`, because a pane that MOUNTS at its final position cannot transition — it must be
  painted off-screen once, then moved. Back = `levels[deepestSelected].onClear()` through `attemptExit`,
  the same path as the breadcrumb, so the unsaved guard is shared, not re-implemented.
  **The branch reveal** in `CoveredStack`: `hoverId` names the reveal's ROOT and the group is
  `i >= hoverIndex` — revealed members take `railWidth` and chain from `left[hoverIndex]`
  (`revealLeft[i] = revealLeft[i-1] + railWidth(i-1)`), lifted to `z 50 + i` above the detail. Closing is a
  property of the GROUP: `onPointerLeave` reads `e.relatedTarget`, finds its `[data-htd-col]` ancestor and
  KEEPS the branch open when that column is still in the group — a per-list leave handler would collapse
  the branch the moment the pointer crossed into one of its own children. The z-lift trails on close
  (`zLiftId`) so the wipe-shut happens over the detail rather than behind it.
- **Auto-hide + the fit rules (2026-07-11).** The frame OWNS the disclosure intent — `autoHide`
  (seeded from `autoHideTopics`, default true) and `pins: Record<levelId, boolean>` — and passes both
  to whichever stack renders, so the two layouts share one contract and differ only in how a hidden
  list is DRAWN (a 40px peek vs an icon strip). `toggleAutoHide` flips the flag and clears `pins`
  (a clean reset). Each stack resolves `pinnedOrAutoHidden(i) = pins[id] ?? (autoHide && i < last)`,
  then adds width pressure on top — pressure only ever ADDS a hide, so a pin shut is never disclosed.
  The `«`/`»` handlers read `e.metaKey || e.ctrlKey` to write EVERY level's pin instead of one.
  Phase 2 is quantised: `while (hidden < coverable && widthFrom(hidden) > containerW) { offshift +=
  widthOf(hidden); hidden++ }`, so the stack shifts by whole lists and a hidden column is `inert` +
  `aria-hidden` + `pointer-events-none` (mounted, so it slides back in on grow).
  `useInPlaceOnStructureChange(structureSignature(rendered))` returns true for the ONE render after a
  level count / selection change and drops the `transition-[left,width]` classes for that commit, so
  choosing a topic lands the detail in place; the bump re-render restores the transitions against
  already-painted geometry, so nothing moves. Width-driven changes never touch that signature and keep
  animating.
- **React / Web (TypeScript).** Enclosing frame:
  `websites/shared/ui/src/blocks/hierarchical-topic-detail.tsx`
  (`HierarchicalTopicDetail`, props `levels: TopicLevel[]`, `disclosureStyle?: "covered" |
  "minimized"` (default `covered`), `autoHideTopics?: boolean` (default `true`), `layoutMode?: "auto" |
  "wide" | "narrow"` (default `auto`), `showBreadcrumb`,
  `rootLabel`, `trailingCrumbs`, `help`,
  `minDetailWidth`, `exitGuard: PaneExitGuard`, `manualCollapse`, `children`). It dispatches to a
  `NarrowStack` (full-width panes, `translateX` push/pop) when only a detail fits, else a
  `CoveredStack` (absolute, overlapping, `COVERED_PEEK` = 40px) or a `MinimizedStack` (grid columns);
  in the wide styles it renders each level's `TopicRail` **and** the detail
  `<section key="__detail__">` as **flat sibling grid columns** (one
  `grid-template-columns` CSS var) — so the leaf has a stable slot (no remount) and ONE
  ResizeObserver drives the whole row. Rail primitive: `topic-detail.tsx` (`TopicRail`
  extracted from `TopicDetail`; the `New …` create affordance is a header `+` from `onNew` / `newLabel`
  / `newActive`; `railSlot: RailSlot` remains a `ReactNode | (collapsed) => ReactNode` render-prop for a
  standalone `TopicDetail`'s custom leading row — e.g. FocusedTopicDetail's PopupMenu — rendered only
  when supplied; optional `backSlot` for the drill-down Back; per-rail drag handle with
  snap-to-collapse/full; animated via `md:transition-[grid-template-columns]`).
  **Covered style:** a covered list's wrapper is `overflow-hidden` clipped to a 40px peek (its rows are
  always FULL, so only the leading icon shows). Hovering it opens the whole BRANCH — that list and every
  list below it — via an animated width **wipe** + a `left` chain (`CoveredStack`'s `hoverId` names the
  branch's root; members take `railWidth` and chain from the hovered list's own left edge), lifted above
  the detail with a drop-shadow off the branch's trailing edge; the z-lift **lingers** (`zLiftId` trails
  `hoverId`) so the wipe-shut happens over the detail, a row-select drops the reveal, and the close is
  decided from the leave event's `relatedTarget` so the branch survives the pointer walking into its own
  children — no portal copy, pointer-driven only (no focus reveal). **Selection markers:** the shared `useSelectionConnectors` hook + `SelectionConnectorOverlay`
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
- **Deep-link create caveat:** a create never routes, because a record with no id has no URL to
  route TO — pushing a leaf-less URL would remount the catch-all route and drop the draft. This is
  the same fact that makes **must-create-in-modal** the metaphor: the modal keeps the URL (and the
  whole stack) put, and only *save* routes, to the created id. (Historically some consumers instead
  opened a blank "new" leaf in the detail pane and suppressed the route; that is now a defect —
  a detail shows a real, selected record.)
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
- **New is a header `+`, not a leading row.** The create affordance (`onNew`) rides right-justified in
  the titled header rather than as a reserved leading row, so the first topic sits directly under the
  header. Row alignment across lists comes from the uniform titled header (same height + divider), not a
  reserved-when-empty slot — every consumer built the same "New …" button, so the component owns one `+`
  (dry, principle-of-least-astonishment). The `railSlot` render-prop stays for a standalone
  `TopicDetail`'s genuinely custom leading row (rendered only when supplied).
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
- **Reveal the whole list, in place.** A covered list shows only icons, so hovering/focusing it lifts the
  ENTIRE real rail (full rows + header) above its neighbours rather than popping a per-row/per-header copy
  — one legible disclosure instead of many, disclosed only while the pointer/focus is inside it. Because
  it is the real rail (not a copy) there is no aria-current duplication and clicking a row is a pure
  select (never a toggle), keeping the covered interaction predictable (simplicity,
  principle-of-least-astonishment).
- **Reveal the BRANCH, not the list.** Hovering a peek used to lift that one list — and left its children
  covered behind it, so it told you what you were choosing between but not what choosing would show you.
  The branch (the list + its children, chained) is the unit the user is actually reading, so the branch is
  what opens, floating over the detail and closing back into exactly the layout it came from. That makes
  the close condition a property of the GROUP (the pointer leaving *every* member), not of one list —
  walking from a list into its own revealed child must not collapse what you are walking through
  (principle-of-least-astonishment).
- **Narrow is a MODE, not a breakpoint tweak.** Below one list + a minimum detail, the wide layout has
  nothing left to trade: peeks, cover toggles, the hover reveal and drag-resize are all pointer
  affordances spending room that doesn't exist — and on a phone there is no pointer at all. Rather than
  shrink them, the frame swaps the whole presentation for the platform-native one (`UINavigationController`)
  while keeping the SAME stack, selections, `onSelect`/`onClear` and unsaved guard underneath. Consumers
  declare `levels` and get both layouts; nothing about a feature is phone-aware (native-controls,
  optimize-for-change).
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
| Covered disclosure: 40px peek + whole-BRANCH hover reveal + header `+` create + per-list titles + dash/connector markers | passed | implementation |
| Narrow mode: full-width panes, push/pop + Back, auto-switched by width or phone UA | passed | implementation |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.15.2 | 2026-07-20 | Mike Fullerton | **The pointer authority acts only on EVIDENCE, and entering a covered peek is how a settled cascade re-opens.** Two fixes to the closers contract ("the menus close only on the pointer leaving the blue region, an explicit `«/»`, and the final choice"). (1) Evidence clause on must-collapse-from-one-pointer-authority (`pointerInMenusAfterMove`): the remount a select causes has a window where no menu is measurable (detached old container, unpainted new one) and a real mouse always moves in it — a null region keeps the LAST answer instead of writing "outside", which had been releasing the ground/covering/reveal holds on exactly the click they exist to survive (reproducible with a real pointer, invisible to synthetic clicks). (2) The re-open clause of must-auto-collapse-menus-on-final-choice is now implementable as stated: with the disclose trigger entry-gated, a COVERED column carries its own pointer-ENTER that opens its branch reveal — entering a peek discloses it, so a covered root's rows are reachable again (re-click-to-unselect had gone dead: the rows sat under the child overdrawing them with nothing left to disclose the branch). |
| 1.15.1 | 2026-07-20 | Mike Fullerton | **An intermediate select must not move the menus — the clicked list's stay-open is now STRUCTURAL, not reveal-dependent.** New rule `must-not-move-the-menus-on-an-intermediate-select` (vector T61), fixing the recurring "first menu auto-collapses on click" regression: a select advances the frontier, auto-hide covering computed against the new frontier covered the clicked list out from under the pointer, and only the pointer-reveal (must-root-reveal-on-covering-select) — racing the remount the select causes — held it open. The covering now computes against a FROZEN frontier in the surface's remount-surviving memory (`heldCover.frontier`): a rail click ratchets it to the clicked list's index (`ratchetFrozenFrontier`), a clear/✕ retreat is followed (`coverFrontierWhileChoosing`), and it advances only on the standing settles — pointer exit, or the final choice writing it forward so must-auto-collapse-menus-on-final-choice still lands on the click. A rail click is also recorded as pointer-in-the-menus evidence, so every pointer-keyed hold survives the remount with no pointermove ever observed. |
| 1.15.0 | 2026-07-19 | Mike Fullerton | **The FINAL CHOICE is the cascade's settling event — the detail holds until it, then swaps once; the menus auto-collapse on it.** Interaction REVISION (a spec change, not a bug fix). A select whose row leads to no further topic list — in the top (root) menu or any submenu — is the FINAL CHOICE, and the cascade's settling now keys off it. (1) `must-hold-the-detail-until-the-final-choice`: an intermediate select (one that discloses another choosing list) no longer touches the detail pane — no overview flip, no landing, no blank; the detail keeps its previous content until the final choice's detail replaces it in ONE swap. Display hold only: the select still navigates (`onSelect`, URL, clears deeper levels, unsaved guard), and the hold survives the select's remount per must-keep-view-state-across-a-selection. (2) `must-auto-collapse-menus-on-final-choice`: in auto-collapse mode the final choice collapses the menus on the click itself (progressively, per must-animate-every-menu-closure / must-collapse-inward) instead of waiting for the pointer to leave — the ONE click-driven closure, carved out of must-collapse-from-one-pointer-authority (amended); with auto-collapse off, no select collapses anything. Vectors T57–T60, executable: the decisions are `shouldShowHeldDetail` / `planChoiceSettle` / `triggerFires` + the `finalChoice` reveal event in `cascade-rules.ts` (pinned in cascadeRules.test.ts), the hold/settle plumbing lives in the frame (`surfaceStates.heldDetail`, surviving the remount like the ground), and cascadeInteraction.test.tsx walks T57/T58 against the DOM. |
| 1.14.0 | 2026-07-14 | Mike Fullerton | **Overview cards fit their contents + a per-level help-blurb overview.** (1) `must-fit-overview-cards`: the overview `CardTitle` lays out `flex items-start` with a break-anywhere label span, so a long unbreakable label (a full reverse-domain id) wraps INSIDE the card instead of clipping at its edge (found on the status board's endpoint cards). (2) `may-render-overview-help` + exported `TopicOverviewHelp`: a level MAY set `TopicLevel.overviewHelp` (string or nodes) to swap the card grid for a single centered help blurb at its unselected frontier — for a list of one KIND of thing (Sites, Groups), where 100+ near-identical cards are noise and the landing should instead explain what the items are and how to choose one. Wins over the grid; ignored under `overview: false`. Vectors T55–T56. |
| 1.13.3 | 2026-07-13 | Mike Fullerton | **The disclosure toggles settle the stack on the click itself.** Clicking a `«`/`»` pin or the root header's auto-hide toggle inside an open hover reveal changed nothing on screen: the revealed group renders its members at full width regardless of pins or the mode, and nothing closed the reveal (the pointer never left it), so the click read as dead — the pin "turned up later" when the pointer happened to move away, and flipping auto-hide off looked like the mode was stuck on. The toggles now DROP any open reveal as part of the click, so the stack settles to the new state immediately; the pointer hasn't moved, so nothing re-opens the reveal until it next enters a covered peek. (A row SELECT still deliberately roots a reveal — must-root-reveal-on-covering-select — because there, settling would snap the clicked list shut under the pointer; for the explicit toggles, settling IS the requested action.) New requirement `must-apply-disclosure-toggles-immediately`; vector T54. Note the fit rules are unchanged: with auto-hide OFF, width pressure still covers the lists that don't fit, and those peeks still hover-reveal — turning the mode off discloses what FITS, it does not disable the covered style. |
| 1.13.2 | 2026-07-13 | Mike Fullerton | **Title-row actions + the create modal moves down to ui.** (1) `TopicLevel.titleActions` — extra compact controls right-justified in the TITLE row ahead of the `+` (new requirement `may-offer-title-actions`); first consumer is the status board's Sites list, whose Auto Configure action moves up from the `headerSlot` `ListHeader` so the filter field can take the whole header row (`ListHeader` `search.grow` drops its `max-w-xs` cap). (2) `CreateResourceDialog` relocates from `@agentic-toolkit/resource` to `@agentic-toolkit/ui/blocks` so consumers that vendor only ui (the self-enclosed status/builds backends) can obey **must-create-in-modal**; ui can't import auth (auth depends on ui), so the auth telemetry became an `onSaveError` seam and the resource package re-exports the dialog with it pre-wired — the resource-feature API — including 1.13.x's `saveEnabled` Save gate — is unchanged. Applied must-create-in-modal to all six status/builds config sections (Groups/Sites-Endpoints/Platforms ×2 apps), whose `+` had opened an inline create form in the leaf: creation is now a scoped modal (URL+group for a monitored site; name/slug for a group; platform wiring for an integration), the selection underneath never moves, and save selects the created row. |
| 1.13.1 | 2026-07-13 | Mike Fullerton | **The reveal pushes the detail aside — never over it.** Auto-expanding a covered stack (the hover reveal / the covering-click branch) used to float the lists OVER the detail, hiding exactly what the user was reading. The detail's left edge now tracks the open group's right edge: it slides right (animated) so it stays visible beside the reveal, clips at the container's right edge on deep stacks, and slides back when the reveal closes. The peeks behind the group are still overlapped — only the detail yields. New requirement `must-push-detail-aside-on-reveal`; `must-open-branch-in-place` re-scoped to the lists. Also: the embedded "Project" topic of a product/persona (SubjectProjectPane) now publishes the project's FULL topic set (Overview / Work Items / Activity / Access) as a group rail in the one stack, matching the standalone Projects feature, instead of rendering only the overview pane. |
| 1.13.0 | 2026-07-13 | Mike Fullerton | **The automatic topic overview + three corrected regressions.** (1) NEW: every HTDV now shows the standard TOPIC OVERVIEW automatically whenever the frontier list has no selection — one card per row (icon + label + new `TopicDetailItem.description`), click = the level's own onSelect; titled by the parent's selected row; `TopicLevel.overview: false` opts a level with a real landing out (ResourceExplorer's entity landing). It is a FRAME property (workspaces at bare /home, features at /<slug>/home, product topics, group members, editor sections — no host wiring), and it exists ONLY while nothing is selected (`must-show-topic-overview-at-unselected-frontier`, `must-hide-overview-once-selected`, `may-opt-out-overview`, `may-describe-topics`). Implementation subtlety written down as `must-keep-children-mounted-under-overview`: children publish the deeper levels (StackLevels), so replacing them unregisters the frontier and the stack oscillates (max-update-depth crash — found live). (2) CORRECTED: connectors join SELECTED rows only (`must-connect-selected-rows-only`) — the v-interim stub from a selected row into an UNSELECTED child list is rejected: it lands beside an arbitrary row and reads as a phantom selection. (3) CORRECTED: the HOVER reveal opens EVERY on-screen list, parents included (`must-reveal-all-covered-lists-on-hover`, supersedes must-reveal-covered-branch-on-hover) — but the COVERING-CLICK reveal stays bounded at the clicked list's own branch (`must-not-expand-parents-on-select`): clicking a visible row is navigation, never disclosure, and must not spring deliberately collapsed parents open. |
| 1.12.5 | 2026-07-12 | Mike Fullerton | **The covering click roots the branch reveal — auto-collapse never snaps shut under the cursor.** Supersedes 1.12.4's answer to the same bug. Auto-hide covers every list above the FRONTIER again (1.12.4 had exempted a choosing frontier's parent, which just suspended auto-collapse: the parent stayed disclosed in FLOW and nothing auto-collapsed at all). The real problem was pointer mechanics, not the cover rule: the select that pushes a new choosing list covers the clicked list with the pointer still inside it — exactly the state the hover reveal serves — but the pointer never moved, so no enter event could engage the reveal, and the list snapped shut under the cursor with nothing to reopen it. The covered stack's row-select now roots the reveal at its own list: the clicked list stays open in place and the new choosing list slides out floating OVER the detail, as if the user had moused into their freshly covered parent; the pointer leaving settles the covered layout. A select that completes the path covers nothing at/below the clicked list, and the blind root is dropped as meaningless (no lift, no card shadows — the z-lift now tracks the OPEN reveal, not the raw hover id, and the document watcher clears a lingering blind root so a later width squeeze cannot spring a phantom branch). Deep links get no reveal (no pointer). The minimized style reverts to covering above the frontier with no reveal — its strips stay visible and clickable. New requirement `must-root-reveal-on-covering-select`; vectors T28a–T28c. |
| 1.12.4 | 2026-07-12 | Mike Fullerton | **(Superseded by 1.12.5.)** First cut at the auto-collapse snap-shut bug: auto-hide bounded at the deepest SELECTED list instead of the last rendered one, so a still-choosing frontier kept its parent disclosed in flow. Fixed the snap but at the cost of auto-collapse itself — with the parent left in the flow, nothing collapsed when the child list appeared. |
| 1.12.3 | 2026-07-11 | Mike Fullerton | **A narrow row needs its own disclosure hint.** A full-width pane has no peeking sibling column beside it to imply that tapping a row pushes another pane in — the wide stack gets that for free from the connector line and the covered peek, narrow mode gets neither. Every selectable row now carries a trailing chevron (`TopicList`'s new `rowDisclosure`, threaded through `TopicRail`, set only by `NarrowStack`); a `disabled` row is excluded (nowhere to go), and the wide/covered stack never sets the flag, so its rows are unchanged. New requirement `must-show-row-disclosure-chevron`; vector T53. |
| 1.12.2 | 2026-07-11 | Mike Fullerton | **A narrow pane must paint the whole screen.** The rail sizes to its rows — correct in the wide stack, where every list is a stretched grid cell, and wrong in a narrow pane, which is a flex column filling the viewport: everything under the last row was transparent, so you saw through to the parallaxed pane behind it and then to the page. `TopicRail` gains a `className` seam and narrow mode tells it to fill (`flex-1`) and to drop its trailing border, which at full width is a hairline down the edge of the screen separating nothing. New requirement `must-fill-the-pane`; vector T52. |
| 1.12.1 | 2026-07-11 | Mike Fullerton | **The narrow slide actually plays now, and eases in AND out.** The panes always carried a transform transition and it never ran in the app: pushing a pane means selecting a row means a route change means a REMOUNT, so every pane mounted already at its final transform, with nothing to animate from — the push and pop were silent jumps. The slide's origin (the pane the stack was last painted at) now lives in the surface store with everything else that must outlive the click, so the incoming pane still paints off-screen for one frame and then travels. Easing changed from `ease-out` to **ease-in-out** so both directions leave and reach rest smoothly; `motion-reduce` still drops the transition entirely. New requirement `must-slide-panes-ease-in-out`; vectors T50, T51. |
| 1.12.0 | 2026-07-11 | Mike Fullerton | **The stack's view state belongs to the surface, not to the mount — and three bugs that were all that one bug.** Selecting a row is a route change, and a route change remounts the page subtree, so every piece of view state the frame held in component state was destroyed by the user's own click: (1) turning auto-hide off and then picking another workspace snapped every list shut with the toggle flipped back on; (2) picking a row inside a revealed branch collapsed the branch under a pointer that had never left it — and since the pointer hadn't moved, nothing would reopen it; (3) a `defaultSelectedId` re-fired after the clear that its own remount caused, so the auto-selected row could not be deselected at all. Auto-hide, pins, the open hover branch and the defaults' arming record now live per SURFACE (keyed by the root list), outside React — new requirement `must-keep-view-state-across-a-selection`; vectors T45–T47. Also: walking the pointer OUTWARD into a shallower peek now GROWS the cascade (the new list joins as its root, pushing the open lists right) instead of collapsing everything one step from the top — `must-grow-the-branch-walking-outward`, T48. And a modal opened from inside the stack MUST portal to the body: rendered in place it stays a descendant of the pane that opened it, which narrow mode marks `inert`, so the create dialog silently refused every keystroke — `must-portal-modals-out-of-the-stack`, T49. |
| 1.11.0 | 2026-07-11 | Mike Fullerton | **A level may name a landing selection.** New optional `TopicLevel.defaultSelectedId`: the item to select the moment that list APPEARS with nothing chosen. `must-not-auto-select` stands for every level that doesn't ask — this is the one opt-in exception, for the case where the empty pane just asks a question with a single sensible answer (Work Items → List, its first consumer). It fires the level's own `onSelect`, so it is an ordinary selection (URL, breadcrumb, detail, re-click-to-clear); it arms once per APPEARANCE, so a manual clear inside a visit sticks (a default may choose FOR the user, never argue WITH them) while leaving the parent topic and returning re-applies it; and it never fires for an item the list doesn't have, so an async list applies it when its rows land. New requirement `may-default-select-a-level`; vector T20a. |
| 1.10.2 | 2026-07-11 | Mike Fullerton | **Only the pointer closes the branch.** Selecting a row used to also drop the reveal (`must-close-reveal-on-select`, inherited from the old single-list reveal) — but with the whole branch open that collapses the lists out from under the cursor mid-gesture, so you could never pick a parent and then pick its child from the list that just re-populated beside it, which is the entire point of revealing the branch. The branch (including a deeper list a new selection adds to it) now stays open until the pointer leaves every member, then animates to the layout the new selection implies. Replaces `must-close-reveal-on-select` with `must-close-branch-only-on-pointer-exit`; T28 rewritten as the two-step walk. |
| 1.10.1 | 2026-07-11 | Mike Fullerton | **The revealed branch has to be a card, and it must not eat its own connectors.** Three defects of the 1.10.0 reveal, all from the branch's z-lift over the detail: (1) the selection connectors were painted OVER by the very lists they link (the overlay sat at the resting z-order, the lifted branch above it) — the gold chain vanished exactly when you opened the branch to read it; the overlay now rides above the whole lift. (2) A revealed list in the MIDDLE of the stack lost its leading edge: a peek's own trailing border is clipped away with its rail, so the child's left drop-shadow IS that boundary, and the reveal was dropping it — the open branch now shadows on BOTH outer edges (the two compose, so a one-list branch gets both). (3) The rail's nav background is deliberately translucent against the page, which ghosted the detail's text through the floating branch; a lifted member now composites over an opaque page-coloured layer. New requirements `must-float-branch-as-an-opaque-card`, `must-draw-connectors-over-the-revealed-branch`; vectors T26c, T26d. |
| 1.10.0 | 2026-07-11 | Mike Fullerton | **The hover reveal opens the BRANCH, and a NARROW (navigation-controller) mode.** (1) Hovering a covered list used to lift that ONE list while its children stayed covered behind it — showing what you were choosing between but not what choosing would show you. It now opens the whole **branch**: the hovered list AND its children, chained side by side at full width, floating over the detail; it opens IN PLACE (nothing underneath moves, so it closes back into exactly the layout it came from), stays open while the pointer is anywhere inside ANY member (walking from a list into its own revealed child no longer collapses it — closing is a property of the group, decided from the leave event's `relatedTarget`), re-roots when the pointer enters a different covered list, and closes on row-select. Replaces `must-reveal-covered-list-on-hover` / `must-disclose-reveal-only-while-inside` with `must-reveal-covered-branch-on-hover`, `must-open-branch-in-place`, `must-keep-branch-open-while-inside-it`; vectors T26, T26a, T26b. (2) New `layoutMode` (`"auto"` default): when only a details view can fit — the container is narrower than one topic list plus `minDetailWidth` — or the browser is a phone (iOS/Android UA; tablets and desktops go by width, so a narrow WINDOW behaves like a phone), the row of columns becomes an iOS `UINavigationController`: ONE full-width pane at a time, the frontier list (never a landing placeholder) then the detail, selecting PUSHES the next pane in from the right, Back POPS it out by clearing the deepest selected level through the same `onClear` + unsaved guard. Peeks, cover toggles, auto-hide and drag-resize are not rendered (they spend room that doesn't exist), and selection falls back to the primitive's gold bar (connectors need a parent list on screen). Everything that exists today is "wide" mode, unchanged. New requirements `must-switch-to-narrow-when-only-a-detail-fits`, `must-show-one-full-width-pane`, `must-push-and-pop-like-a-navigation-controller`, `must-offer-back-in-narrow`, `must-keep-selection-across-modes`, `must-mark-narrow-selection-with-bar`; vectors T40–T44. The frame now owns the ONE row measurement and passes it to whichever stack renders. |
| 1.9.1 | 2026-07-11 | Mike Fullerton | Clarify what "one stack, no sublists" actually bans: a second **navigator**, not a second *list*. The rule was written as "every list anywhere is a level; the deepest pane is never a list", which reads as forbidding a detail pane from ever RENDERING a list — and it was misread that way. The line is what the list is FOR. **Navigation** (picking a row is how you reach a record: the selection moves, the URL grows a segment, the pane beside it becomes that record's detail) is the stack's job and MUST be a level. **Display** (the pane is showing you data, and a list is one of the shapes data comes in — beside a board, table, timeline, calendar, chart) is CONTENT, which is exactly what a detail pane holds; it may be a list, may carry its own details pane, and may edit its rows in place, because the stack never moves. "The deepest pane is a detail" constrains the pane's ROLE, not its shape. New requirement `may-display-content-as-a-list`; `must-be-one-stack` re-scoped to navigation lists; vector T24a. |
| 1.9.0 | 2026-07-11 | Mike Fullerton | **Create is a MODAL — the stack's create metaphor**, stated outright instead of left as an option. `may-offer-new-topic-button` previously allowed "a modal / a blank leaf"; the blank leaf is now a defect. The reason is structural, not stylistic: the detail pane always shows a real, SELECTED record, and a record with no id has nothing for the stack to hold — no row to focus, no crumb to name it, no id for the deep link — so handing it the detail strands the rest of the view. The modal doesn't touch the stack at all: nothing is selected or cleared and the pane behind it keeps showing what was open, until save returns an id and the owning list selects it (so the detail that opens is the record's real one). New requirements `must-create-in-modal` and `must-scope-create-modal-to-placement` (the modal asks only for what brings the record into existence and places it — a title and its column/parent — never the full editor; the rest belongs to the detail that opens on save). Test vectors T11 (rewritten), T11a, T11b. Applied to Work Items: the `+` opened a blank WorkItemEditor in the leaf; it now opens a `NewWorkItemDialog` (shared `CreateResourceDialog`) and `WorkItemEditor` is edit-only. |
| 1.8.0 | 2026-07-11 | Mike Fullerton | **Auto-hide + the authoritative auto-collapse rules + motion split.** Added `autoHideTopics` (default **on**): only the leaf-most list is disclosed and every parent is hidden by its child even when there is room — the hub's workspace `/home` opts out (`autoHideTopics={false}`). The ROOT list's header gains a left-justified STATE toggle for it, and **⌘/Ctrl-click** on any `«`/`»` now applies that action to EVERY list. Disclosure is specified as three layers that may only ever hide more, never disclose (pin → auto-hide → width pressure). Wrote down the auto-collapse rules that were previously only implied: the detail HOLDS `minDetailWidth` while the lists yield (hide leftmost-first, then go off-screen), the off-screen shift is **quantised to whole lists** (was a continuous shift that parked a list half off the edge), and growing re-runs the same rules in reverse but only re-discloses when auto-hide is off. Finally, **structural changes now land in place**: selecting a topic re-lays-out instantly instead of animating the detail pane in from the left edge (only width-driven changes — resize, cover toggle, hover reveal, drag — still animate). New requirements `must-default-to-auto-hide`, `must-offer-auto-hide-toggle`, `must-layer-hide-intent`, `must-toggle-all-on-modifier-click`, `must-keep-detail-at-minimum-while-lists-yield`, `must-shift-off-screen-by-whole-lists`, `must-reverse-on-grow`, `must-land-structure-changes-in-place`, `must-animate-width-changes`; test vectors T33–T39. |
| 1.7.0 | 2026-07-10 | Mike Fullerton | `TopicLevel.headerSlot`: pinned non-scrolling strip for the shared ListHeader (filter + actions) on entity-list levels. |
| 1.6.0 | 2026-07-07 | Mike Fullerton | Added an optional per-row **delete** affordance. A `TopicDetailItem` may set `onDelete` (+ `deleteLabel` / `deleteConfirm`) to get a **right-justified trash button revealed only on hover** (row reserves trailing width so the label never runs under it, never on icon strips); activating it opens a **destructive confirmation** (shared `AlertModal` — red action, keyboard off, focus on Cancel, busy spinner for async deletes) and `onDelete` runs only on confirm. In the stack the **selection connector breaks around the button** (a computed gap in the SVG path — the overlay paints above the rail, so occlusion isn't possible). New requirements `may-delete-row`, `must-confirm-row-delete`, `must-break-connector-around-delete`. |
| 1.5.0 | 2026-07-04 | Mike Fullerton | Reworked the covered-list disclosure + the New affordance. **Reveal:** replaced the per-row / per-header `RevealPortal` popover with an **animated whole-list reveal** — a covered list's wrapper is `overflow-hidden` clipped to a 40px peek (rows are always full, so only the leading icon shows) and, on hover (`CoveredStack`'s `hoverId`), its `width` WIPES open to the full rail above its neighbours (lingering z-lift via `zLiftId` so the wipe-shut stays over the child, + drop-shadow), disclosed only while the pointer is inside it and closed (wipes back to the peek) on row-select; there is no aria-current duplication (it is the real rail, not a copy). The reveal is **pointer-driven only** — a focus reveal was dropped because a covered row keeps focus after a click, which left the list disclosed and jammed the auto-cover as the window shrank. Replaced `must-reveal-covered-row-on-hover`/`-on-focus`/`must-reveal-covered-title`/`must-close-reveal-robustly` with `must-reveal-covered-list-on-hover`/`must-disclose-reveal-only-while-inside`/`must-close-reveal-on-select`. **New:** the "New …" affordance moved from a reserved leading `railSlot` row to a compact **`+` right-justified in the list header** (`onNew`/`newLabel`/`newActive`), so the first topic moves up to a proportional top padding; first-row alignment now comes from the uniform titled header (updated `may-offer-new-topic-button`, `must-align-first-row`, `must-render-undisclosed-icon-strip`). Migrated all hierarchical `TopicLevel` consumers off `railSlot`; `railSlot` remains on the standalone `TopicDetail` for a genuinely custom leading row (FocusedTopicDetail's PopupMenu, editor-section's list header), rendered only when supplied. |
| `headerSlot` | `ReactNode` | — | Per-level pinned strip between the level's title header and its rows — hosts the shared ListHeader for entity lists in the stack. |
| 1.0.0 | 2026-06-30 | Mike Fullerton | Initial draft — full hierarchical view contract (deep linking, one breadcrumb + help, alignment, resizable/disclosable rails, auto-disclosure, help-config). |
| 1.1.0 | 2026-06-30 | Mike Fullerton | Implemented animated disclosure, drag-resize with snap, window-gated auto-disclosure, detail min-width + horizontal scroll, centered detail title bar + per-pane help, breadcrumb help button, and the site-config help store. Remaining: 5th-level deep linking + shell-rail auto-disclosure. |
| 1.2.0 | 2026-06-30 | Mike Fullerton | Recipe fully implemented: shell workspace/feature rails inherit auto-disclosure (general→specific, nav kept longest); whole-hierarchy deep linking including the 5th leaf level inside a topic's master/detail (`urlSelection` controlled selection + `useLeafUrlSelection` + `leafCrumb` channel), surfaced as the deepest breadcrumb crumb. |
| 1.3.1 | 2026-06-30 | Mike Fullerton | Correct the shrink behavior to the TWO-PHASE spec: undisclose the leftmost lists to icon strips (general→specific) FIRST, and slide lists off-screen ONLY once every list is already an icon strip and they + the detail minimum still don't fit. Also: drill-down applies at every width (not `md:`-gated) so phones drill-down from first paint; the leaf reflows (`min(<min>,100%)`) instead of forcing a horizontal scroll; hidden columns use a real `inert` boolean. New requirement `must-undisclose-before-off-screen`. |
| 1.4.0 | 2026-06-30 | Mike Fullerton | Added the `covered` disclosure style (now the default): lists overlap like cards with a 40px peek of each covered parent (vs `minimized`'s off-screen slide), with auto + manual cover and a hover/focus **reveal popover** (a full row copy floated over a covered icon; click = pure select; closes on pointer-outside/blur/scroll/Escape; also reveals a covered list's title). Added **per-list `title`** (left-aligned + divider). Replaced the in-stack gold selection bar with **`selectionStyle="marker"`** — a root **dash** + parent→child **elbow connectors** (shared `useSelectionConnectors` / `SelectionConnectorOverlay`, DOM-measured via `data-htd-*`, re-tracked across the slide, attached for covered lists); the standalone `TopicDetail` keeps `selectionStyle="bar"`. New requirements `must-default-to-covered`, `must-peek-covered-parent`, `must-cover-automatically`, `must-allow-manual-cover`, `must-reveal-covered-row-on-hover`/`-on-focus`, `must-reveal-covered-title`, `must-pure-select-from-reveal`, `must-close-reveal-robustly`, `may-title-each-list`, `must-mark-selection-without-bar`, `must-keep-connectors-attached-when-covered`, `must-keep-bar-for-standalone`. |
| 1.3.0 | 2026-06-30 | Mike Fullerton | Encapsulated single-stack rewrite: flattened the frame to sibling grid columns (one ResizeObserver / stable leaf slot); `onSelect`/`onClear` pure-intent contract with package-owned unselection + no-auto-select; ONE merged stack — features publish levels up through `WorkspaceChrome` (`useWorkspaceLevels`/`useWorkspaceListLevel`) instead of nesting; dismantled every in-pane master/detail (Applications, Buckets, Access, Users, Team Members) into a published list level + leaf editor, and split Personas into Personas + Persona Services; replaced auto-collapse-to-icons with **off-screen drill-down** + top-left **Back** + a 3-action **Save/Discard/Cancel** unsaved-work guard (`exitGuard`/`PaneExitGuard`), the manual disclosure toggle coexisting. Removed `maxExpanded`/`onCrumbNavigate`. |
| 1.4.2 | 2026-07-03 | Mike Fullerton | Close a `must-not-hide-frontier-choosing-list` gap in the covered stack: the off-screen shift enforced the detail's minimum width even for an UNSELECTED frontier, so on a narrow viewport (e.g. a one-level stack on a phone) it slid the sole choosing list off the left edge to give a landing PLACEHOLDER its minimum — leaving nothing to pick from. The shift now enforces the detail minimum only when a real leaf is selected (`detailMin = firstUnselected === -1 ? minPx : 0`); an unselected frontier's placeholder claims no minimum, so the choosing list keeps its place and the landing takes the remaining width. `must-cover-automatically` clarified. |
| 1.4.1 | 2026-06-30 | Mike Fullerton | Close a `must-guard-unsaved-on-exit` gap: `railOnSelect` previously ran a select UNGUARDED whenever the target rail was not shallower than the deepest selection (`i < deepestSelected`), so swapping to a **sibling row in the deepest selected level** replaced/unmounted a dirty leaf editor with no prompt (silent data loss — e.g. switching tables in the `/all-data` browser). It now guards any select of a different row in a level that already has a selection (`level.selectedId != null`), covering the sibling swap; only a forward drill-down into a not-yet-selected level stays unguarded. No-op for guard-less consumers (`attemptExit` is a no-op without a dirty `exitGuard`). |
