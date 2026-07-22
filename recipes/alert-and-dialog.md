---
id: 550f00f7-bfb2-415e-9b15-bd5dce015500
title: "Alert & Dialog System"
domain: agenticdeveloperhub://recipes/alert-and-dialog
type: recipe
version: 1.1.0
status: draft
language: en
created: 2026-06-26
modified: 2026-07-03
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "The canonical alert/confirm/modal-dialog treatment: shared header + footer-button layout + keyboard policy on the AlertModal/Dialog base."
platforms:
  - typescript
  - web
tags:
  - dialog
  - alert
  - confirm
  - overlay
ingredients:
  - agenticdeveloperhub://recipes/dialog
  - agenticdeveloperhub://recipes/button
depends-on: []
related: []
references: []
---

# Alert & Dialog System

## Overview

The canonical styled alert / confirm / modal-dialog treatment for ADH. It is
realized by evolving `@adh-shared/ui`'s existing `AlertModal`
(`websites/shared/ui/src/components/alert-modal.tsx`) **backward-compatibly** —
current call-sites (`LoginCard`, `ProviderLinkHandler`, `SsoCallback`, admin
`authentication/page.tsx`, tests) keep working. Larger modal dialogs (e.g. the hub
invitation modal) reuse the same header + footer-button system on top of the base
`Dialog`.

It is one controlled component for two common shapes — **Alert** (single action,
full-width gold `[ OK ]`) and **Confirm** (two actions `[ Cancel ][ OK ]`, equal
width, OK gold) — plus a **destructive** mode (red action, no keyboard shortcuts)
and a caller-configurable keyboard policy. The same header style and footer-button
rules are exposed for composed dialogs so everything looks uniform.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| Dialog | agenticdeveloperhub://recipes/dialog | Base overlay / focus-trap / portal that the system is built on | yes | reused unchanged |
| Button | agenticdeveloperhub://recipes/button | Footer action + cancel buttons | yes | `variant="default"` (gold action), `variant="ghost"`/`outline` (cancel), red for destructive |

## Integration Requirements

- **must-full-width-single-action**: With one button, the action button MUST be full width of the content area and gold (`Button variant="default"`).
- **must-equal-width-when-narrow**: With two buttons and content width `≤ 2 × Wmax`, the row MUST split into two equal-width (`flex-1`) buttons `[ Cancel ][ OK ]`, Cancel `ghost`/`outline` and OK gold.
- **must-natural-width-when-wide**: With two buttons and content width `> 2 × Wmax`, the buttons MUST keep natural width and right-justify (`justify-end`), Cancel then OK.
- **must-order-cancel-then-action**: The order MUST always be Cancel (left) then the action (right).
- **must-keyboard-default**: Under `keyboard:"default"`, Escape MUST dismiss via cancel if a cancel button exists (else via the single action), and Enter MUST activate the action.
- **must-keyboard-none**: Under `keyboard:"none"`, the modal MUST honor no keyboard shortcuts and be dismissable only by clicking a button (or the close affordance if shown).
- **must-keyboard-explicit-map**: Under an explicit key→action map, only listed keys MUST act, mapped to the named button; a key mapped to a button that is not present MUST be ignored.
- **must-destructive-forces-none**: When `destructive` is true, the action button MUST render red (`apt-red`) and the keyboard policy MUST be forced to `"none"` regardless of `keyboard`.
- **must-block-dismissal-when-busy**: When `busy` is true, the component MUST block dismissal and replace the buttons with a spinner.
- **must-be-accessible-dialog**: The surface MUST be `role="dialog"` with `aria-modal`, labelled by the title and described by the body; initial focus MUST be the action button under `"default"` (the first field for composed form dialogs); focus MUST be trapped while open and restored to the opener on close.

## Layout

Single-button alert (button spans the content width):

```
┌───────────────────────────────────┐
│  Title (apt-gold)                  │   ← highlight-color header
│  Body copy, proportional padding.  │
│  [               OK              ] │   ← full-width gold
└───────────────────────────────────┘
```

Two-button confirm (equal width):

```
┌───────────────────────────────────┐
│  Title (apt-gold)                  │
│  Body copy.                        │
│  [    Cancel    ][      OK       ] │   ← equal width; OK = gold
└───────────────────────────────────┘
```

Wide dialog (content wider than 2× the max button width → buttons keep natural width and right-justify):

```
┌─────────────────────────────────────────────────────────┐
│  Title (apt-gold)                                         │
│  … wider content …                                       │
│                              [  Cancel  ][     OK      ]  │
└─────────────────────────────────────────────────────────┘
```

