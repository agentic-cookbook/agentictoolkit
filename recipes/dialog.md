---
id: 972be0d0-a9f5-45cd-a23b-c8329410b3d1
title: Dialog
domain: agenticdeveloperhub://recipes/dialog
type: ingredient
version: 1.0.0
status: draft
language: en
created: '2026-06-26'
modified: '2026-06-26'
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: Centered modal Dialog (Base UI) themed with apt-* tokens; backdrop dismissal off by default. Composes Trigger/Content/Header/Footer/Title/Description.
platforms:
- typescript
- web
tags:
- dialog
- modal
- overlay
- base-ui
depends-on: []
related:
- agenticdeveloperhub://recipes/alert-and-dialog
- agenticdeveloperhub://recipes/send-invitation-modal
references: []
---

# Dialog

## Overview

**Dialog** is the shared centered-modal primitive, built on `@base-ui/react/dialog`
and themed with the family `apt-*` tokens. It is composed from parts —
`Dialog` (root), `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`,
`DialogTitle`, `DialogDescription`, and `DialogClose` — and is the base every
larger overlay (AlertModal, the invitation and add-users modals) is built on.

## Behavioral Requirements

- **must-center-modal**: `DialogContent` MUST render a centered, portalled popup over a dimmed, blurred backdrop.
- **must-not-dismiss-on-backdrop**: By default the dialog MUST NOT close on a backdrop or outside click (`disablePointerDismissal`); a caller MAY re-enable it with `disablePointerDismissal={false}`.
- **must-close-on-escape**: Escape MUST close the dialog, unless a composing component's keyboard policy overrides it.
- **must-render-close-affordance**: `DialogContent` MUST render a labelled `×` close button by default; `showClose={false}` MUST hide it.
- **must-trap-focus**: While open, focus MUST be trapped within the dialog and restored to the opener on close.
- **must-label-dialog**: The dialog MUST be labelled by `DialogTitle` and described by `DialogDescription` for assistive technology.

## Appearance

Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm`. Popup: centered
(`top-1/2 left-1/2 -translate-1/2`), `w-[calc(100%-2rem)] max-w-md`, `rounded-xl
border border-apt-border bg-apt-surface p-5 text-apt-text shadow-xl`. The `×`
close sits top-right, `text-apt-text-muted` → hover `text-apt-text`, focus ring
`apt-gold/40`. `DialogHeader` is `flex-col gap-1.5`; `DialogFooter` is
`justify-end gap-3`; `DialogTitle` `text-base font-semibold`; `DialogDescription`
`text-sm text-apt-text-muted`. No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| closed | portal empty — nothing rendered |
| open | dimmed/blurred backdrop + centered popup |
| close hover | `×` shifts `text-apt-text-muted` → `text-apt-text` |
| close focus | `×` shows `ring-2 ring-apt-gold/40` |

## Accessibility

`role="dialog"` with `aria-modal` (Base UI), labelled by `DialogTitle` and
described by `DialogDescription`; focus is trapped while open and restored to the
opener on close; Escape closes; the `×` carries `aria-label="Close"`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-center-modal | open the dialog | centered popup over a blurred backdrop |
| T2 | must-not-dismiss-on-backdrop | click the backdrop | stays open |
| T3 | must-close-on-escape | press Escape | closes |
| T4 | must-render-close-affordance | `showClose={false}` | no `×` rendered |
| T5 | must-trap-focus | Tab through, then close | focus stays inside; restores to opener |
| T6 | must-label-dialog | Title + Description present | `aria-labelledby` / `aria-describedby` wired |

## Edge Cases

- Backdrop dismissal is **off** by default for modals/alerts — opt back in with `disablePointerDismissal={false}`.
- Content caps at `max-w-md`; composing dialogs widen it via `className` (e.g. `sm:max-w-2xl`).
- `showClose={false}` for dialogs whose footer buttons are the only dismissal (e.g. a busy state that blocks dismissal).

## Configuration

Subcomponents and their key props: `Dialog` (root — `disablePointerDismissal`,
`open`/`onOpenChange`), `DialogTrigger`, `DialogClose`, `DialogContent`
(`showClose`, `className`), `DialogHeader`, `DialogFooter`, `DialogTitle`,
`DialogDescription`. Each forwards its Base UI props.

## Logging

None — a presentational primitive. Callers own open/close analytics.

## Platform Notes

- **React / Web (TypeScript):** `websites/shared/ui/src/components/dialog.tsx`, on `@base-ui/react/dialog`. `"use client"`.
- **Responsive:** `w-[calc(100%-2rem)]` preserves side margins on small screens; verify via Playwright (ui-showcase) at 375 / 768 / 1440.
- **SwiftUI / Compose:** Not applicable — web-only shared component.

## Design Decisions

- **Backdrop dismissal disabled by default.** Modals/alerts dismiss only via a button (per [[alert-and-dialog]] §6), preventing accidental data loss; pointer dismissal is opt-in.
- **Built on Base UI.** Inherits focus-trap, portalling, and a11y rather than hand-rolling them.
- **`apt-*` tokens.** Themes consistently with the rest of adh, no raw hex.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — `apt-*` tokens, no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial draft |
