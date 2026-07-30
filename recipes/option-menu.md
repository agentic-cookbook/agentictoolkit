---
id: 4d0e04ff-39eb-472c-93a0-8070f1b64a6a
title: "OptionMenu"
domain: agenticdeveloperhub://recipes/option-menu
type: ingredient
version: 1.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-06-26
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Single-select popup menu with full keyboard navigation and an optional editable Other free-text item."
platforms:
  - typescript
  - web
tags:
  - component
  - option-menu
  - menu
  - ui
depends-on: []
related: []
references: []
---

# OptionMenu

## Overview

`OptionMenu` is a single-select "popup menu": a trigger button that discloses a
list of choices with full keyboard navigation, plus an optional editable
**"Other"** item as the last entry. It is the standard ADH popup menu for forms
(first use: the invitation modal's "How did you hear about the Hub?" field). It
is built by composing existing primitives — `Popover` (surface), `Input` (the
Other field), `Button` (the OK affordance) — with a hand-managed roving
**selection** so the keyboard model below is exact. It deliberately does **not**
build on `DropdownMenu` / Base-UI menu: menu roles hijack typeahead and focus and
fight an embedded text input. It is distinct from the rail filter `PopupMenu`
block (`@agentic-toolkit/ui/blocks/popup-menu`), which keeps its own `allLabel`/`onNew`
filter semantics and is unchanged.

## Behavioral Requirements

- **trigger-opens-on-activation**: When the trigger is focused, Enter / Space / ArrowDown MUST open the surface.
- **open-initializes-selection**: On open, the selection MUST initialize to the committed item if any, else to the first item.
- **arrow-nav-clamps**: When open, ArrowDown / ArrowUp MUST move the selection down/up, clamped at the ends (no wrap).
- **enter-commits-list-item**: When a list item is selected, Enter MUST commit it via `onChange` with `isOther:false`, then close and return focus to the trigger.
- **pointer-click-commits**: A pointer click on a row MUST commit that row immediately and close.
- **escape-closes-without-commit**: Esc MUST close the surface without firing `onChange`.
- **focus-returns-on-close**: On any close, focus MUST return to the trigger.
- **selection-not-commit**: Changing the roving selection MUST NOT fire `onChange`; only a commit (Enter, OK, or row click) fires it.
- **check-marks-committed-value**: While open, the check (✓) MUST mark the committed value.
- **other-input-focused-on-open**: When `allowOther`, the Other input MUST receive focus immediately on open (caret ready to type).
- **typing-moves-check-to-other**: Typing in the Other input MUST set the selection to Other and move the check to Other live, before commit.
- **ok-enabled-when-nonempty**: The OK button MUST be enabled iff the Other input is non-empty after trim.
- **arrowup-from-other-moves-to-list**: ArrowUp from the Other input MUST move the selection to the last list item above Other and blur the input.
- **arrowdown-from-last-item-to-other**: ArrowDown from the last list item MUST return the selection to Other and re-focus the input.
- **enter-commits-other-when-nonempty**: When Other is the active selection and its input is non-empty, Enter MUST commit the trimmed text via `onChange` with `isOther:true`, then close.
- **enter-noop-when-other-empty**: When Other is active but the input is empty, Enter MUST be a no-op (matching the disabled OK).
- **ok-equals-enter-for-other**: Clicking OK MUST be equivalent to Enter while Other is active with non-empty input.

## Appearance

Closed:

```
┌─────────────────────────────┐
│ Search engine            ▾  │   ← trigger button (label = current value or placeholder) + chevron
└─────────────────────────────┘
```

Open, no "Other":

```
┌─────────────────────────────┐
│ Search engine            ▴  │
├─────────────────────────────┤
│ ✓ Search engine             │   ← checkmark = committed value
│   Social media              │   ← highlighted row = roving selection
│   Blog post                 │
│   Newsletter                │
└─────────────────────────────┘
```

Open, with editable "Other" as the last item:

```
┌─────────────────────────────┐
│   Search engine             │
│   …                         │
│   Word of mouth             │
│ ✓ Other                     │   ← check moves here once the user types
│   [                      ]  │   ← text input — focused on open
│   [          OK          ]  │   ← disabled until the input is non-empty
└─────────────────────────────┘
```

- Trigger: same visual language as `Select`/`Input` — `apt-border`, `apt-surface` background, `focus-visible` ring `apt-gold/25`, chevron (`ChevronsUpDown` or `ChevronDown`) in `apt-text-muted`.
- Surface: `Popover` content; rows use the dropdown row treatment — highlight `bg-apt-gold/15`, text `apt-text`, check icon `apt-gold`.
- Other input: shared `Input`. OK: shared `Button` (`size="sm"`, `variant="default"` = gold), full width of the surface, `disabled` when empty.
- Spacing from the `--space-*` scale; corners `--shape-corner-small`. No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Trigger closed | label = committed value or placeholder; chevron down |
| Trigger focused | `focus-visible` ring `apt-gold/25` |
| Trigger disabled | dimmed; non-interactive |
| Open, no selection committed | no row checked; first row highlighted |
| Open, row highlighted | `bg-apt-gold/15` on the roving row |
| Open, committed row | ✓ on the committed row |
| Other empty | OK disabled |
| Other non-empty | OK enabled; ✓ on Other |

## Accessibility

- Trigger: `<button>` with `aria-haspopup="listbox"`, `aria-expanded`, `aria-label={ariaLabel}`.
- Surface: `role="listbox"`; rows `role="option"` with `aria-selected` on the committed row and `data-highlighted` on the selection.
- Other input: a labeled `<input>` (`aria-label` from `otherLabel`); the OK button's `aria-disabled` mirrors `disabled`.
- Focus returns to the trigger on close; the selection is announced via `aria-activedescendant` pointing at the highlighted option.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | arrow-nav-clamps, enter-commits-list-item | open, ArrowDown ×2, Enter | the right item commits, surface closes |
| T2 | escape-closes-without-commit | open, Esc | no `onChange`; trigger refocused |
| T3 | pointer-click-commits | click a row | that row commits, closes |
| T4 | other-input-focused-on-open | open with `allowOther` | Other input is focused |
| T5 | ok-enabled-when-nonempty | type into Other | OK enabled; empty → disabled |
| T6 | typing-moves-check-to-other | type into Other | check moves to Other |
| T7 | enter-commits-other-when-nonempty | type "Foo", Enter | commits "Foo" with `isOther:true` |
| T8 | arrowup-from-other-moves-to-list | ArrowUp from Other input | selection to last list item; input blurred |
| T9 | open-initializes-selection | controlled `value` = an item | that item resolves checked |
| T10 | check-marks-committed-value | controlled `value` = Other free text | Other checked, input prefilled |

## Edge Cases

- **Value resolution.** If `value` equals some `items[i].value`, that item is the committed/checked row. Else if `allowOther` and `value` is non-null, Other is the committed row and its input prefills with `value`. Else nothing is checked.
- Free text identical to an item value resolves to the item; callers needing to distinguish should avoid colliding labels.
- `value = null` → nothing is checked.
- `allowOther = false` with no matching item → nothing is checked.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `OptionMenuItem[]` | — | The selectable items (`{ value, label }`). |
| `value` | `string \| null` | — | Committed value: an item value, free text (when `allowOther`), or null. |
| `onChange` | `(value: string, meta: { isOther: boolean }) => void` | — | Fired on commit; `isOther` true when from the Other input. |
| `allowOther` | `boolean` | `false` | Enables the editable Other row. |
| `otherLabel` | `string` | `"Other"` | Label for the Other row. |
| `otherPlaceholder` | `string` | — | Placeholder for the Other input. |
| `placeholder` | `string` | — | Trigger text when `value` is null. |
| `ariaLabel` | `string` | — | Required; labels the trigger + listbox. |
| `disabled` | `boolean` | `false` | Disables the control. |
| `className` | `string` | — | Extra classes. |

## Logging

No logging. OptionMenu is a presentational form control; it emits no structured log events.

## Platform Notes

- New file: `websites/shared/ui/src/components/option-menu.tsx`.
- Export: covered by the existing `./components/*` wildcard in `websites/shared/ui/package.json` (no export change needed).
- Demo: `websites/local/ui-showcase/app/page.tsx` (+ showcase source registry).
- Consumed first by: the invitation modal (hub).
- Responsive: verify via Playwright (ui-showcase) at 375 / 768 / 1440 — keyboard-only and pointer flows on each.

## Design Decisions

- **Hand-managed roving selection, not a menu role.** Selection (the highlighted row) is tracked in component state independent of DOM focus, so arrow keys work whether focus is on a row or in the Other input. Building on `DropdownMenu` / Base-UI menu was rejected because menu roles hijack typeahead and focus and fight an embedded text input.
- **Selection vs. commit are distinct.** Selection is a transient highlight that never fires `onChange`; only commit (Enter, OK, row click) fires `onChange` and closes.

## Compliance

No additional compliance categories apply to this presentational control.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
