---
id: f679a77e-04f7-4e43-b898-6d78a637a760
title: DialogActions
domain: agenticdeveloperhub://recipes/dialog-actions
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Two-button dialog footer with measured layout — equal-width when narrow, natural-width right-justified when wide — plus initial focus and resize re-measure."
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

`DialogActions` (`@adh-shared/ui`) is the standard footer for a dialog or alert:
a cancel button (optional) and a confirm button, laid out per the measured rule
in **alert-and-dialog §4**. It measures the natural (content-driven) width of
each button and the container's own width, then chooses one of two layouts:

- **equal-width** — each button gets `flex-1` and the row fills the container
  (`[ Cancel ][ Confirm ]`), used when the container is narrow.
- **natural-width, right-justified** — the buttons keep their content width and
  hug the right edge (`justify-end`), used when the container is wide enough that
  equal-width buttons would look stretched.

The threshold is `containerWidth > 2 × maxButtonWidth → natural`, otherwise
`equal`, exposed as the pure, unit-testable helper `decideActionLayout`. The
component re-measures via a `ResizeObserver`, sets initial focus on mount
(defaulting to the safe button), and renders a spinner while `busy`.

Two symbols ship from `@adh-shared/ui/components/dialog-actions`:

- `DialogActions` — the component.
- `decideActionLayout(containerWidth, maxButtonWidth)` — the pure layout decision,
  exported so the equal-vs-natural rule can be unit-tested without a real layout.

## Behavioral Requirements

- **must-render-confirm**: The component MUST always render a confirm button labeled with `confirmLabel` that invokes `onConfirm` when activated.
- **must-render-cancel-when-labeled**: The component MUST render a cancel button that invokes `onCancel` when `cancelLabel` is provided, and MUST omit the cancel button entirely when `cancelLabel` is absent.
- **must-equal-width-when-narrow**: In `auto` layout with two buttons, when the container width is at most twice the larger natural button width, the component MUST lay the buttons out equal-width (each `flex-1`) filling the container.
- **must-natural-width-when-wide**: In `auto` layout with two buttons, when the container width exceeds twice the larger natural button width, the component MUST keep both buttons at their natural width and right-justify the row.
- **must-measure-natural-width**: The component MUST derive each button's natural width from its intrinsic content size, unaffected by the `flex-1` stretch applied in equal-width mode.
- **must-remeasure-on-resize**: The component MUST re-measure and re-decide the layout when its container is resized.
- **must-honor-forced-layout**: When `layout` is `equal` or `natural`, the component MUST use that layout without measuring, and MUST NOT re-measure on resize.
- **must-focus-initial-on-mount**: When `focusOnMount` is true, the component MUST move focus on mount to the button named by `initialFocus`.
- **must-default-focus-to-safe-button**: When `initialFocus` is unset, the component MUST default initial focus to the confirm button normally and to the cancel button when `destructive` is true.
- **must-not-focus-when-suppressed**: When `focusOnMount` is false, the component MUST NOT move focus on mount, leaving the host to place focus.
- **must-style-confirm-destructive**: When `destructive` is true, the confirm button MUST render with the destructive variant.
- **must-show-busy-indicator**: When `busy` is true, the component MUST replace the buttons with a status spinner exposing an accessible working label, and MUST NOT invoke `onConfirm` or `onCancel`.

## Appearance

Narrow container (`container ≤ 2 × Wmax`) → equal-width, filling the row:

```
┌───────────────────────────────┐
│ [   Cancel   ][   Confirm   ]  │   each flex-1
└───────────────────────────────┘
```

Wide container (`container > 2 × Wmax`) → natural width, right-justified:

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

- Row: `flex items-center gap-3`; `w-full` in equal mode, `justify-end` in natural
  and busy modes.
- Buttons are the shared `Button` at `size="sm"`. Cancel is `variant="outline"`;
  confirm is `destructive` when `destructive`, else `confirmVariant` (default
  `"default"`, the gold primary).
- `data-slot="dialog-actions"` on the row for host styling/targeting.
- Busy spinner: `Loader2` at `size-4 animate-spin`, muted token color.
- No raw hex; no `!important` — buttons carry all color via `Button` variants.

## States

| State | Appearance change |
|---|---|
| Idle, narrow container | equal-width `[ Cancel ][ Confirm ]`, both `flex-1` |
| Idle, wide container | natural-width, right-justified (`justify-end`) |
| Forced `equal` | always equal-width regardless of container width; no resize measuring |
| Forced `natural` | always natural-width right-justified; no resize measuring |
| Confirm-only (no `cancelLabel`) | single confirm button; equal mode does not stretch it |
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
| T4 | must-equal-width-when-narrow / decideActionLayout | `decideActionLayout(200, 120)` (200 ≤ 240) | `"equal"` |
| T5 | must-natural-width-when-wide / decideActionLayout | `decideActionLayout(300, 120)` (300 > 240) | `"natural"` |
| T6 | must-measure-natural-width (Playwright) | render narrow, then confirm both buttons carry `flex-1` | equal-width layout, container filled |
| T7 | must-remeasure-on-resize (Playwright) | render narrow (equal), widen container past `2 × Wmax` | layout flips to natural, right-justified |
| T8 | must-honor-forced-layout | `layout="equal"` in a wide container | equal-width; no natural flip on resize |
| T9 | must-focus-initial-on-mount + must-default-focus-to-safe-button | mount non-destructive | confirm button is `document.activeElement` |
| T10 | must-default-focus-to-safe-button | mount with `destructive` | cancel button is `document.activeElement` |
| T11 | must-not-focus-when-suppressed | mount with `focusOnMount={false}` | neither button receives focus |
| T12 | must-show-busy-indicator | `busy`, attempt to click | `role="status"` spinner present; no buttons; `onConfirm`/`onCancel` not called |
| T13 | must-style-confirm-destructive | `destructive` | confirm button uses destructive variant |
| T14 | decideActionLayout guard | `decideActionLayout(500, 0)` | `"equal"` (non-positive max width) |

