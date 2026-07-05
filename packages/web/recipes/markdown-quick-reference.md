---
id: f5d2eb1c-fb0e-48e3-b124-7e730ac8231c
title: MarkdownQuickReference
domain: agenticdeveloperhub://recipes/markdown-quick-reference
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "An outline-button toolbar control that opens a dismissible popover listing common markdown syntax (headings, bold/italic, code, lists, links, quote)."
platforms:
- typescript
- web
tags:
- markdown
- popover
- help
- reference
- toolbar
depends-on:
- agenticdeveloperhub://recipes/button
related:
- agenticdeveloperhub://recipes/markdown-editor
references: []
---

# MarkdownQuickReference

## Overview

A standalone toolbar control in `@adh-shared/ui`
(`components/markdown-quick-reference`). It renders an outline `Button` that
opens a dismissible `Popover` listing the common GitHub-flavoured markdown
syntax — headings, bold/italic, inline + fenced code, bullet/numbered lists,
links, and blockquote.

It is built on the shared `Popover` primitive, so it inherits outside-click and
Escape dismissal plus focus restore to the trigger. It is wired into the
`MarkdownEditor` toolbar by default, but is exported on its own so any editor
toolbar can drop it in. It holds no state of its own and takes no value.

## Behavioral Requirements

- **must-render-labelled-trigger**: The control MUST render a single `Button`
  trigger whose accessible name is `Markdown quick reference`, regardless of the
  visible trigger text.
- **must-start-closed**: The control MUST NOT render the reference content until
  the trigger is activated (the popover starts closed).
- **must-open-on-trigger**: The control MUST open the popover and reveal the
  reference content when the trigger is activated (click or keyboard).
- **must-list-common-syntax**: The open popover MUST list, at minimum, headings,
  bold, italic, inline code, fenced code block, bullet list, numbered list,
  link, and blockquote — each as a label paired with its literal markdown
  snippet.
- **must-dismiss-on-escape**: The control MUST close the popover when Escape is
  pressed while it is open.
- **must-dismiss-on-outside-click**: The control MUST close the popover when a
  pointer interaction occurs outside it.
- **must-restore-focus**: The control MUST return focus to the trigger when the
  popover closes.
- **must-honor-custom-trigger-label**: The control MUST render `triggerLabel` as
  the visible trigger text while keeping the fixed `Markdown quick reference`
  accessible name.

## Appearance

```
┌ trigger ─────────┐
│ [▮] Markdown     │  ← outline Button (size sm), BookText icon + label
└──────────────────┘
        ▼ on open (popover, side=bottom align=end, w-80)
  ┌──────────────────────────────────────┐
  │ MARKDOWN QUICK REFERENCE              │  ← mono uppercase caption
  │ Headings     # H1 / ## H2 / ### H3    │  ← <dl>: term | <code> snippet
  │ Bold         **bold text**            │
  │ Italic       _italic text_            │
  │ Inline code  `inline code`            │
  │ Code block   ```ts … ```              │
  │ Bullet list  - one / - two            │
  │ Numbered     1. one / 2. two          │
  │ Link         [label](https://url)     │
  │ Blockquote   > quoted text            │
  └──────────────────────────────────────┘
```

- Trigger: shared `Button` via `buttonVariants({ variant: "outline", size: "sm" })`
  with a leading `BookText` icon (`data-icon="inline-start"`).
- Popover surface: the shared `PopoverContent` (`bg-apt-surface`,
  `border-apt-border`, `text-apt-text`), widened to `w-80`.
- Caption: `font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted`.
- Rows: a two-column `<dl>` — `<dt>` label in `text-apt-text-muted`, `<dd>` a
  `whitespace-pre-wrap` mono `<code>` in `text-apt-text`.
- Tokens only: no raw hex, no arbitrary colors, no `!important`.

## States

| State | Appearance change |
|---|---|
| Closed (default) | Only the outline trigger button is shown; no popover content in the DOM |
| Trigger hover/focus | Standard outline-Button hover + gold focus ring (`focus-visible`) |
| Open | `aria-expanded="true"` on the trigger; the portalled popover lists the syntax |
| Dismissed (Escape / outside-click) | Popover unmounts; focus returns to the trigger |

