---
id: 633ab7e7-828e-4e7d-b2dc-9ba189536b6e
title: "SendInvitationModal"
domain: agenticdeveloperhub://recipes/send-invitation-modal
type: recipe
version: 1.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-06-26
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A controlled dialog that sends invitations over email and/or SMS, with a recipient list + optional note per section, seeded from caller lists."
platforms:
  - typescript
  - web
tags:
  - modal
  - dialog
  - invitations
  - recipients
ingredients:
  - agenticdeveloperhub://recipes/alert-and-dialog
  - agenticdeveloperhub://recipes/recipient-input
depends-on: []
related: []
references: []
---

# SendInvitationModal

## Overview

A modal in `@agentic-toolkit/ui` for sending invitations over email and/or SMS. It
composes `Dialog` + `RecipientInput` + `Textarea` + `AlertModal` + `Button`. It is
invoked with seed lists of emails/phones (e.g. from the admin "Pending Users"
selection). The actual send is a caller callback (`onSend`) — stubbed in Phase 2,
wired in Phase 3.

It is a controlled dialog with up to two sections — **Email** and **SMS** — each
shown only when its seed list is non-empty. Each section edits a recipient list
and an optional admin note. The footer cancels (with confirm if dirty) or sends.

## Ingredients

| Name | Domain | Role | Required | Configuration |
|---|---|---|---|---|
| AlertAndDialog | agenticdeveloperhub://recipes/alert-and-dialog | The `Dialog` shell (`DialogContent max-w-lg`) + the discard-confirm `AlertModal` | yes | modal semantics; discard-confirm copy |
| RecipientInput | agenticdeveloperhub://recipes/recipient-input | Per-section recipient list (`kind="email"` / `kind="phone"`) | yes | `kind`, seeded `value` |

Composed shared primitives without their own recipe domains: `Textarea` (the
per-section admin note), `FieldGroup`/`Field`/`Label` (section structure +
labels), and `Button` (footer Cancel/Send).

## Integration Requirements

- **must-seed-sections-from-props**: On open, the Email section MUST seed its `RecipientInput` from `emails` and the SMS section MUST seed from `phones`.
- **must-hide-empty-sections**: A section MUST NOT be rendered when its seed list is empty or absent (an email-only batch shows only the Email section).
- **must-provide-note-per-section**: Each rendered section MUST include an optional admin-note `Textarea`.
- **must-assemble-send-payload**: Send MUST assemble a `SendInvitationPayload` containing only the rendered sections that still have ≥1 recipient, and MUST call `onSend` with it.
- **must-disable-send-when-empty**: Send MUST be disabled when no rendered section has any recipient.
- **must-confirm-cancel-when-populated**: Cancel, Esc, or a backdrop click MUST open an `AlertModal` discard confirm ("Discard this invitation?" / Cancel · Discard, with Discard `destructive` — red and Enter-to-confirm disabled) when the form is populated (any section has ≥1 recipient or any note has text), closing only on confirm; when not populated it MUST close immediately.
- **must-block-dismissal-when-busy**: When `busy` is true the modal MUST show a spinner and MUST block dismissal.
- **must-reset-on-close**: The modal MUST reset its state on close.
- **must-label-controls**: Each `RecipientInput` and `Textarea` MUST be labeled, and the `Dialog` MUST provide modal semantics with focus trap and restore.

## Layout

```
┌ Send invitation ───────────────────────────────────────┐
│  EMAIL                                                  │  ← only if emails seed non-empty
│  Recipients  [ (ada@x.io ×)(grace@x.io ×) ┃ ]           │
│  Note (opt.) [                              ]           │
│                                                         │
│  SMS                                                    │  ← only if phones seed non-empty
│  Recipients  [ (+1 555 0100 ×) ┃ ]                      │
│  Note (opt.) [                              ]           │
│                                                         │
│                                  [ Cancel ]  [ Send ]   │
└─────────────────────────────────────────────────────────┘
```

