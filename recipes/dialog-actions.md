---
id: f679a77e-04f7-4e43-b898-6d78a637a760
title: DialogActions
domain: agenticdeveloperhub://recipes/dialog-actions
type: ingredient
version: 1.1.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-27'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Two-button dialog footer whose layout is resolved by CSS — equal-width when narrow, natural-width right-justified when wide — settled on the first painted frame, plus initial focus and a busy state."
platforms:
- typescript
- web
tags:
- component
- dialog
- actions
- footer
- ui
depends-on:
- agenticdeveloperhub://recipes/button
related:
- agenticdeveloperhub://recipes/alert-and-dialog
- agenticdeveloperhub://recipes/dialog
references: []
---

# DialogActions

## Overview

`DialogActions` (`@agentic-toolkit/ui`) is the standard footer for a dialog or alert:
a cancel button (optional) and a confirm button, laid out per the rule in
**alert-and-dialog §Layout**, which resolves to one of two shapes according to how
much room the container gives them:

- **equal-width** — each button takes half the row and the row fills the container
  (`[ Cancel ][ Confirm ]`), when the container is narrow.
- **natural-width, right-justified** — the buttons keep their content width and
  hug the right edge, when the container has room for both.

The rule is expressed in CSS rather than measured in JavaScript: each button is
`flex-1 max-w-max` inside a `justify-end` row, so it grows into its share of the
row but never past its natural width, and any leftover space collects on the left.
The layout engine therefore resolves equal-vs-natural during first layout, and the
first painted frame is the final one. The component also sets initial focus on
mount (defaulting to the safe button) and renders a spinner while `busy`.

One symbol ships from `@agentic-toolkit/ui/components/dialog-actions`: the
`DialogActions` component. There is no exported layout helper — see *Design
Decisions*.

## Behavioral Requirements

- **must-render-confirm**: The component MUST always render a confirm button labeled with `confirmLabel` that invokes `onConfirm` when activated.
- **must-render-cancel-when-labeled**: The component MUST render a cancel button that invokes `onCancel` when `cancelLabel` is provided, and MUST omit the cancel button entirely when `cancelLabel` is absent.
- **must-equal-width-when-narrow**: In `auto` layout with two buttons, when the container is too narrow for both at their natural width, the component MUST split the row evenly between them.
- **must-natural-width-when-wide**: In `auto` layout with two buttons, when the container has room for both at their natural width, the component MUST hold each at that width and right-justify the row.
- **must-cap-growth-at-natural-width**: In `auto` layout, no button may be stretched past its own natural width; the space a button declines MUST fall to the other button if it needs it, and otherwise to the left of the row.
- **must-settle-before-interactive**: The component MUST present its final button geometry on the first frame it paints. It MUST NOT move or resize a button after mount as a result of deciding its own layout — a button that shifts while the dialog is already clickable can swallow the click that was aimed at it.
- **must-follow-the-container**: The layout MUST be derived from the container's own width, not the viewport's, and MUST re-resolve when the container's width changes.
- **must-honor-forced-layout**: When `layout` is `equal` or `natural`, the component MUST use that layout regardless of the container's width.
- **must-focus-initial-on-mount**: When `focusOnMount` is true, the component MUST move focus on mount to the button named by `initialFocus`.
- **must-default-focus-to-safe-button**: When `initialFocus` is unset, the component MUST default initial focus to the confirm button normally and to the cancel button when `destructive` is true.
- **must-not-focus-when-suppressed**: When `focusOnMount` is false, the component MUST NOT move focus on mount, leaving the host to place focus.
- **must-style-confirm-destructive**: When `destructive` is true, the confirm button MUST render with the destructive variant.
- **must-show-busy-indicator**: When `busy` is true, the component MUST replace the buttons with a status spinner exposing an accessible working label, and MUST NOT invoke `onConfirm` or `onCancel`.

## Appearance

Narrow container (no room for both at natural width) → an even split of the row:

```
┌───────────────────────────────┐
│ [   Cancel   ][   Confirm   ]  │   each capped share
└───────────────────────────────┘
```

Wide container (room for both) → natural width, right-justified:

```
┌───────────────────────────────────────────┐
│                        [ Cancel ][ Confirm]│   justify-end
└───────────────────────────────────────────┘
```

Busy:

```
┌───────────────────────────────┐
│                          ◌     │   spinner, right-justified
└───────────────────────────────┘
```

- Row: `flex items-center gap-3`; `w-full justify-end` in `auto`, `w-full` in
  forced-equal, `justify-end` in forced-natural and busy modes.