- **Header**: title in the highlight color (`apt-gold`), `font-semibold`. An optional `tone` icon (info/success/error) sits to the left of the title.
- **Size**: width is proportional to content with a sensible default cap (`max-w-md` for alerts; composed dialogs may set their own). Height hugs content.
- **Padding**: consistent interior padding from `--space-*` (≈ `p-6`); footer separated by a `--space` gap; no ad-hoc values.
- **Tokens**: header `apt-gold`; body `apt-text` / `apt-text-muted`; surface `apt-surface`; border `apt-border`. Action gold (`variant="default"`) normally, red (`apt-red`) when destructive; Cancel `ghost`/`outline`. Built on the existing `Dialog` (Base UI). No raw hex; no `!important`.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| open | Caller | Dialog | Down | Prop |
| busy | Caller | Footer buttons / dismissal guard | Down | Prop; replaces buttons with a spinner |
| keyboard policy | Caller (`keyboard`, `destructive`) | Key handler | Down | Prop; `destructive` forces `"none"` |
| confirm / cancel intent | Key handler + buttons | Caller (`onConfirm` / `onCancel`) | Up | Callbacks |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-full-width-single-action | one-button alert | action button full width, gold |
| T2 | must-equal-width-when-narrow | two buttons, narrow content | equal-width `[ Cancel ][ OK ]` |
| T3 | must-natural-width-when-wide | two buttons, wide content | natural-width, right-justified |
| T4 | must-keyboard-default | `keyboard:"default"`, Enter then Escape | Enter→confirm; Escape→cancel (or OK if no cancel) |
| T5 | must-keyboard-none | `keyboard:"none"`, press keys | keys ignored |
| T6 | must-keyboard-explicit-map | `{ Enter: "confirm" }` | only Enter acts → confirm; unlisted keys ignored |
| T7 | must-destructive-forces-none | `destructive: true` | action red; no keyboard shortcuts |
| T8 | must-block-dismissal-when-busy | `busy: true` | dismissal blocked; spinner replaces buttons |

## Edge Cases

- The equal-width vs right-justified choice is governed by the `content width ≤ 2 × Wmax` threshold, where `Wmax` is the larger natural button width.
- A key mapped to a button that is not rendered is ignored.
- `destructive` overrides any supplied `keyboard` value (forced `"none"`) so a delete is always an explicit click.
- `busy` blocks all dismissal paths and hides the buttons behind a spinner.

## Platform Notes

- **React / Web (TypeScript):** Evolve `websites/shared/ui/src/components/alert-modal.tsx`; reuse `websites/shared/ui/src/components/dialog.tsx` (Base UI) unchanged. Extend (not replace) `websites/shared/ui/src/__tests__/alertModal.test.tsx`. Demo in `websites/local/ui-showcase`. Reused by the hub `InvitationModal` (header + footer-button system).
- **Responsive:** Verify via Playwright (ui-showcase) — each variant rendered, keyboard flows exercised, at 375 / 768 / 1440.
- **SwiftUI / Compose:** Not applicable — web-only shared system.

API. Existing props (kept): `open`, `title`, `description`, `tone` (`"info" | "success" | "error"`), `confirmLabel` (default `"OK"`), `confirmVariant`, `onConfirm`, `cancelLabel` (presence ⇒ confirm mode), `onCancel`, `busy`. New props:

```ts
type KeyAction = "confirm" | "cancel";

interface AlertModalKeyboardAdds {
  /** "default" (see keyboard rules) | "none" (no shortcuts) | explicit key→action map. */
  keyboard?: "default" | "none" | Partial<Record<string, KeyAction>>;
  /** Destructive: action button red (apt-red); forces keyboard "none". */
  destructive?: boolean;
}
```

## Design Decisions

- **Decision**: Evolve the existing `AlertModal` backward-compatibly rather than introduce a new component. **Rationale**: Defaults preserve today's behavior (`keyboard:"default"`, `destructive:false`); existing call-sites that pass only `tone`/`confirmLabel`/`cancelLabel`/`onConfirm`/`onCancel` are unaffected in API while gaining the standardized header + button layout. Smoke-check each known call-site during implementation — `LoginCard`, `ProviderLinkHandler`, `SsoCallback`, and admin `authentication/page.tsx` — so the visual/keyboard change is intended, not a regression.
- **Decision**: Destructive mode forces no keyboard shortcuts. **Rationale**: A destructive action must be a deliberate, explicit click — never Enter-to-confirm.
- **Decision**: The header + footer-button system is exposed for composed dialogs. **Rationale**: Larger dialogs (e.g. the invitation modal) stay visually uniform with alerts/confirms.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important` | passed | adh-ui-guidelines |
| Backward compatibility — existing call-sites unaffected in API | required | regression |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
| 1.1.0 | 2026-07-03 | Mike Fullerton | Rename the `tone` union member `danger`→`error` to match `AlertModalTone` in `alert-modal.tsx`. |
