---
id: 0bba1f5b-bc8d-4f76-b1c9-329b627f7ee8
title: Hierarchical Topic / Detail View
domain: agenticdeveloperhub://recipes/hierarchical-topic-detail
type: recipe
version: 1.12.2
status: draft
language: en
created: '2026-06-30'
modified: 2026-07-11
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

### Auto-hide — only the leaf-most list is disclosed

`autoHideTopics` (default **on**) makes the stack lead with its LEAF: only the leaf-most topic list is
disclosed, and every parent is hidden by its child even when there is room to show it. It is the
default because a feature surface is normally *used* at its leaf — the ancestry is provenance, not
navigation. The hub's workspace routes (`/home`) pass `autoHideTopics={false}`: there the ancestry
(workspace ▸ feature ▸ entity ▸ topic) IS the navigation, so every list stays disclosed while it fits.

The **root** list's header carries a left-justified toggle reporting the STATE (gold + a closed panel
while on; muted + an open panel while off). Turning it **on** hides every disclosed parent; turning it
**off** discloses every list that fits (the auto-collapse rules below then re-hide whatever doesn't).
Flipping it clears the per-list `«`/`»` pins, so it is always a clean reset to one of the two modes.

Disclosure therefore has three layers, and **each may only ever HIDE more, never disclose**:

1. **pins** — the user's own `«`/`»` intent on one list (wins over auto-hide in both directions),
2. **auto-hide** — the default for every non-leaf list when there is no pin,
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

### Whole-branch reveal for covered lists

Because a covered list shows only icons, the frame makes it **reachable without permanently uncovering
it**: hovering a covered/peeking list opens **that list and its children** — the whole **branch** —
chained side by side at full width, **floating over the detail** (a lifted card with a drop-shadow off
its trailing edge). Each revealed list is the real rail: full-width rows **and** its titled header
(title, cover `«`/`»`, the New `+`).

The unit is the **branch**, not the one list. Revealing the hovered list alone shows you the rows you
are choosing between but *not what choosing one would show you* — its children are still covered behind
it, so the reveal answers half the question and you have to commit to a click to see the rest. Opening
the branch shows the ancestry as it will look, which is what the peek was hiding in the first place.

The branch opens **in place**: it starts where the hovered list already sits and lays its members out
end to end, so nothing underneath moves — the detail keeps its geometry and is simply overlapped, and
the whole cascade animates straight back to the layout it came from when it closes. It stays open while
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

Standalone `TopicDetail` (the single two-pane primitive, used by [[focused-topic-detail]] and the showcase)
keeps the classic **`selectionStyle="bar"`** gold left-border — the dash/connector markers are a property of
the hierarchical stack, not the primitive.

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
- **must-create-in-modal**: A create MUST be a **modal over the stack** — never a blank/"new" leaf in the detail pane, and never an inline row in the list. The stack MUST NOT move while the modal is open: no level is selected or cleared, the breadcrumb is unchanged, and the pane behind it keeps showing whatever was open. On save the modal MUST return the created id, and the owning list MUST then select it — so the detail that opens is the new record's REAL detail. On cancel nothing changed. Reuse the shared `CreateResourceDialog` (guarded close: a dirty draft prompts Save / Discard / keep editing; the backdrop is inert).
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
- **must-reveal-covered-branch-on-hover**: Hovering a covered (peeking) list MUST reveal the WHOLE BRANCH — that list AND every list below it (its children) — as real rails at full width, with uncovered `[icon] [name]` rows AND their titled headers (title, cover `«`/`»`, New `+`), chained side by side and floating ABOVE the detail (a lifted card with a drop-shadow off the branch's trailing edge). Revealing the hovered list ALONE is a defect: its children stay covered behind it, so the reveal shows what you are choosing between but not what choosing would show you. The reveal MUST be ANIMATED: the branch wipes open from the 40px peek to full width (and back), subject to **must-respect-reduced-motion**. There MUST be no per-row or per-header popover copy. The reveal is POINTER-driven only: it MUST NOT be triggered by focus, because a covered row keeps focus after a click and a focus reveal would leave the branch open — jamming the auto-cover as the window shrinks. (Covered rows stay keyboard-operable via their `aria-label`.)
- **must-open-branch-in-place**: The branch MUST open IN PLACE — starting at the left edge the hovered list already occupies, laying its members out end to end. Nothing underneath may move: the detail keeps its geometry and is simply overlapped, so closing the branch animates it straight back to the layout it came from (the state it was in before the hover), with no re-layout of the rest of the view.
- **must-keep-branch-open-while-inside-it**: The revealed branch MUST stay open while the pointer is inside ANY of its members — moving from the hovered list into one of its revealed children MUST NOT collapse it. It MUST close (animate back to the previous state) only once the pointer has left every member of the branch. Entering a DIFFERENT covered list MUST re-root the branch at that list.
- **must-grow-the-branch-walking-outward**: Walking the pointer OUTWARD (right → left, into a shallower peek) MUST grow the cascade: the newly entered list joins it as its new root, pushing the already-open lists to the right, and every list that was open STAYS open. Collapsing the cascade because the pointer moved to a list outside the current group throws away everything the user just opened, one step before they get to the top of the stack. Only the pointer leaving the COLUMNS entirely closes it.
- **must-close-branch-only-on-pointer-exit**: The POINTER — and nothing else — closes the branch. Selecting a row inside it MUST NOT collapse it: the pointer is still in there, and collapsing under the cursor yanks the rows out from under the gesture, so you could never pick a parent and then go on to pick its child in the list that just re-populated beside it — which is what a whole-branch reveal is FOR. The branch (including any deeper list the new selection just added to it) MUST stay open until the pointer leaves every member, and MUST then animate back to the layout the new selection implies.
- **must-float-branch-as-an-opaque-card**: The revealed branch MUST read as one opaque card floating over the UI. Both of its OUTER edges MUST be edges — a drop-shadow off its trailing edge (over the detail it covers) AND off its leading edge (over the peek stack it slid out of); a peek's own trailing border is clipped away with the rest of its rail, so that leading shadow is the only boundary there, and without it the opened list bleeds into the icon strip behind it. Members INSIDE the branch abut each other, separated by their own rail borders. The branch MUST also be opaque: a rail background that is deliberately translucent against the page (the nav token) MUST be composited over an opaque page-coloured layer while it floats, or the detail's text ghosts through the branch.
- **must-draw-connectors-over-the-revealed-branch**: The selection connectors MUST stay VISIBLE across the revealed branch — they are the chain the branch exists to show you. The connector overlay MUST therefore be lifted above the branch's own lift: the branch's members float above the detail, so an overlay left at the resting z-order is painted over by the very lists it links, and the selection chain vanishes exactly when the user opens the branch to read it.
- **must-pure-select-from-reveal**: Clicking a row in a revealed list MUST be a PURE select of that item — it changes the selection only (it MUST NOT unselect, and MUST do nothing if the row is already selected), removing the deeper lists and showing the chosen item's detail.
- **may-title-each-list**: A level MAY carry a `title`; when present it MUST render left-aligned (aligned with the row text) with a divider beneath it, the disclosure toggle in a fixed leading control slot.
- **must-mark-selection-without-bar**: In the stack (`selectionStyle="marker"`) the selected row MUST NOT use the topic-detail gold left-bar; the root's selected row MUST show a leading gold dash, and each child's selected row MUST be joined to its selected parent row by a gold elbow connector.
- **must-keep-connectors-attached-when-covered**: The selection connectors MUST stay attached to the correct rows when lists are covered/peeking and across the cover/uncover slide (measured from the DOM, re-tracked through the transition).
- **must-keep-bar-for-standalone**: The standalone `TopicDetail` primitive MUST keep `selectionStyle="bar"` (the gold left-border); the dash/connector markers are a property of the hierarchical stack only.

### Narrow mode — the stack as a navigation controller

- **must-switch-to-narrow-when-only-a-detail-fits**: The frame MUST switch to the NARROW layout when only a details view can fit — the container is narrower than one topic list plus `minDetailWidth` — or when the browser is a phone (an iOS / Android phone user agent) at ANY width. Tablets and desktops are decided by width alone, so a narrow WINDOW behaves exactly like a phone and a wide one does not. The mode MUST be resolved before paint (no flash of the wide layout), and `layoutMode="wide" | "narrow"` MUST force one.
- **must-show-one-full-width-pane**: In narrow mode each topic list and the detail MUST be a FULL-WIDTH pane, and exactly ONE of them is visible: the frontier list while it is still being chosen from, the detail once every level is selected. A landing placeholder MUST NOT be shown in place of the list being chosen from. Peeks, cover toggles, the auto-hide toggle, the hover reveal and drag-resize MUST NOT be rendered — they spend room that does not exist.
- **must-push-and-pop-like-a-navigation-controller**: Selecting MUST PUSH the next pane in from the right edge (animated, subject to **must-respect-reduced-motion**); the pane behind it MUST parallax and be `inert` + `aria-hidden`, so only the visible pane is reachable by pointer, keyboard or AT. A pane that is being pushed MUST animate in rather than appear in place.
- **must-fill-the-pane**: A narrow pane IS the screen, so it MUST paint the whole of it: the list inside it MUST FILL the pane rather than size to its rows. A content-height rail leaves everything under the last row transparent — the parallaxed pane behind it shows through, and the page behind that — which reads as a half-drawn screen. (The wide stack's lists are stretched grid cells and correctly size to their column; this is the flex pane's own responsibility.) A full-width pane also MUST NOT draw the rail's trailing border: it separates nothing at the edge of the screen.
- **must-slide-panes-ease-in-out**: EVERY pane — the topic lists AND the detail — MUST travel on one transition: a horizontal slide, **ease-in-out**, so the push and the pop each accelerate out of rest and settle back into it rather than snapping to a stop. Both directions animate: disclosing (push, in from the right) and undisclosing (pop, back out to the right). The animation MUST survive the REMOUNT the selection causes — the slide's origin is the pane the stack was last painted at, held per surface (**must-keep-view-state-across-a-selection**), because a pane that mounts already at its final transform has nothing to animate FROM and the push silently degrades to a jump. Under **must-respect-reduced-motion** the transition is dropped entirely: the panes cut to their new places, identical layout, no travel.
- **must-offer-back-in-narrow**: Every narrow pane except the root MUST carry a top-left **Back** that POPS one pane — clearing exactly the deepest SELECTED level via the same `onClear` the breadcrumb and the wide Back use, so **must-guard-unsaved-on-exit** applies identically. Repeated Back MUST walk up to the root, and a popped pane MUST animate OUT to the right rather than vanish.
- **must-keep-selection-across-modes**: Switching between wide and narrow (a resize) MUST preserve the selection exactly — the mode is a rendering of the same stack, never a navigation.
- **must-mark-narrow-selection-with-bar**: In narrow mode a list's selected row MUST use the primitive's gold `selectionStyle="bar"`: the dash/connector markers need a parent list on screen to connect FROM, and narrow mode never has one.

### General

- **must-respect-reduced-motion**: All animations (disclosure, resize snap, auto-disclosure, the narrow push/pop) MUST be disabled when the user's "reduce animation" preference is set.
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