- Buttons in `auto` carry `flex-1 max-w-max`; forced-equal carries `flex-1`
  (uncapped); forced-natural carries neither.
- Buttons are the shared `Button` at `size="sm"`. Cancel is `variant="outline"`;
  confirm is `destructive` when `destructive`, else `confirmVariant` (default
  `"default"`, the gold primary).
- `data-slot="dialog-actions"` on the row for host styling/targeting.
- Busy spinner: `Loader2` at `size-4 animate-spin`, muted token color.
- No raw hex; no `!important` — buttons carry all color via `Button` variants.

## States

| State | Appearance change |
|---|---|
| Idle, narrow container | even split, `[ Cancel ][ Confirm ]` filling the row |
| Idle, wide container | natural-width, right-justified (`justify-end`) |
| Forced `equal` | always equal-width regardless of container width |
| Forced `natural` | always natural-width right-justified |
| Confirm-only (no `cancelLabel`) | single confirm button, right-justified at its natural width; forced-equal does not stretch it |
| Destructive | confirm renders destructive variant; default initial focus is Cancel |
| Busy | buttons replaced by a `role="status"` spinner; no clicks fire |

## Accessibility

- Renders the shared, focusable `<button>` primitives, so keyboard activation
  (Space/Enter) works natively.
- Initial focus is placed deliberately: on the confirm button by default, and on
  the cancel button for `destructive` actions so an errant Enter does not confirm
  a dangerous operation. Hosts that focus a form field instead pass
  `focusOnMount={false}`.
- The busy spinner is exposed to assistive tech via `role="status"` and
  `aria-label="Working…"`, announcing the in-progress state.
- Color is carried by `Button` variants (theme tokens), keeping contrast
  consistent with the platform's button treatment.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-confirm | `confirmLabel="Save"`, click confirm | `onConfirm` called once |
| T2 | must-render-cancel-when-labeled | `cancelLabel="Cancel"`, click cancel | cancel button present; `onCancel` called once |
| T3 | must-render-cancel-when-labeled | no `cancelLabel` | no cancel button in the DOM |
| T4 | must-equal-width-when-narrow (Playwright) | `auto` in a container narrower than `2 × Wmax` | both buttons at half the row, container filled |
| T5 | must-natural-width-when-wide (Playwright) | `auto` in a container wider than `2 × Wmax` | both at natural width; row right-justified |
| T6 | must-cap-growth-at-natural-width | `auto` | both buttons carry `flex-1 max-w-max`; the row carries `justify-end` |
| T7 | must-settle-before-interactive (Playwright) | sample the cancel button's bounding box every frame from before the dialog opens | exactly one distinct box — the final one — for the dialog's whole life |
| T8 | must-follow-the-container (Playwright) | render narrow (even split), widen the container past `2 × Wmax` | layout becomes natural, right-justified |
| T8b | must-honor-forced-layout | `layout="equal"` in a wide container | equal-width, uncapped; no natural flip when resized |
| T9 | must-focus-initial-on-mount + must-default-focus-to-safe-button | mount non-destructive | confirm button is `document.activeElement` |
| T10 | must-default-focus-to-safe-button | mount with `destructive` | cancel button is `document.activeElement` |
| T11 | must-not-focus-when-suppressed | mount with `focusOnMount={false}` | neither button receives focus |
| T12 | must-show-busy-indicator | `busy`, attempt to click | `role="status"` spinner present; no buttons; `onConfirm`/`onCancel` not called |
| T13 | must-style-confirm-destructive | `destructive` | confirm button uses destructive variant |
| T14 | must-settle-before-interactive | mount, then fire a window resize | the row's and buttons' class lists are byte-identical before and after |

## Edge Cases

- **Empty or zero-width labels**: a button with no content collapses to its padding,
  which is its natural width; the cap is simply small and the other button takes the
  slack. There is no "unmeasured" state to guard against, because nothing is measured.
- **Confirm-only**: with no `cancelLabel`, the lone confirm button sits at its natural
  width on the right. Forced-equal still does not stretch it.
- **One button outgrows its half, the other does not**: the small one settles at its
  natural width and the large one takes the remainder, instead of both snapping to an
  even split and truncating the large one. This is the one behavioural difference from
  the previous `2 × Wmax` threshold, and it is strictly the better answer.
- **Boundary width**: there is no threshold to sit exactly on. The row passes
  continuously between the two shapes as the container narrows, so no flicker band
  exists.
- **Busy**: the spinner path renders no buttons at all, so the layout question does
  not arise.
