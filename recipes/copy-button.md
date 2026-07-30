---
id: ecaba9e2-de10-45ac-80d8-398e9ab02626
title: CopyButton
domain: agenticdeveloperhub://recipes/copy-button
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-07-03'
modified: '2026-07-03'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A clipboard icon button on the shared Button + useClipboard; copies getText() resolved at click, flashes an apt-green check for 1200ms, silent on failure."
platforms:
- typescript
- web
tags:
- component
- clipboard
- copy
- button
- ui
depends-on:
- agenticdeveloperhub://recipes/button
related: []
references: []
---

# CopyButton

## Overview

The shared `CopyButton` in `@agentic-toolkit/ui` — the one "copy this" affordance across
every adh site. It is a small icon button that, on click, resolves a `getText()`
thunk and writes the result to the clipboard, then flashes a success check for a
short window. It composes two shared parts rather than re-implementing either: the
family `Button` (`variant="outline"`, `size="icon"`, shrunk to `size-6`) for the
chrome and press feel, and the `useClipboard` hook for the write + transient
`copied` flag.

The payload is a function, not a string: `getText()` runs at click time, so the
copied text reflects the current filter or selection even if the underlying rows
changed since render. If `getText()` returns an empty string, nothing is copied.
Clipboard failures — an insecure context, or a denied permission — are swallowed
inside `useClipboard`, so a copy that cannot happen is a silent no-op rather than an
error.

A single export ships from `@agentic-toolkit/ui/components/copy-button`: the `CopyButton`
component. It carries `"use client"` (clipboard access + the `copied` state) and is
fully self-driving — the only inputs are `getText`, the `label`, and an optional
`className`.

## Behavioral Requirements

- **copies-gettext-at-click**: The component MUST call `getText()` when clicked and write its result to the clipboard via `navigator.clipboard.writeText`.
- **reflects-current-selection**: Because it invokes `getText()` only on click, the component MUST copy the text current at the moment of the click, not a value captured at render.
- **skips-empty-text**: When `getText()` returns an empty string, the component MUST NOT write to the clipboard and MUST NOT flash success.
- **flashes-success-check**: On a successful copy, the component MUST swap the clipboard glyph for a check icon and tint it `apt-green`.
- **sets-copied-title**: On a successful copy, the component MUST set its `title` to `"Copied!"`.
- **reverts-after-timeout**: The component MUST revert the check, the green tint, and the title back to the idle state 1200 ms after a successful copy.
- **swallows-copy-failure**: When the clipboard write rejects (insecure context or denied permission), the component MUST NOT enter the success state and MUST NOT throw.
- **labels-from-prop**: The component MUST expose `label` as its accessible name via `aria-label`.
- **decorative-icon**: The component MUST mark its glyph `aria-hidden` so the accessible name comes solely from `label`.
- **forwards-classname**: The component MUST merge a consumer `className` onto the button element via `cn()`.

## Appearance

```
idle       [ ⧉ ]   outline square, muted clipboard glyph        title = label
success    [ ✓ ]   apt-green check, title "Copied!"  (1200 ms)  then reverts
```

- Chrome: the shared `Button` with `variant="outline"` and `size="icon"`, overridden
  down to `size-6` (a 24px square) via `className` so it sits inline beside text or a
  label without dominating.
- Idle glyph: the lucide `Copy` icon, tinted `text-apt-text-muted`.
- Success glyph: the lucide `Check` icon, tinted `text-apt-green`.
- Colors are token-based (`apt-text-muted`, `apt-green`) and merge through `cn()`; no
  raw hex, no `!important`.

## States

| State | Appearance change |
|---|---|
| Idle | `Copy` glyph, `text-apt-text-muted`; `title` = `label` |
| Hover / focus | Inherited from `Button` outline: background lift + focus-visible ring |
| Pressed | Inherited from `Button`: subtle dip/darken on `data-pressed` |
| Success (0–1200 ms after copy) | `Check` glyph, `text-apt-green`; `title` = `"Copied!"` |
| Empty / failed click | No visible change — the click is a no-op |

## Accessibility

- The button always carries an accessible name: `aria-label={label}`. Because the
  glyph is `aria-hidden`, the name comes solely from `label` and never leaks the icon.
- It renders a real `<button type="button">` (through `Button`), so it is focusable
  and operable by Enter/Space, with the family focus-visible ring.
- `title` mirrors `label` at idle and becomes `"Copied!"` on success — a supplemental
  hover tooltip, not the accessible name (which stays `label` throughout).
- Success is signalled by more than color: the glyph changes (`Copy` → `Check`) and
  the `title` changes to `"Copied!"`, so the affirmation is not conveyed by the green
  tint alone.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | copies-gettext-at-click, labels-from-prop | render `<CopyButton getText={() => "rows"} label="Copy rows" />`, click the button | `navigator.clipboard.writeText` called with `"rows"`; button's accessible name is `"Copy rows"` |
