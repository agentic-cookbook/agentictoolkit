---
id: 79f7ed30-3193-49bc-856b-d7dd01303baa
title: EntityChooser
domain: agenticdeveloperhub://recipes/entity-chooser
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "Browse/filter/select/add surface for account categories or tags — a single-value picker or a multi-select chip set, composed over ListChooser."
platforms:
- typescript
- web
tags:
- component
- entity-chooser
- chooser
- tags
- ui
depends-on:
- agenticdeveloperhub://recipes/list-chooser
related:
- agenticdeveloperhub://recipes/list-chooser
- agenticdeveloperhub://recipes/combobox
- agenticdeveloperhub://recipes/recipient-input
references: []
---

# EntityChooser

## Overview

`EntityChooser` is a browse / filter / select / add surface for a list of string
entities — the account's categories or tags. It is a thin composition over
`ListChooser` (`@agentic-toolkit/ui/components/list-chooser`), which supplies the
disclosed, text-filtered list with a roving keyboard highlight and an "add a new
one" affordance. `EntityChooser` adds only the **selection semantics** on top:

- **single** mode is a one-value picker — selecting (or creating) replaces the
  value, exposed through a unified `string | null` callback.
- **multi** mode maintains an ordered **set**, rendered as removable chips beside a
  `Choose…` trigger that adds one entry per open. Already-selected options are
  hidden from the browser, so a member can't be added twice.

It never re-implements the list or keyboard logic — that lives in `ListChooser`. It
is the editor half of the `[Combobox autocomplete] [Choose…]` field pattern (first
use: the research category + tag fields), where a `Combobox` does inline typeahead
and `EntityChooser`'s trigger opens the full browse/add surface over the same
options. It differs from `RecipientInput` (a free-text chip input with no backing
option list or filtered browser) and from `ListChooser` (single-value only, no chip
set, value-bearing trigger).

## Behavioral Requirements

- **single-selects-one-value**: In single mode, accepting an option or a created entry MUST report it through `onChange(next)` as the new value, replacing any prior one.
- **single-shows-trigger-label-when-null**: In single mode, when the value is `null` the trigger MUST show the configured trigger label.
- **multi-adds-to-set**: In multi mode, accepting an option or a created entry MUST append it to the set via `onChange([...value, entry])`.
- **multi-never-duplicates**: In multi mode, an entry already in the set MUST NOT be added again — no duplicate and no `onChange`.
- **multi-hides-selected-options**: In multi mode, options already in the set MUST be omitted from the browser's list so they cannot be re-offered.
- **multi-renders-removable-chips**: In multi mode, the current set MUST render as chips, each with a control labelled `Remove <value>` that removes that entry via `onChange`.
- **multi-shows-empty-hint**: In multi mode, when the set is empty the chip area MUST show the empty-selection hint instead of chips.
- **delegates-browse-to-list-chooser**: Filtering, the roving-keyboard highlight, OK/Cancel, and add-new MUST be delegated to the embedded `ListChooser`, not re-implemented.
- **allow-create-passthrough**: When `allowCreate` is false, typed text matching no option MUST NOT be acceptable (no create row); the setting is forwarded to `ListChooser`.
- **disabled-blocks-interaction**: When `disabled`, the trigger and every chip-remove control MUST be non-interactive.

## Appearance

Single (closed):

```
┌─────────────────────────────┐
│ architecture            ▾   │   ← trigger: the chosen value, or the trigger label
└─────────────────────────────┘
```

Multi:

```
┌──────────┐ ┌──────────┐ ┌───────────┐
│ vision ✕ │ │ rlhf  ✕  │ │ Choose… ▾ │   ← chips (removable) + the add trigger, inline
└──────────┘ └──────────┘ └───────────┘
```

Open (both modes) — the embedded `ListChooser` surface:

```
┌─────────────────────────────┐
│ [ att|                    ]  │   ← filter/add field (focused on open)
├─────────────────────────────┤
│   attention                 │   ← filtered list (selected options omitted in multi)
│ + Add “att”                 │   ← create row, when text matches no option
├─────────────────────────────┤
│              Cancel    OK   │
└─────────────────────────────┘
```

- Trigger, surface, list rows, create row, and button bar are entirely `ListChooser`'s
  treatment (`apt-border`/`apt-bg`, `apt-gold` highlight + check, `ChevronsUpDown`).
- Chips are the shared `Badge` (`variant="neutral"`) with a trailing `X` remove
  button in `apt-text-muted` → `apt-text` on hover — matching `RecipientInput`'s chips.
- Multi lays chips and the `Choose…` trigger in one `flex-wrap` row; the trigger is
  auto-width (`w-auto`) so it sits after the chips rather than filling the row.
- All color via `apt-*` tokens; no raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Single, value set | trigger shows the value; the matching list row shows ✓ when open |
| Single, value null | trigger shows the trigger label (e.g. "Choose…") |
| Multi, empty set | empty-selection hint (e.g. "No tags yet") + the Choose trigger |
| Multi, non-empty set | one chip per entry + the Choose trigger |
| Browser open | `ListChooser` popover: focused field, filtered list, OK/Cancel |
| `allowCreate` off, no match | no create row; OK disabled; Enter a no-op |
| Disabled | trigger + chip-remove controls dimmed and non-interactive |

The control is synchronous over the in-memory `options` prop — loading/error states
belong to the caller that fetches the options (mirroring `ListChooser` /
`RecipientInput`).

## Accessibility

