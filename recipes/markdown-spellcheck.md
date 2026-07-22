---
id: 81b8d777-f5c2-4a9a-8d5f-bbddf6e4e094
title: Markdown Spell Check
domain: agenticdeveloperhub://recipes/markdown-spellcheck
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "An off-by-default editor-toolbar toggle that runs a markdown-aware spell/grammar check via harper.js and lists problems in a popover with apply actions."
platforms:
- typescript
- web
tags:
- markdown
- spellcheck
- grammar
- harper
- editor
- toolbar
depends-on:
- agenticdeveloperhub://recipes/button
- agenticdeveloperhub://recipes/markdown-editor
related:
- agenticdeveloperhub://recipes/markdown-editor
- agenticdeveloperhub://recipes/markdown-quick-reference
references:
- https://writewithharper.com
---

# Markdown Spell Check

## Overview

A standalone editor-toolbar control in `@adh-shared/ui`
(`components/markdown-spellcheck`) that adds an **optional**, **markdown-aware**
spelling & grammar check to a markdown editor. It is built for the
`MarkdownEditor` `toolbarExtras` slot: the consumer passes the same markdown
`value` plus an `onApply` handler, and the control renders a toggle in the
toolbar.

The check is **off by default**. The first time it is enabled, the control
lazy-loads [harper.js](https://writewithharper.com) — an offline grammar checker
whose WebAssembly runs inside a Web Worker (`WorkerLinter`), so neither the WASM
nor the worker ships on initial page load and linting never blocks the UI
thread. harper is asked to parse the input as **Markdown source**, so fenced code
blocks and markdown syntax are skipped and only prose is checked — the whole
point over the browser's native textarea spellcheck.

Problems are surfaced in a lightweight popover **panel/list** (not inline
squiggles on the textarea, which would be far costlier): each row shows the
flagged text, harper's message, and one apply-a-suggestion action per
replacement. Applying edits the markdown source through `onApply`; the panel then
re-lints. It reuses the shared `Popover` (Escape / outside-click dismissal +
focus restore) and `Button`, and holds no source of its own.

## Behavioral Requirements

- **must-default-off**: The control MUST render its toggle in the off state
  (`aria-pressed="false"`) and MUST NOT lint, load harper, or show the panel
  until the toggle is enabled.
- **must-lazy-load-harper**: The control MUST import harper.js (and its WASM) only
  the first time the check is enabled — never on initial render — and MUST reuse
  that one linter instance for the lifetime of the control.
- **must-use-worker-linter**: The control MUST drive harper's `WorkerLinter` (WASM
  in a Web Worker), not a main-thread `LocalLinter`, so the UI thread is not
  blocked.
- **must-lint-markdown-source**: The control MUST lint in markdown source mode
  (`language: 'markdown'`) so fenced code blocks and markdown syntax are skipped
  and only prose is checked.
- **must-list-problems**: When enabled and problems exist, the control MUST list
  each problem as the flagged text plus harper's message in the panel.
- **must-offer-suggestions**: For a problem that has suggestions, the control MUST
  render one apply action per suggestion (capped to a small number); applying it
  MUST call `onApply` with the next markdown source.
- **must-relint-on-settle**: While the panel is open, the control MUST re-lint
  when the source settles after a change, debounced so a burst of edits coalesces
  into one check.
- **must-show-empty-state**: When enabled and no problems are found, the control
  MUST show an explicit "No issues found." state rather than an empty panel.
- **must-show-error-state**: If harper fails to load or lint, the control MUST
  show an inline "unavailable" state instead of crashing.
- **must-reset-on-disable**: Toggling the check off MUST close the panel and clear
  the listed problems.
- **must-be-client-only**: The control MUST be a client component
  (`"use client"`); it MUST NOT execute harper or worker code during SSR.

## Appearance

```
toolbar ─────────────────────────────────────────────
  […other controls]  [✓ Check spelling  (3)]   ← toggle Button (outline, sm);
                              │                   SpellCheck icon + label +
                              │                   count Badge (error) when open
                              ▼ on enable (popover, side=bottom align=end, w-80)
  ┌ SPELLING & GRAMMAR ───────────────────────────┐
  │ ┌───┐                                          │
  │ │teh│  Did you mean "the"?                      │  ← flagged chip (mono, red)
  │ └───┘  [✓ the]                                  │     + message + apply chips
  │ ──────────────────────────────────────────────│
  │ recieve  Did you mean "receive"?                │
  │          [✓ receive]                            │
  └────────────────────────────────────────────────┘
       states: Checking… (spinner) · No issues found. · unavailable (red)
```

