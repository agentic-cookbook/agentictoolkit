---
id: 169da1b6-2a22-4fec-9f01-8118e5242bd5
title: ReactionBar
domain: agenticdeveloperhub://recipes/reaction-bar
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-08-08'
modified: '2026-08-08'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The emoji reactions on one subject — count chips that toggle plus a small palette; presentational, so the caller owns the tallies and the write."
platforms:
- typescript
- web
tags:
- component
- reactions
- emoji
- toggle
- ui
depends-on: []
related:
- agenticdeveloperhub://recipes/button
- agenticdeveloperhub://recipes/removable-chip
references: []
---

# ReactionBar

## Overview

The shared `ReactionBar` in `@agentic-toolkit/ui` — the emoji reactions on **one subject**,
rendered as a row of count chips plus a small palette for adding one. It is the single home
for the reaction treatment, so a work-item comment, a discussion post and anything else the
backend's polymorphic reaction store can name all react the same way.

The component is **presentational**, like the rest of the package: it receives the tallies
already folded (`{ emoji, count, mine }`) and calls back with an emoji. It never fetches, never
writes, and holds no reaction state — the only state it owns is whether its palette popover is
open. That is what keeps one bar reusable across subjects that have nothing else in common.

A chip is a **toggle, not a counter**. Pressing a chip you are already part of takes your
reaction back; pressing one you are not adds it. Both directions call the same `onToggle` with
the same argument, because the caller can already tell which way it goes from the `mine` flag it
supplied — two callbacks would be two chances for them to disagree.

Two exports ship from `@agentic-toolkit/ui/components/reaction-bar`: the `ReactionBar`
component and `DEFAULT_REACTIONS`, the default palette, exported so a host starts from one
fact rather than restating a literal per surface.

## Behavioral Requirements

- **renders-one-chip-per-tally**: The component MUST render exactly one chip per entry in `reactions`, in the order given — it MUST NOT sort, merge or filter them.
- **chip-shows-emoji-and-count**: Each chip MUST show its emoji and its count.
- **chip-is-a-toggle**: Activating a chip MUST invoke `onToggle` with that chip's emoji, whether or not the viewer has already reacted with it.
- **announces-own-reaction**: A chip whose `mine` is true MUST carry `aria-pressed="true"`, and a chip whose `mine` is false MUST carry `aria-pressed="false"`.
- **stateless-tallies**: The component MUST NOT change a count or a `mine` flag itself; it only signals `onToggle`, leaving the write and the re-read to the consumer.
- **palette-offers-choices**: The component MUST render a palette trigger that opens a popover offering `choices` (default `DEFAULT_REACTIONS`).
- **palette-uses-the-same-toggle**: Picking an emoji from the palette MUST invoke `onToggle` with that emoji — the same call a chip makes — and MUST close the popover.
- **palette-offers-everything**: The palette MUST offer every entry in `choices`, including emoji already present on the subject, so it never has to explain an absence.
- **busy-goes-inert**: When `busy`, every chip and the palette trigger MUST be disabled, and the bar MUST keep rendering the same chips in the same order.
- **disabled-hides-the-way-in**: When `disabled`, the counts MUST still render and the palette trigger MUST NOT render at all.
- **names-the-subject**: Every control's accessible name MUST include `subjectLabel`, so two bars on one page are distinguishable.
- **glyph-is-decorative**: The emoji glyph inside a control MUST be `aria-hidden`, leaving the control's `aria-label` as its sole accessible name.

## Appearance

```
 ┌─────────┐ ┌─────────┐
 │ 👍  3   │ │ 🎉  1   │  ☺+       ← chips (pressed / not) + palette trigger
 └─────────┘ └─────────┘
   mine        theirs    add

        ┌──────────────────────┐
        │ 👍 🎉 👀 🙏 😄 ❤️  │   ← the popover palette
        └──────────────────────┘
```