- `DialogContent` (`max-w-lg`); sections as `FieldGroup` blocks; labels via `Field`/`Label`. Footer right-justified `[ Cancel ][ Send ]` (Send = gold).
- No raw hex; no `!important`.

## Shared State

| State | Source | Consumer | Direction | Mechanism |
|---|---|---|---|---|
| email recipients (`string[]`) | SendInvitationModal (seeded from `emails`) | Email `RecipientInput`, Send payload | Down / Up | Component state + `RecipientInput` onChange |
| sms recipients (`string[]`) | SendInvitationModal (seeded from `phones`) | SMS `RecipientInput`, Send payload | Down / Up | Component state + `RecipientInput` onChange |
| email note / sms note | SendInvitationModal | Section `Textarea`s, Send payload | Down / Up | Component state |
| discardConfirm open | SendInvitationModal | AlertAndDialog (AlertModal) | Down | Boolean state |
| busy | Caller | Send + dismissal guard + spinner | Down | Prop |
| open | Caller | Dialog | Down | Prop (`open`); `onClose` up |

## Integration Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-seed-sections-from-props, must-hide-empty-sections | open with `emails` only | only the Email section renders, seeded |
| T2 | must-hide-empty-sections | open with `phones` only | only the SMS section renders |
| T3 | must-hide-empty-sections | open with both | both sections render |
| T4 | must-assemble-send-payload | Send with recipients in one section | payload contains only the non-empty section |
| T5 | must-disable-send-when-empty | clear all recipients | Send disabled |
| T6 | must-confirm-cancel-when-populated | Cancel with recipients/note present | discard confirm opens |
| T7 | must-confirm-cancel-when-populated | Cancel when not populated | closes immediately |
| T8 | must-block-dismissal-when-busy | `busy=true`, Esc/backdrop/Cancel | dismissal blocked; spinner shown |

## Edge Cases

- A modal seeded with recipients is considered populated, so an immediate Cancel still confirms.
- The Send payload omits any section that has been emptied of recipients, even if it was rendered.
- Send is disabled while every rendered section has zero recipients.
- Backdrop and Esc follow the same dirty check as Cancel.
- State resets on close, so reopening re-seeds from the current props.

## Platform Notes

- **React / Web (TypeScript):** New block at `websites/shared/ui/src/blocks/send-invitation-modal.tsx`. Composes `Dialog*`, `RecipientInput`, `Textarea`, `FieldGroup`, `Field`, `AlertModal`, `Button`. Consumed by the admin "Pending Users" topic (sub-project 4) "Send invitation" action. Add a demo to `ui-showcase` (+ regenerate sources).
- **Responsive:** Verify via Playwright (ui-showcase) at 375 / 768 / 1440 — sections stack and the footer (`[ Cancel ][ Send ]`) stays reachable on mobile.
- **SwiftUI / Compose:** Not applicable — web-only shared block.

API (`@agentic-toolkit/ui/blocks/send-invitation-modal`):

```ts
interface SendInvitationPayload {
  email?: { recipients: string[]; note: string }
  sms?: { recipients: string[]; note: string }
}
interface SendInvitationModalProps {
  open: boolean
  emails?: string[]      // seed Email section; section hidden when empty/absent
  phones?: string[]      // seed SMS section; section hidden when empty/absent
  onSend: (payload: SendInvitationPayload) => void
  onClose: () => void
  busy?: boolean
  title?: string         // default "Send invitation"
}
export function SendInvitationModal(props: SendInvitationModalProps): React.ReactElement
```

## Design Decisions

- **Decision**: A section is hidden entirely when its seed list is empty. **Rationale**: An email-only batch should not present an empty SMS section.
- **Decision**: Each section carries its own admin-note box. **Rationale**: Per the brief — email and SMS invitations may warrant distinct notes.
- **Decision**: Cancel confirms whenever the form is populated (a seeded modal counts as populated). **Rationale**: Prevents accidental loss of a prepared invitation.
- **Decision**: `onSend` is stubbed in Phase 2 and wired in Phase 3. **Rationale**: Phased rollout of the feature.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (recipe) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