- **Label change**: a longer label changes the button's natural width, and the layout
  engine re-resolves during the same layout pass that reflows the text — there is no
  second pass to observe.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `confirmLabel` | `string` | — (required) | Confirm button text. |
| `onConfirm` | `() => void` | — (required) | Confirm handler. |
| `cancelLabel` | `string` | — | Cancel button text; omit to render confirm only. |
| `onCancel` | `() => void` | — | Cancel handler. |
| `confirmVariant` | `Button["variant"]` | `"default"` | Confirm variant when not destructive. |
| `destructive` | `boolean` | `false` | Confirm uses the destructive variant; default focus moves to Cancel. |
| `busy` | `boolean` | `false` | Replace buttons with a status spinner; suppress clicks. |
| `initialFocus` | `"confirm" \| "cancel"` | `destructive ? "cancel" : "confirm"` | Which button gets focus on mount. |
| `focusOnMount` | `boolean` | `true` | When false, do not auto-focus (host focuses its own field). |
| `layout` | `"auto" \| "equal" \| "natural"` | `"auto"` | `auto` lets CSS resolve the rule per alert-and-dialog §Layout; `equal`/`natural` force one shape. |

## Logging

No logging. `DialogActions` is a presentational footer; success/error telemetry
belongs to the host's `onConfirm`/`onCancel` handlers, not to the component.

## Platform Notes

- File: `websites/shared/ui/src/components/dialog-actions.tsx`.
- `"use client"` — it uses `useEffect` and refs for the initial-focus placement.
  It holds no layout state and starts no observers.
- Depends on the shared `Button` (`./button`) and `Loader2` from `lucide-react`.
- Demo: `ui-showcase` Topic `dialog-actions` (regenerate `sources.generated.ts`
  via `gen-sources.py` after source changes).
- The layout rule is the shared implementation of **alert-and-dialog §Layout**;
  hosts (e.g. the invitation modal) may force `layout="equal"` per their own spec.

## Design Decisions

- **Container-driven, not a media query.** The layout depends on the container's own
  width and the buttons' content, which a viewport media query cannot know.
- **Resolved in CSS, not measured in JavaScript.** `flex-1 max-w-max` in a
  `justify-end` row states the rule directly — grow into your share, stop at your
  natural width, let the slack collect on the left — and the layout engine answers it
  during first layout, for free, at every container width.

  This replaced a measured implementation, and the reason is worth keeping. That
  version rendered the row equal-width, then read each button's natural width in a
  layout effect by moving it to `position: fixed; left: -9999px`, and flipped the row
  via `setState`. It was documented here as "a reversible, invisible read." It was
  neither. The `getBoundingClientRect()` call forced a reflow, which gave each button
  a resolved *previous* width and so armed `Button`'s `transition-all`; the flip
  became a ~150ms animation that started only once the dialog was on screen and
  clickable. Instrumented in Chromium, Cancel travelled 268px to the right while
  shrinking from 198px to 64px — and it held the wrong position for four frames
  (55ms → 122ms) before the slide began, long enough to look settled. A click aimed
  there lands on bare dialog surface after the button has left, and the dialog just
  sits there, apparently ignoring you. It surfaced as a rare e2e flake; it was a real
  defect for anyone quick with a mouse.

  The general lesson: **deciding your own layout after you are already interactive is
  a race with your user.** Prefer a declarative rule the engine resolves before the
  first paint over a measure-then-correct effect.
- **No exported layout helper.** The old `decideActionLayout(containerWidth,
  maxButtonWidth)` existed so the threshold could be unit-tested without a real
  layout. With the rule in CSS there is no threshold to test in isolation — the
  contract is now the class list (asserted in unit tests) plus the settled geometry
  (asserted in the browser).
- **Safe default focus.** Non-destructive confirms focus the confirm button;
  destructive actions focus Cancel so an accidental Enter can't trigger a
  dangerous confirm. `focusOnMount={false}` yields focus to form dialogs.
- **Busy short-circuit.** Rendering the spinner instead of the buttons keeps the
  in-flight state simple and prevents double-submit.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (uses shared `Button`, no bespoke UI) | pass | project-guidelines UI |
| Keyboard operable + deliberate initial focus + `role="status"` busy | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the measured equal-vs-natural layout, initial focus, resize re-measure, and busy state. |
| 1.1.0 | 2026-07-27 | Mike Fullerton | Layout moved from a measure-then-flip layout effect to a pure CSS rule (`flex-1 max-w-max` in a `justify-end` row). Removes the post-paint 268px slide that could swallow a click aimed at Cancel. Drops the exported `decideActionLayout` helper and the `ResizeObserver`. |
