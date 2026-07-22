---
id: c99e2822-f5a9-4e84-8740-9341880bb82a
title: Disclosure
domain: agenticdeveloperhub://recipes/disclosure
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: A self-contained collapsible section — a header row with a rotating chevron toggles its children; controlled or uncontrolled; optional header actions.
platforms:
- typescript
- web
tags:
- disclosure
- collapsible
- expander
depends-on: []
related:
- agenticdeveloperhub://recipes/focused-topic-detail
references: []
---

# Disclosure

## Overview

**Disclosure** is a self-contained collapsible section: a clickable header row
with a rotating chevron that shows or hides its children, themed with the family
`apt-*` tokens. It is uncontrolled by default (`defaultOpen`) but accepts
`open`/`onOpenChange` to be driven by a caller. The header can carry trailing
`actions` that do not toggle the section — useful for per-section buttons (e.g.
the focused-topic-detail Danger Zone).

## Behavioral Requirements

- **must-toggle-on-header-click**: Clicking the header toggle MUST flip the visibility of the children.
- **must-support-uncontrolled**: With `defaultOpen` and no `open` prop, the component MUST manage its own open state.
- **must-support-controlled**: When `open` is provided, the component MUST reflect that prop and report intent via `onOpenChange`, without mutating internal state.
- **must-rotate-chevron**: The leading chevron MUST rotate 90° when open and return when closed.
- **must-not-toggle-on-actions**: Interacting with the header `actions` slot MUST NOT toggle the disclosure.
- **must-mount-children-only-when-open**: Children MUST be mounted only when open (and unmounted when closed), not merely visually hidden.

## Appearance

Container: `rounded-lg border border-apt-border bg-apt-surface`. Header:
`flex items-center gap-2 px-3 py-2`; the toggle is a `<button>` showing a
`ChevronRight` that gains `rotate-90` when open, a `text-sm font-medium
text-apt-text` title and an optional `text-xs text-apt-text-muted` subtitle (both
truncate). `actions` are pinned to the right. The open body is separated by
`border-t border-apt-border px-3 py-3`. Focus ring `apt-gold/40`. No raw hex; no
`!important`.

## States

| State | Appearance change |
|---|---|
| collapsed | chevron points right; children unmounted |
| expanded | chevron rotated 90°; children shown under a top border |
| header focus | `focus-visible` ring on the toggle button |

## Accessibility

The header toggle is a real `<button>` carrying `aria-expanded` that reflects the
open state, with a visible `focus-visible` ring. The `actions` slot sits outside
the toggle button, so its controls are independently reachable and do not trigger
the toggle.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-toggle-on-header-click | click the header | children show, then hide |
| T2 | must-support-uncontrolled | `defaultOpen` only | manages its own state |
| T3 | must-support-controlled | `open` + `onOpenChange` | reflects prop; fires callback; no internal mutation |
| T4 | must-rotate-chevron | open it | chevron gains `rotate-90` |
| T5 | must-not-toggle-on-actions | click a button in `actions` | disclosure state unchanged |
| T6 | must-mount-children-only-when-open | collapsed | children absent from the DOM |

## Edge Cases

- In controlled mode the component never writes internal state — the caller owns `open`.
- `actions` are rendered outside the toggle `<button>`, so a click there cannot bubble into a toggle.
- Title and subtitle both truncate to keep the header a single row.

## Configuration

Props: `title`, `subtitle?`, `actions?`, `defaultOpen?` (false), `open?`,
`onOpenChange?`, `className?`, `headerClassName?`, `children`. Export:
`Disclosure`.

## Logging

None — a presentational primitive. Callers own any open/close telemetry.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/components/disclosure.tsx`, lucide `ChevronRight`. `"use client"`.
- **Responsive:** the header truncates rather than wrapping; verify via Playwright (ui-showcase) at 375 / 768 / 1440.
- **SwiftUI / Compose:** Not applicable — web-only shared component.

## Design Decisions

- **Controlled-or-uncontrolled.** Simple cases need no wiring; callers that must observe or drive the state can pass `open`/`onOpenChange`.
- **`actions` outside the toggle.** Per-section buttons live in the header without toggling the section (principle of least astonishment).
- **Unmount, not hide.** Collapsed children leave the DOM so they hold no hidden tab stops.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — `apt-*` tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial draft |
