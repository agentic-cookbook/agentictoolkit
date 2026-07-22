---
id: 40827b84-406e-4091-951b-9498b2f78253
title: ListChooser
domain: agenticdeveloperhub://recipes/list-chooser
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Disclosed chooser whose single field filters a list and adds new entries, with arrow-keyed highlight, OK/Cancel, and full keyboard control."
platforms:
- typescript
- web
tags:
- component
- list-chooser
- chooser
- ui
depends-on:
- agenticdeveloperhub://recipes/option-menu
related:
- agenticdeveloperhub://recipes/combobox
- agenticdeveloperhub://recipes/option-menu
references: []
---

# ListChooser

## Overview

`ListChooser` is a single-select "pick from a list, or add a new one" control. A
trigger button discloses a popover containing one text field plus a filtered list
and an OK / Cancel button bar. The field does double duty: typing narrows the list
to case-insensitive substring matches, and text that matches no item can be
accepted as a brand-new entry (when `allowCreate`). Arrow keys move a roving
highlight through the filtered list and preview the highlighted label in the
field; Enter / OK accept the current selection or entry; Esc / Cancel close
without committing.

It is the keyboard-and-mouse foundation for "choose or create" pickers (first use:
the research category/tag UI). It is built by composing the same primitives as
`OptionMenu` — `Popover` (surface), `Input` (the field), `Button` (OK / Cancel) —
with a hand-managed roving selection, rather than forking `OptionMenu`: that
control has a fixed list with a separate editable "Other" row at the bottom, while
this control's single field _is_ both the filter and the add-new field. It differs
from `Combobox` (`@adh-shared/ui/components/combobox`), an inline free-text input
with a typeahead dropdown and no trigger, list, or OK/Cancel commit step.

## Behavioral Requirements

- **trigger-opens-surface**: Activating the trigger (click, Enter, or Space) MUST open the popover.
- **opens-with-field-focused**: On open, the filter/add field MUST receive focus so the user can type immediately.
- **type-narrows-list**: Typing in the field MUST narrow the list to items whose label contains the typed text as a case-insensitive substring.
- **arrow-roves-highlight**: ArrowDown / ArrowUp MUST move a roving highlight through the filtered list (and the create row when present), clamped at the ends with no wrap.
- **highlight-syncs-into-field**: While a list item is highlighted, the field MUST display that item's label (the highlight is previewed in the field); typing again replaces the preview with the typed text and clears the highlight.
- **enter-accepts-highlighted-item**: When a list item is highlighted, Enter MUST accept it via `onChange` with `isNew:false`, then close.
- **enter-accepts-typed-entry**: When nothing is highlighted, the trimmed text is non-empty and matches no item, and `allowCreate` is set, Enter MUST accept the trimmed text via `onChange` with `isNew:true`, then close.
- **typed-text-resolves-to-exact-item**: When nothing is highlighted and the trimmed text equals an item label (case-insensitive), accept MUST resolve to that item with `isNew:false`, never a new entry.
- **create-unavailable-when-disabled**: When `allowCreate` is false, text matching no item MUST NOT be acceptable — no create row, OK disabled, Enter a no-op.
- **escape-cancels**: Esc MUST close the surface without firing `onChange`.
- **ok-mirrors-enter**: The OK button MUST be equivalent to Enter and MUST be disabled whenever nothing is acceptable.
- **cancel-mirrors-escape**: The Cancel button MUST be equivalent to Esc.
- **pointer-click-commits**: A pointer click on a list row (or the create row) MUST accept it immediately and close.
- **focus-returns-on-close**: On any close, focus MUST return to the trigger.
- **empty-message-when-no-match**: When no item matches and creation is unavailable, the list MUST show the empty message.

## Appearance

Closed:

```
┌─────────────────────────────┐
│ Choose a framework…      ▾  │   ← trigger button (committed label or placeholder) + chevron
└─────────────────────────────┘
```

Open:

```
┌─────────────────────────────┐
│ [ sv|                     ]  │   ← filter/add field — focused on open
├─────────────────────────────┤
│   SvelteKit                 │   ← filtered list (narrowed by the field text)
│ + Add “sv”                  │   ← create row, shown when text matches no item
├─────────────────────────────┤
│              Cancel    OK   │   ← button bar; OK disabled until something is acceptable
└─────────────────────────────┘
```

- Trigger: same visual language as `Select` / `Input` — `apt-border`, `apt-bg` background, `focus-visible` ring `apt-gold/25`, `ChevronsUpDown` in `apt-text-muted`.
- Surface: `Popover` content. The field is the shared `Input`. Rows use the dropdown row treatment — keyboard highlight `bg-apt-gold/15`, pointer hover `bg-apt-gold/10`, text `apt-text`, the committed row's check icon `apt-gold`.
- Create row: a `Plus` glyph (`apt-text-muted`) plus the `createLabel(text)` text.
- Button bar: shared `Button` — Cancel `variant="ghost"`, OK `variant="default"` (gold), separated from the list by an `apt-border` top rule.
- Spacing/radius from the standard scale. No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Trigger closed | label = committed value (item label or free text) or placeholder; chevron |
| Trigger focused | `focus-visible` ring `apt-gold/25` |
| Trigger disabled | dimmed; non-interactive |
| Open, no highlight | field shows the typed text; no row highlighted |
| Open, item highlighted | `bg-apt-gold/15` on the roving row; field previews its label |
| Open, committed row visible | ✓ on the committed item's row |
| Filter matches nothing, `allowCreate` | only the create row shows |
| Filter matches nothing, no create | empty message ("No matches") |
| Nothing acceptable | OK disabled |