- Row: `flex flex-wrap items-center gap-1`, so a long set wraps rather than scrolls.
- Chip: the shared `Button` at `size="xs"`, `rounded-full border px-2`. A chip the viewer is
  part of is `variant="secondary"` with `border-apt-gold`; one they are not is `variant="ghost"`
  with `border-apt-border`. The count is `tabular-nums text-apt-text-dim`, so a count crossing
  9 → 10 does not shift the row.
- Palette trigger: a `size-6` circular `PopoverTrigger` holding a lucide `SmilePlus` at 14px,
  `text-apt-text-muted` brightening to `text-apt-text` on hover/focus, with an
  `apt-gold/25` focus ring.
- Palette: `PopoverContent` at `w-auto p-1.5`, aligned to the trigger's start, holding one
  `size="icon-xs"` ghost `Button` per choice.
- No raw hex; no arbitrary colors; no `!important`.

## States

| State | Appearance change |
|---|---|
| Rest, not yours | Ghost chip, `border-apt-border` |
| Rest, yours | Secondary (filled) chip, `border-apt-gold`, `aria-pressed="true"` |
| Chip hover / focus-visible | The shared `Button`'s own hover and focus treatment |
| Palette open | The popover renders below/beside the trigger, aligned to its start |
| Busy (write in flight) | Every chip and the trigger disabled; the row is otherwise unchanged |
| Disabled (viewer may not react) | Chips render and are disabled; the palette trigger is absent |
| No reactions yet | No chips; the palette trigger alone |

## Accessibility

- Each chip is a real `<button type="button">` with `aria-pressed`, so it reads as a toggle
  rather than as a link or a plain button — the pressed state is announced, not merely coloured.
- A chip's accessible name is `"<emoji> <count> on <subjectLabel>"`, and the palette's controls
  are `"React to <subjectLabel>"` and `"React <emoji> to <subjectLabel>"`. The subject is in
  every name because a page shows many bars, and "👍 3" alone does not say which comment.
- The name states the emoji, the count and the subject — never the interaction ("click to…"):
  the role and `aria-pressed` already carry that, and a screen reader would otherwise read the
  instruction on every chip.
- The glyph inside each control is `aria-hidden`, so AT is not told the emoji's CLDR name twice.
- The palette trigger is the `PopoverTrigger` primitive **styled directly**, not a `Button`
  wrapped in one, so there is a single focusable element rather than two nested.
- `busy` disables rather than removes: a bar that dropped its chips mid-write would move the
  pointer's target between the press and the result.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | renders-one-chip-per-tally, chip-shows-emoji-and-count, names-the-subject | `reactions=[{👍,2,mine},{🎉,1}]`, `subjectLabel="Ada's comment"` | buttons named `👍 2 on Ada's comment` and `🎉 1 on Ada's comment` |