## Edge Cases

- **Zero/unmeasured button width**: `decideActionLayout` returns `"equal"` when
  `maxButtonWidth <= 0`, so before measurement (or with empty labels) the row
  defaults to the safe equal-width layout rather than collapsing.
- **Confirm-only**: with no `cancelLabel`, the lone confirm button is not given
  `flex-1` in equal mode, so it does not stretch to fill the row.
- **Boundary width**: at exactly `container == 2 × Wmax` the decision is `"equal"`
  (strict `>` for natural), avoiding a flicker at the threshold.
- **Busy toggled mid-measure**: measurement is skipped while `busy` (and while
  `layout` is forced), so the spinner path never reads button geometry.
- **Label change**: the layout effect re-runs when `cancelLabel`/`confirmLabel`
  change, re-measuring because the natural widths may have changed.
- **Natural-width measurement**: to read a button's content width while it is under
  a `flex-1` stretch, the component momentarily takes it out of flex flow
  (`position:fixed; width:auto; left:-9999px`) to read its intrinsic width, then
  restores the inline styles — a visual no-op.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `confirmLabel` | `string` | — (required) | Confirm button text. |
| `onConfirm` | `() => void` | — (required) | Confirm handler. |
| `cancelLabel` | `string` | — | Cancel button text; omit to render confirm only. |
| `onCancel` | `() => void` | — | Cancel handler. |
| `confirmVariant` | `Button["variant"]` | `"default"` | Confirm variant when not destructive. |
| `destructive` | `boolean` | `false` | Confirm uses the destructive variant; default focus moves to Cancel. |
| `busy` | `boolean` | `false` | Replace buttons with a status spinner; suppress measuring and clicks. |
| `initialFocus` | `"confirm" \| "cancel"` | `destructive ? "cancel" : "confirm"` | Which button gets focus on mount. |
| `focusOnMount` | `boolean` | `true` | When false, do not auto-focus (host focuses its own field). |
| `layout` | `"auto" \| "equal" \| "natural"` | `"auto"` | `auto` measures per §4; `equal`/`natural` force it and skip measuring. |

`decideActionLayout(containerWidth, maxButtonWidth): "equal" | "natural"` is the
exported pure decision: `"equal"` when `maxButtonWidth <= 0` or
`containerWidth <= 2 × maxButtonWidth`, else `"natural"`.

## Logging

No logging. `DialogActions` is a presentational footer; success/error telemetry
belongs to the host's `onConfirm`/`onCancel` handlers, not to the component.

## Platform Notes

- File: `websites/shared/ui/src/components/dialog-actions.tsx`.
- `"use client"` — it uses `useLayoutEffect`, `useEffect`, `useState`, refs, and a
  `ResizeObserver`.
- Depends on the shared `Button` (`./button`) and `Loader2` from `lucide-react`.
- Demo: `ui-showcase` Topic `dialog-actions` (regenerate `sources.generated.ts`
  via `gen-sources.py` after source changes).
- The measured-layout rule is the shared implementation of **alert-and-dialog §4**;
  hosts (e.g. the invitation modal) may force `layout="equal"` per their own spec.

## Design Decisions

- **Measured equal-vs-natural, not a media query.** The layout depends on the
  container's own width and the buttons' content, which a viewport media query
  cannot know. Measuring the container plus intrinsic button widths, then applying
  the `2 × Wmax` threshold, produces the right layout in any dialog size and
  re-derives it via `ResizeObserver` when the container changes.
- **Pure `decideActionLayout` helper.** Extracting the threshold as a pure function
  makes the core rule unit-testable without a DOM/layout and keeps the effect thin.
- **Intrinsic width via temporary un-flexing.** `flex-1` masks a button's content
  width, so measurement momentarily removes each button from flex flow
  (`position:fixed; width:auto`) to read its natural width and restores styles —
  a reversible, invisible read.
- **Safe default focus.** Non-destructive confirms focus the confirm button;
  destructive actions focus Cancel so an accidental Enter can't trigger a
  dangerous confirm. `focusOnMount={false}` yields focus to form dialogs.
- **Busy short-circuit.** Rendering the spinner instead of the buttons (and
  skipping measurement) keeps the in-flight state simple and prevents double-submit.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@adh-shared` (uses shared `Button`, no bespoke UI) | pass | project-guidelines UI |
| Keyboard operable + deliberate initial focus + `role="status"` busy | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the measured equal-vs-natural layout, initial focus, resize re-measure, and busy state. |