The control is synchronous over the in-memory `items` prop, so it has no intrinsic
loading or error state; a caller fetching items owns those and passes the resolved
array (mirroring `OptionMenu` / `RecipientInput`).

## Accessibility

- Trigger: `<button>` with `aria-haspopup="listbox"`, `aria-expanded`, `aria-label={ariaLabel}`.
- Field: a labelled `<input>` (`aria-label` from `inputLabel`, falling back to `ariaLabel`) with `aria-controls` pointing at the list, `aria-autocomplete="list"`, and `aria-activedescendant` pointing at the highlighted option.
- List: `role="listbox"` (labelled by `ariaLabel`); each row `role="option"` with `aria-selected` on the committed row and `data-highlighted` on the roving row. The create row is also a `role="option"`.
- Focus is moved to the field on open and returned to the trigger on close (Base UI `Popover` focus management).

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | type-narrows-list | open, type "sv" | only "SvelteKit" remains; others removed |
| T2 | empty-message-when-no-match | `allowCreate=false`, type "zzz" | no options; empty message shown |
| T3 | arrow-roves-highlight, highlight-syncs-into-field | open, ArrowDown ×2, ArrowUp | activedescendant tracks; field shows the highlighted label |
| T4 | enter-accepts-highlighted-item | open, ArrowDown ×2, Enter | `onChange(value, { isNew:false })`; closes |
| T5 | escape-cancels | open, type, Esc | no `onChange`; listbox gone |
| T6 | enter-accepts-typed-entry | type "  Angular  ", Enter | `onChange("Angular", { isNew:true })` |
| T7 | pointer-click-commits | type "Solid", click create row | `onChange("Solid", { isNew:true })` |
| T8 | typed-text-resolves-to-exact-item | type "react", Enter | `onChange("react", { isNew:false })` |
| T9 | create-unavailable-when-disabled | `allowCreate=false`, type "Nope", Enter | no `onChange` |
| T10 | ok-mirrors-enter | type "Vue", click OK | OK enabled; `onChange(value, { isNew:false })` |
| T11 | cancel-mirrors-escape | open, click Cancel | no `onChange`; listbox gone |

## Edge Cases

- **Highlight preview vs. filter.** Filtering uses the typed text, not the previewed highlight, so arrow-navigating a single match does not collapse the list; typing replaces the preview and re-filters.
- **Value resolution on the trigger.** If `value` equals an `items[i].value`, the trigger shows that item's label. Else if `allowCreate` and `value` is non-null, the trigger shows the free text. Else it shows `triggerPlaceholder`.
- **Whitespace.** The typed text is trimmed before matching and before being accepted as a new entry; whitespace-only text is not acceptable.
- **Empty `items`.** With no items, an empty filter shows the empty message; typing surfaces the create row when `allowCreate`.
- **Clamping.** ArrowUp at the top and ArrowDown at the bottom hold position (no wrap).

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `ListChooserItem[]` | — | The selectable items (`{ value, label }`). |
| `value` | `string \| null` | — | Committed value: an item value, free text (when `allowCreate`), or null. |
| `onChange` | `(value: string, meta: { isNew: boolean }) => void` | — | Fired on accept; `isNew` true when the value is typed text, not an item. |
| `allowCreate` | `boolean` | `true` | Whether text matching no item can be accepted as a new entry. |
| `ariaLabel` | `string` | — | Required; labels the trigger and the listbox. |
| `inputLabel` | `string` | `ariaLabel` | Accessible label for the filter/add field. |
| `placeholder` | `string` | `"Filter or add…"` | Placeholder for the field. |
| `triggerPlaceholder` | `string` | `"Select…"` | Trigger text when `value` is null. |
| `okLabel` | `string` | `"OK"` | Accept button label. |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `createLabel` | `(text: string) => string` | `` `Add “${text}”` `` | Builds the create-row label from the typed text. |
| `emptyLabel` | `string` | `"No matches"` | Shown when nothing matches and creation is unavailable. |
| `disabled` | `boolean` | `false` | Disables the control. |
| `className` | `string` | — | Extra classes for the trigger. |

## Logging

No logging. ListChooser is a presentational form control; it emits no structured log events.

## Platform Notes

- New file: `websites/shared/ui/src/components/list-chooser.tsx`.
- Export: covered by the existing `./components/*` wildcard in `websites/shared/ui/package.json` (no export change needed).
- Demo: `websites/local/ui-showcase/app/page.tsx` (+ showcase source registry).
- Consumed first by: the research category/tag UI.
- Responsive: verify via Playwright (ui-showcase) at 375 / 768 / 1440 — keyboard-only and pointer flows on each.

## Design Decisions

- **Compose `OptionMenu`'s primitives, don't fork it.** The roving selection, `aria-activedescendant`, and Popover-with-trigger shape are shared, but the single field that both filters and creates is a distinct interaction. Subclassing `OptionMenu` (fixed list + bottom "Other" row) would have entangled two models; composing the same primitives keeps each control single-responsibility.
- **Filter on typed text, preview the highlight.** Keeping the filter query separate from the previewed highlight label means arrow-navigation never re-filters the list out from under the user.
- **Selection vs. commit are distinct.** Moving the highlight never fires `onChange`; only an accept (Enter, OK, or row click) commits and closes.
- **No built-in async state.** `items` is a controlled in-memory prop, so loading/error belong to the caller — consistent with the sibling form controls.

## Compliance

No additional compliance categories apply to this presentational control.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial component + recipe. |