| T2 | announces-own-reaction | same as T1 | the 👍 chip has `aria-pressed="true"`; the 🎉 chip `"false"` |
| T3 | chip-is-a-toggle | click the 👍 chip (the viewer's own) | `onToggle` called with `"👍"` |
| T4 | stateless-tallies | after T3 without a consumer re-render | the chip still reads `2` and still reads pressed |
| T5 | palette-offers-choices, palette-uses-the-same-toggle | open the palette, pick `DEFAULT_REACTIONS[1]` | `onToggle` called with that emoji; the popover closes |
| T6 | palette-offers-everything | open the palette while 👍 is on the subject | 👍 is still offered in the palette |
| T7 | busy-goes-inert | `busy` | every chip is `disabled`; the same two chips are still present, in order |
| T8 | disabled-hides-the-way-in | `disabled` | the chips render; no control named `React to <subject>` exists |
| T9 | renders-one-chip-per-tally | `reactions=[]` | no chip; the palette trigger alone |
| T10 | glyph-is-decorative | inspect a chip's glyph | the emoji `<span>` carries `aria-hidden` |
| T11 | names-the-subject (Playwright) | two bars with different `subjectLabel` | each bar's chips are addressable by name without ambiguity |

## Edge Cases

- **A count reaching zero is the consumer's problem.** The bar renders what it is given; a
  tally that drops to zero should be dropped from `reactions` by the caller, not rendered as
  "👍 0".
- **An emoji not in `choices`.** A subject can carry an emoji the palette does not offer (an
  older palette, another client). It renders and toggles normally — `choices` governs what can
  be *added*, not what can be shown.
- **A repeat press.** The bar does not debounce; a caller that can have two writes in flight
  passes `busy` while one is running.
- **Signed out.** `disabled` keeps the counts (they are public) and removes the way in, rather
  than hiding the bar — a subject with reactions still shows them.
- **A long set.** The row wraps (`flex-wrap`). A palette long enough to need a grid is a
  different component (a picker), which is why `DEFAULT_REACTIONS` is deliberately short.
- **Duplicate emoji in `reactions`.** Not deduplicated here — React would warn on the repeated
  key. The fold that produces the tallies owns uniqueness.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `reactions` | `ReactionBarItem[]` | — | The subject's tallies, in the order they should read. Required. |
| `onToggle` | `(emoji: string) => void` | — | Add the emoji when the viewer has not reacted with it, take it back when they have. Required. |
| `subjectLabel` | `string` | — | Names the subject in every control's accessible name. Required. |
| `choices` | `readonly string[]` | `DEFAULT_REACTIONS` | What the palette offers. |
| `busy` | `boolean` | `false` | A write is in flight: everything is inert, nothing is hidden or re-ordered. |
| `disabled` | `boolean` | `false` | The viewer may not react; counts still show, the palette trigger is not rendered. |
| `className` | `string` | — | Extra classes for the row; merged via `cn()`. |

`ReactionBarItem` is `{ emoji: string; count: number; mine: boolean }`.

## Logging

No logging. `ReactionBar` is presentational; what a toggle means, and any telemetry about it,
belong to the consumer's `onToggle` handler.

## Platform Notes

- File: `packages/web/packages/ui/src/components/reaction-bar.tsx`, exported from
  `@agentic-toolkit/ui/components/reaction-bar` via the package's `./components/*` wildcard.
- Composes the shared `Button` and `Popover`/`PopoverTrigger`/`PopoverContent`, plus a lucide
  `SmilePlus` icon; carries `"use client"` (it owns the popover's open state).
- First consumer: `WorkItemComments` in `@agentic-toolkit/projects`, which folds
  `content.reactions` rows into `ReactionBarItem[]` with `tally()` from
  `@agentic-toolkit/data/reactions`.
- Demo: `ui-showcase` Topic `reaction-bar`, in the "Composite controls" group (regenerate
  `sources.generated.ts` via `gen-sources.py` after source changes).
- Web/TypeScript only; token-driven so it themes with the rest of `@agentic-toolkit/ui`.

## Design Decisions

- **One `onToggle`, not `onAdd` + `onRemove`.** The caller already knows which way the press
  goes — it supplied `mine`. A second callback would let the two disagree and would push the
  same decision into every consumer.
- **The bar holds no tallies.** Optimistically mutating a count here would fork the truth: the
  server's answer arrives moments later and the bar would have to reconcile a state it does not
  own. Keeping it presentational is also what lets one component serve every subject kind.
- **`aria-pressed` rather than colour alone.** The pressed/not distinction is the whole
  interaction; a border tint states it only to people who can see it.
- **The palette trigger is the primitive, styled.** Wrapping a `Button` inside a
  `PopoverTrigger` nests two focusable elements; styling the trigger directly is the sibling
  `OptionMenu` / `SectionHeader` idiom in this package.
- **`DEFAULT_REACTIONS` is exported and short.** Exported so the default palette is one fact
  rather than a literal per surface; short because a long grid is a picker, and a picker is a
  different component.
- **`busy` disables rather than hides.** Removing chips mid-write moves the pointer's target
  between the press and its result.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (no bespoke UI) | pass | project-guidelines UI |
| Toggle state announced (`aria-pressed`), not colour-only | pass | accessibility |
| Every control's accessible name names its subject | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-08-08 | Mike Fullerton | Initial recipe; documents the toggle chips, the palette, and the presentational contract. |