- Toggle: shared `Button` via `buttonVariants({ variant: "outline", size: "sm" })`
  with a leading `SpellCheck` icon; an error-tone `Badge` shows the open problem
  count.
- Panel: the shared `PopoverContent` (`bg-apt-surface`, `border-apt-border`,
  `text-apt-text`), `w-80`, `max-h-[24rem] overflow-auto`.
- Caption: `font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted`.
- Each problem: a `<li>` with the flagged text in a `rounded bg-apt-surface-2`
  mono chip (`text-apt-red`), the message in `text-xs text-apt-text-muted`, and
  apply chips as the shared `Button` (`variant="outline" size="xs"`) with a
  `Check` icon.
- Tokens only: `apt-*` surfaces/text/borders/semantics; no raw hex, no
  `!important`.

## States

| State | Appearance change |
|---|---|
| Off (default) | Only the outline toggle is shown (`aria-pressed="false"`); no harper, no panel in the DOM |
| Loading (first enable) | Toggle pressed; panel shows a `Spinner` + "Checking…" |
| Ready — problems | Panel lists each flagged text + message + apply chips; toggle shows an error-tone count `Badge` |
| Ready — clean | Panel shows "No issues found." |
| Re-linting | Prior list stays visible (no "Checking…" flash) until fresh results replace it |
| Error | Panel shows a red `CircleAlert` + "Spell check is unavailable in this browser." |
| Dismissed / off | Popover unmounts, focus returns to the toggle, listed problems cleared |

## Accessibility

- The toggle is a real `<button>` whose accessible name is the `label`
  (default `Check spelling`) and whose on/off state is exposed via
  `aria-pressed`.
- The panel is a shared `Popover`, so it inherits Escape + outside-click
  dismissal and focus restore to the toggle.
- The problem list is a semantic `<ul>` labelled `Spelling and grammar issues`;
  each apply action is a real `<button>` (keyboard operable) with an
  `aria-label` of the form `Replace "<flagged>" with "<suggestion>"`, so the
  action is unambiguous out of context.
- harper's `message()` is rendered as plain text (never HTML), so untrusted lint
  text cannot inject markup.
- Loading uses the shared `Spinner` (`role="status"`); the error state pairs an
  `aria-hidden` icon with literal text.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-default-off | Render with a fake linter, do not click | One button named `Check spelling` with `aria-pressed="false"`; no message/panel text in the DOM |
| T2 | must-default-off, must-lazy-load-harper | Render with a spy `createLinter`, then enable | `createLinter` is not called on render; it is called exactly once after the toggle is enabled |
| T3 | must-list-problems, must-offer-suggestions | Enable over source `"teh cat sat"` (fake flags `teh`→`the`) | The panel shows `teh`, the message, and an apply action named `Replace "teh" with "the"`; the toggle is `aria-pressed="true"` |
| T4 | must-show-empty-state | Enable over clean source `"the cat sat"` | The panel shows "No issues found." |
| T5 | must-offer-suggestions, must-relint-on-settle | Enable over `"teh cat"`, click the apply action | `onApply` is called; the bound source becomes `"the cat"` |

> Tests inject a fake `MarkdownLinter` through the `createLinter` prop so no WASM
> runs in jsdom; this also makes the lazy-load contract (T2) directly assertable.

## Edge Cases