## Accessibility

- The trigger is a real `<button>` with `aria-label="Markdown quick reference"`,
  so the accessible name is stable even when the visible label changes.
- Open/closed state is conveyed via the Popover's `aria-expanded` /
  `aria-controls` wiring on the trigger (from the shared primitive).
- Escape closes the popover; focus is restored to the trigger (handled by the
  shared `Popover`).
- The reference content is a semantic `<dl>` (term/description pairs), so the
  label↔snippet relationship is exposed to assistive tech.
- Content is reference-only (no focusable controls), so there is no focus trap to
  manage beyond the primitive's defaults.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-render-labelled-trigger, must-start-closed | Render the control | One button named `Markdown quick reference`; no `Markdown quick reference` caption text in the DOM |
| T2 | must-open-on-trigger, must-list-common-syntax | Click the trigger | The popover shows the caption plus `Headings`, `Bold`, `Inline code`, `Code block`, `Link`, `Blockquote` |
| T3 | must-dismiss-on-escape, must-restore-focus | Open, then press Escape | The popover content is removed; focus returns to the trigger |
| T4 | must-honor-custom-trigger-label | Render with `triggerLabel="Syntax"` | The trigger shows `Syntax` but is still named `Markdown quick reference` |

## Edge Cases

- The syntax list is a fixed, hard-coded reference (no props feed it), so the
  content never varies between consumers — one authoritative cheatsheet.
- Fenced-code and list snippets contain newlines; the `<code>` uses
  `whitespace-pre-wrap` so multi-line snippets render literally.
- `side` / `align` are forwarded to the popover positioner; near a viewport edge
  the shared primitive flips/clamps the popover to stay on screen.
- Re-opening after dismissal re-mounts fresh content (the control is stateless).

## Configuration

`@adh-shared/ui/components/markdown-quick-reference`

| Option | Type | Default | Description |
|---|---|---|---|
| `side` | `PopoverContentProps["side"]` | `"bottom"` | Popover placement side |
| `align` | `PopoverContentProps["align"]` | `"end"` | Popover alignment along the side |
| `triggerLabel` | `ReactNode` | `"Markdown"` | Visible text on the trigger button |
| `className` | `string` | — | Extra classes on the trigger button |

```ts
type PopoverContentProps = React.ComponentProps<typeof PopoverContent>

export function MarkdownQuickReference(props: {
  side?: PopoverContentProps["side"]
  align?: PopoverContentProps["align"]
  triggerLabel?: React.ReactNode
  className?: string
}): React.ReactElement
```

## Logging

This ingredient is presentational and emits no structured log events. Opening or
dismissing the reference is local UI state and is not reported to the consumer.

## Platform Notes

- **React / Web (TypeScript):** Component at
  `websites/shared/ui/src/components/markdown-quick-reference.tsx`, built on the
  shared `Popover` + `Button`. Demo lives in `ui-showcase` (Overlays group);
  re-run `gen-sources.py` after edits.
- **SwiftUI / Compose:** Not applicable — this is a web-only shared component.

## Design Decisions

- **Decision**: The syntax list is hard-coded inside the component rather than a
  prop. **Rationale**: It is a fixed reference; a single authoritative cheatsheet
  (DRY) is better than letting each consumer pass a divergent list.
- **Decision**: Built on the shared `Popover` (not a bespoke overlay or the modal
  `Dialog`). **Rationale**: Reuse the platform dismissal + focus-restore behavior;
  a lightweight, non-modal reference should not trap focus or dim the page.
- **Decision**: A fixed `aria-label` independent of `triggerLabel`. **Rationale**:
  Keeps the accessible name stable for tests and assistive tech even when a
  consumer shortens the visible label.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important`, apt-* tokens | passed | adh-ui-guidelines |
| Reuse-first — built on shared Popover + Button | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe for the shared markdown quick-reference popover (contract c11). |