| T2 | flashes-success-check, sets-copied-title | after a successful click (T1) | button `title` becomes `"Copied!"`; glyph is the `Check` icon |
| T3 | skips-empty-text | `getText={() => ""}`, click | `writeText` NOT called; no success flash |
| T4 | reverts-after-timeout | after a successful copy, advance 1200 ms | `title` returns to `label`; glyph reverts to `Copy` |
| T5 | swallows-copy-failure | `writeText` rejects, click | no success state; no error thrown; `title` stays `label` |
| T6 | reflects-current-selection | `getText` reads a variable mutated between render and click | `writeText` receives the value current at click, not at render |
| T7 | decorative-icon, labels-from-prop | render `<CopyButton getText={…} label="Copy" />` | rendered svg glyph carries `aria-hidden`; accessible name is `"Copy"` |
| T8 | forwards-classname | `className="ml-2"` | button element carries the `ml-2` class |

## Edge Cases

- `getText()` returning `""` is the sanctioned "nothing to copy" signal — the host
  need not conditionally render the button; the click simply does nothing.
- Clipboard write failure (insecure `http://` context, or a denied `clipboard-write`
  permission) is caught inside `useClipboard`, which resolves `false` and leaves
  `copied` false — the button stays idle with no error surfaced.
- Rapid re-clicks each reset the 1200 ms timer (`clearTimeout` then re-arm), so the
  check persists 1200 ms from the most recent successful copy, not the first.
- Unmounting mid-flash is safe: `useClipboard` clears any pending timer on cleanup, so
  there is no state update after unmount.
- The text is resolved lazily, so a stale render never copies stale data — the
  payload always reflects state at the instant of the click.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `getText` | `() => string` | required | Produces the text to copy, evaluated at click time; return `""` to copy nothing. |
| `label` | `string` | required | Accessible name (`aria-label`) and the idle hover `title`. |
| `className` | `string` | — | Extra classes merged onto the button via `cn()` (e.g. spacing). |

The 1200 ms success window and the outline/icon/`size-6` chrome are fixed by the
component and are not exposed as props — see Design Decisions.

## Logging

No logging. `CopyButton` is a presentational affordance; what a given copy means, and
any telemetry around it, belong to the consumer that supplies `getText`, not the
button.

## Platform Notes

- Files: `websites/shared/ui/src/components/copy-button.tsx`; hook
  `websites/shared/ui/src/hooks/useClipboard.ts`.
- Carries `"use client"` — it reads `navigator.clipboard` and holds the transient
  `copied` state.
- Composes the shared `Button` and the lucide `Copy` / `Check` icons; no bespoke chrome.
- Demo: `ui-showcase` Topic `copy-button` in the "Composite controls" group
  (regenerate `sources.generated.ts` via `gen-sources.py` after source changes).
- Web/TypeScript only. Requires a secure context for `navigator.clipboard`; outside
  one, the write is a silent no-op.

## Design Decisions

- **`getText`, not `text`.** Taking a thunk resolves the payload at click time, so the
  copied text reflects the current filter/selection instead of a value frozen at
  render — the reason this affordance can sit next to a live, filtered table.
- **Empty string = nothing copied.** `getText` signals "nothing to copy" by returning
  `""`, keeping the enabled/no-op decision inside the component so hosts never wrap it
  in a visibility conditional.
- **Silent failure.** `useClipboard` swallows write failures (insecure context, denied
  permission); a copy affordance that cannot copy simply does nothing rather than
  throwing or alarming the user.
- **Compose Button + useClipboard.** Every "copy this" control is one component built
  on the family `Button` (outline/icon) and the shared hook, so styling and behavior
  stay identical everywhere instead of drifting per call site.
- **Fixed 1200 ms flash.** The success window is a deliberate constant (shorter than
  `useClipboard`'s 1500 ms default) so the check reads as a quick affirmation, not a
  lingering state; it is not a prop, to keep the feel consistent across call sites.
- **`size-6` over the icon default.** The button overrides `Button`'s `size-8` icon
  square down to `size-6` (24px) so the control sits inline beside text or a label
  without dominating the row.

## Compliance

| Check | Status | Category |
|---|---|---|
| No raw hex / arbitrary colors / `!important` | pass | project-guidelines UI |
| Components sourced from `@agentic-toolkit` (Button, useClipboard; no bespoke UI) | pass | project-guidelines UI |
| Icon-only control carries an accessible name (`aria-label`) | pass | accessibility |
| Success not conveyed by color alone (glyph + `title` change) | pass | accessibility |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-07-03 | Mike Fullerton | Initial recipe; documents the clipboard CopyButton on shared Button + useClipboard. |