- A problem with no suggestions renders "No suggestion." instead of apply chips
  (e.g. a flagged proper noun harper can't correct).
- A `Remove`-kind suggestion has an empty replacement; the apply chip reads
  "Remove" and applying deletes the flagged span. harper's own `applySuggestion`
  performs the edit, so `Replace` / `Remove` / `InsertAfter` kinds are all handled
  correctly (not a naive `[start,end)` splice).
- Suggestions are capped at the first four per problem to keep the panel light.
- Fenced code, inline code, and markdown punctuation are not prose, so harper's
  markdown parser does not flag them.
- Dismissing the popover (Escape / outside-click) turns the check off; re-enabling
  re-lints the current source from scratch.
- The first lint after enabling runs immediately; later re-lints debounce, so a
  fast typist triggers one check, not one per keystroke.
- If harper cannot load or lint (e.g. a worker/WASM bundling failure in the host
  app), the panel degrades to the error state instead of throwing.

## Configuration

`@adh-shared/ui/components/markdown-spellcheck`

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | — (required) | The markdown source to check |
| `onApply` | `(next: string) => void` | — (required) | Called with the next source when a suggestion is applied |
| `label` | `ReactNode` | `"Check spelling"` | Visible text / accessible name of the toggle |
| `debounceMs` | `number` | `600` | Debounce before re-linting after the source settles |
| `createLinter` | `CreateMarkdownLinter` | `createHarperLinter` | Linter factory (DI seam); inject a fake in tests |
| `disabled` | `boolean` | `false` | Disable the toggle |
| `className` | `string` | — | Extra classes on the toggle button |

```ts
export interface SpellIssue {
  start: number
  end: number
  flagged: string
  message: string
  suggestions: string[]
}

export interface MarkdownLinter {
  lint(source: string): Promise<SpellIssue[]>
  apply(source: string, issueIndex: number, suggestionIndex: number): Promise<string>
  dispose(): void
}

export type CreateMarkdownLinter = () => MarkdownLinter | Promise<MarkdownLinter>

export const createHarperLinter: CreateMarkdownLinter

export function MarkdownSpellCheck(props: {
  value: string
  onApply: (next: string) => void
  label?: React.ReactNode
  debounceMs?: number
  createLinter?: CreateMarkdownLinter
  disabled?: boolean
  className?: string
}): React.JSX.Element
```

The default `createHarperLinter` dynamically imports `harper.js` +
`harper.js/binary`, constructs a `WorkerLinter` (American dialect), and lints with
`{ language: 'markdown', dedup: true }`. The exported types never reference
harper, so consumers do not need harper resolvable to type-check.

## Logging

This control is presentational and emits no structured log events. Enabling,
dismissing, and applying a suggestion are local UI interactions; only the applied
source change is reported to the consumer (`onApply`). A harper load/lint failure
is surfaced to the user via the error state rather than logged.

## Platform Notes

- **React / Web (TypeScript):** Component at
  `websites/shared/ui/src/components/markdown-spellcheck.tsx`, exported from
  `@adh-shared/ui/components/markdown-spellcheck`. Built on the shared `Popover` +
  `Button` + `Badge` + `Spinner`. harper.js is a dependency of `@adh-shared/ui`,
  marked `external` in `tsup.config.ts` so the dist re-emits the dynamic
  `import('harper.js')` verbatim and the **consumer's** bundler (Next.js)
  code-splits + lazy-loads the WASM. Consumed by hub's `ResearchDetail` (in the
  `MarkdownEditor` `toolbarExtras` slot). Demo lives in `ui-showcase` (Overlays
  group); re-run `gen-sources.py` after edits.
- **SwiftUI / Compose:** Not applicable — this is a web-only shared component.

## Design Decisions

- **Decision**: A popover panel/list, not inline squiggles on the textarea.
  **Rationale**: Per-character overlay positioning over a `<textarea>` is costly
  and brittle; a list of problems with explicit apply actions is cheaper, more
  accessible, and matches the "lightweight panel" brief.
- **Decision**: harper's `WorkerLinter`, lazy-loaded on first enable.
  **Rationale**: The WASM is multi-MB; keeping it off the initial bundle and off
  the UI thread (a Web Worker) is essential. Loading only when the user opts in
  honors the opt-in principle.
- **Decision**: Markdown source mode (`language: 'markdown'`). **Rationale**: The
  reason to add this over native spellcheck is to skip code blocks and markdown
  syntax and check only prose.
- **Decision**: A `createLinter` DI seam with a harper-free public type surface.
  **Rationale**: Tests inject a fake (no WASM in jsdom) and the lazy contract is
  assertable; keeping harper out of the exported `.d.ts` means consumers need not
  resolve harper to type-check.
- **Decision**: harper's own `applySuggestion` performs edits. **Rationale**: It
  handles `Replace` / `Remove` / `InsertAfter` suggestion kinds correctly, which a
  naive substring splice would not.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — apt-* tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |
| Reuse-first — built on shared Popover + Button + Badge + Spinner | passed | adh-ui-guidelines |
| Opt-in — off by default, harper lazy-loaded on enable | passed | adh-opt-in |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial recipe for the shared markdown spell/grammar-check toolbar control (harper.js WorkerLinter), contract c12. |