- The embedded `ListChooser` provides the combobox/listbox semantics: trigger
  `aria-haspopup="listbox"` + `aria-expanded`, the filter field `role="combobox"`
  with `aria-controls` / `aria-activedescendant`, and `role="listbox"` / `role="option"`
  rows. Focus moves to the field on open and returns to the trigger on close.
- The trigger is labelled by `ariaLabel`; the filter/add field by `inputLabel`
  (falling back to `ariaLabel`).
- Multi mode wraps the chips + trigger in a `role="group"` labelled by `ariaLabel`;
  each chip's remove control is a `<button>` with `aria-label="Remove <value>"`.
- Keyboard operability (arrows, Enter, Esc, OK/Cancel) is inherited unchanged from
  `ListChooser`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | single-selects-one-value, delegates-browse-to-list-chooser | single, open, click "engineering" | `onChange("engineering")`; browser closes |
| T2 | single-selects-one-value, allow-create-passthrough | single, type "design", Enter | `onChange("design")` |
| T3 | allow-create-passthrough | single, `allowCreate=false`, type "nope", Enter | no `onChange` |
| T4 | single-shows-trigger-label-when-null | single, `value="research"` | trigger shows "research" |
| T5 | multi-renders-removable-chips, multi-shows-empty-hint | multi, `value=[]` then `["vision"]` | empty hint, then a "vision" chip |
| T6 | multi-adds-to-set | multi, `value=["vision"]`, open, click "attention" | `onChange(["vision","attention"])` |
| T7 | multi-hides-selected-options | multi, `value=["vision"]`, open | no "vision" option; "attention" present |
| T8 | multi-renders-removable-chips | multi, `value=["vision","attention"]`, click "Remove vision" | `onChange(["attention"])` |
| T9 | multi-never-duplicates | multi, `value=["vision"]`, type "vision", Enter | no `onChange` |

## Edge Cases

- **Created multi entry already present.** A typed entry equal to an existing member
  is rejected by the dedupe guard even though it's hidden from the list, so a stale
  type can't duplicate it.
- **Single free text vs. option.** A single `value` that matches no option still shows
  on the trigger as free text (inherited from `ListChooser`'s value resolution).
- **Empty options.** With no options, an empty filter shows `ListChooser`'s empty
  message; typing surfaces the create row when `allowCreate`.
- **Trigger label vs. value.** In multi mode the trigger always reads the trigger
  label (the inner `ListChooser` value is held at `null`); in single mode it reflects
  the chosen value.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `options` | `readonly string[]` | — | The selectable entities (e.g. the account's categories or tags). |
| `multiple` | `boolean` | `false` | Discriminates single-value vs. multi-select-set mode. |
| `value` | `string \| null` (single) / `string[]` (multi) | — | The current selection. |
| `onChange` | `(next: string \| null) => void` (single) / `(next: string[]) => void` (multi) | — | Fired with the new selection. |
| `ariaLabel` | `string` | — | Required; labels the trigger, the listbox, and (multi) the chip group. |
| `triggerLabel` | `string` | `"Choose…"` | Trigger text (and the placeholder shown when a single value is null). |
| `inputLabel` | `string` | `ariaLabel` | Accessible label for the filter/add field. |
| `placeholder` | `string` | `ListChooser` default | Placeholder for the filter/add field. |
| `allowCreate` | `boolean` | `true` | Whether text matching no option can be accepted as a new entry. |
| `createLabel` | `(text: string) => string` | `ListChooser` default | Builds the create-row label. |
| `emptyLabel` | `string` | `ListChooser` default | Browser "no matches" message. |
| `emptySelectionLabel` | `string` (multi) | `"Nothing selected yet"` | Hint shown when the set is empty. |
| `disabled` | `boolean` | `false` | Disables the control. |
| `className` | `string` | — | Extra classes (single: the trigger; multi: the chip+trigger group). |

## Logging

No logging. EntityChooser is a presentational form control; it emits no structured log events.

## Platform Notes

- New file: `websites/shared/ui/src/components/entity-chooser.tsx`.
- Export: covered by the existing `./components/*` wildcard in `websites/shared/ui/package.json` (no export change needed).
- Demo: `websites/local/ui-showcase/app/page.tsx` (+ showcase source registry via `gen-sources.py`).
- Consumed first by: the hub research category + tag fields (`ResearchDetail`), paired with `Combobox`.
- Responsive: verify via Playwright (ui-showcase) at 375 / 768 / 1440 — keyboard-only and pointer flows on each.

## Design Decisions

- **Compose `ListChooser`, don't fork it.** All list, filter, roving-keyboard, and
  add-new behavior is `ListChooser`'s; `EntityChooser` only layers selection
  semantics (single value vs. set + chips). One authoritative home for the
  list/keyboard logic; the chooser stays disposable.
- **Multi = repeated single-add, not a bespoke multi-select.** Rather than re-writing
  `ListChooser` to keep its popover open and toggle rows (a different keyboard model),
  multi mode reuses the single-accept engine: each open adds one entry, the set lives
  in the parent, and selected options are hidden so the browser never re-offers them.
  Simpler, fully accessible, zero duplication of keyboard logic.
- **Chips reuse `Badge` + the `RecipientInput` remove pattern** (`Remove <value>`),
  so tag editing looks and reads the same everywhere.
- **`value=null` on the inner `ListChooser` in multi mode** keeps the trigger reading
  "Choose…" (an add affordance) rather than echoing a single committed value.
- **No built-in async state.** `options` is a controlled in-memory prop; the caller
  owns fetching/loading/error — consistent with the sibling form controls.

## Compliance

No additional compliance categories apply to this presentational control.

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial component + recipe. |
