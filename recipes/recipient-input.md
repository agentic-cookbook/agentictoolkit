---
id: d9ad192e-a642-46a2-8b25-b8aac9d9f441
title: "RecipientInput"
domain: agenticdeveloperhub://recipes/recipient-input
type: ingredient
version: 1.0.0
status: draft
language: en
created: 2026-06-26
modified: 2026-06-26
author: Mike Fullerton
copyright: 2026 Mike Fullerton
license: MIT
summary: "A removable-chips token input that tokenizes typed entries into Badge chips with per-kind validation; used by SendInvitationModal for recipients."
platforms:
  - typescript
  - web
tags:
  - input
  - chips
  - tokens
  - recipients
depends-on: []
related: []
references: []
---

# RecipientInput

## Overview

A removable-chips / token input in `@agentic-toolkit/ui`. None exists today. It is
used by `SendInvitationModal` for the email + SMS recipient boxes.

It displays a list of string values as removable `Badge` chips plus an inline
text field that tokenizes typed entries. It is controlled via `value: string[]`.

## Behavioral Requirements

- **must-tokenize-on-separator**: The RecipientInput MUST tokenize the current
  input text into a chip on Enter, on a comma keypress, and on blur — trimming
  surrounding whitespace, ignoring empty entries, and de-duplicating
  case-insensitively for the `email` kind.
- **must-remove-last-on-backspace**: The RecipientInput MUST remove the last chip
  when Backspace is pressed while the inline input is empty.
- **must-remove-chip-on-dismiss**: The RecipientInput MUST remove a chip from
  `value` (via `onChange`) when that chip's `×` button is activated.
- **must-validate-by-kind**: The RecipientInput MUST validate each chip by `kind`
  (`email` → basic `x@y.z`; `phone` → `+?[\d\s().-]{7,}`; `text` validates
  nothing); invalid chips MUST render with an `apt-red` ring and
  `aria-invalid="true"` but MUST still be added, leaving the caller to decide
  whether to block send.
- **must-set-input-hints**: The RecipientInput MUST set the inline input's
  `inputMode` / `type` hints from `kind` (`email`, `tel`).

## Appearance

```
┌────────────────────────────────────────────────┐
│ (ada@x.io ×)(grace@x.io ×)(bad@ ×!) ┃type…      │   ┃ = caret in the inline input
└────────────────────────────────────────────────┘
```

- Container mimics `Input`: `flex flex-wrap items-center gap-1.5 rounded-lg
  border border-apt-border bg-apt-bg px-2 py-1.5`, with a gold focus-within ring
  (`focus-within:border-apt-gold focus-within:ring-2 focus-within:ring-apt-gold/25`).
- Chip = `Badge` (`variant="neutral"`, invalid → `variant="error"`) plus a small
  `×` button.
- Inline field is a borderless `<input>`
  (`flex-1 bg-transparent outline-none text-apt-text`).
- No raw hex; no `!important`.

## States

| State | Appearance change |
|---|---|
| Default | `border-apt-border`; no ring |
| Focus-within (any child focused) | `border-apt-gold` + `ring-2 ring-apt-gold/25` |
| Disabled | Non-interactive; chips and inline input are disabled |
| Chip (valid) | `Badge variant="neutral"` |
| Chip (invalid) | `Badge variant="error"` + `apt-red` ring + `aria-invalid="true"` |

## Accessibility

- Container is `role="group"` with `aria-label` (from `ariaLabel`); the inline
  input is labeled.
- Each chip's `×` is a `<button aria-label="Remove {value}">`.
- Invalid chips carry `aria-invalid="true"`.

## Conformance Test Vectors

| ID | Requirements | Input | Expected |
|---|---|---|---|
| T1 | must-tokenize-on-separator | Type `ada@x.io`, press Enter | A neutral `Badge` chip `ada@x.io` is added; input clears |
| T2 | must-tokenize-on-separator | Type `a@x.io` then `,` | Chip added on comma |
| T3 | must-tokenize-on-separator | Type `  ada@x.io  `, then blur | Trimmed chip `ada@x.io` added |
| T4 | must-tokenize-on-separator | `kind="email"`: add `Ada@x.io` then `ada@x.io` | Second entry de-duped case-insensitively; one chip remains |
| T5 | must-remove-last-on-backspace | Empty input with chips present, press Backspace | Last chip removed |
| T6 | must-remove-chip-on-dismiss | Click `×` on the `grace@x.io` chip | That chip removed from `value` |
| T7 | must-validate-by-kind | `kind="email"`: add `bad@` | Chip rendered with `apt-red` ring + `aria-invalid="true"` but still present in `value` |
| T8 | must-validate-by-kind | `kind="text"`: add `anything` | No validation; chip neutral |
| T9 | must-set-input-hints | `kind="phone"` | Inline input exposes `type="tel"` / tel `inputMode` |

## Edge Cases

- An empty or whitespace-only entry on Enter / comma / blur is ignored — no chip
  is added.
- Backspace while the inline input is **non-empty** edits the text; it only
  removes the last chip when the input is empty.
- Email de-dup is case-insensitive; for non-email kinds de-dup is exact.
- Invalid chips are still appended to `value`; validation is advisory and the
  caller decides whether to block send.
- When `disabled`, tokenization and chip removal are inert.

## Configuration

`@agentic-toolkit/ui/components/recipient-input`

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `string[]` | — (required) | Controlled list of token strings |
| `onChange` | `(next: string[]) => void` | — (required) | Called with the updated list on any add/remove |
| `kind` | `"email" \| "phone" \| "text"` | `"text"` | Light validation + `inputMode`/`type` hints |
| `placeholder` | `string` | — | Placeholder for the inline input |
| `ariaLabel` | `string` | — (required) | Accessible label for the container group |
| `disabled` | `boolean` | `false` | Disables all interaction |
| `className` | `string` | — | Extra CSS classes on the container |

```ts
interface RecipientInputProps {
  value: string[]
  onChange: (next: string[]) => void
  kind?: "email" | "phone" | "text"   // light validation + inputMode; default "text"
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
}
export function RecipientInput(props: RecipientInputProps): React.ReactElement
```

## Logging

This ingredient is presentational and emits no structured log events of its own.
Tokenization, validation outcomes, and submission are logged by the consuming
feature (e.g. `SendInvitationModal`), not by the input.

## Platform Notes

- **React / Web (TypeScript):** New component at
  `websites/shared/ui/src/components/recipient-input.tsx`. Add a demo to
  `ui-showcase` and regenerate sources. Consumed by `SendInvitationModal`.
- **SwiftUI / Compose:** Not applicable — this is a web-only shared component.

## Design Decisions

- **Decision**: Invalid chips are still added to `value` (marked `aria-invalid`)
  rather than rejected. **Rationale**: The input is advisory; the caller decides
  whether to block send, keeping the input dumb and reusable.
- **Decision**: Email de-duplication is case-insensitive; other kinds de-dupe
  exactly. **Rationale**: Email addresses are case-insensitive in their local
  routing in practice, so `Ada@x.io` and `ada@x.io` are the same recipient.
- **Decision**: Container mimics `Input` and uses a `Badge`-based chip rather than
  a bespoke pill. **Rationale**: Reuse shared primitives and the standard
  focus-ring treatment instead of new visual language.

## Compliance

| Check | Status | Category |
|---|---|---|
| Artifact formatting (ingredient) | passed | artifact-formatting |
| UI guidelines — no raw hex, no `!important` | passed | adh-ui-guidelines |

## Change History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-06-26 | Mike Fullerton | Initial conversion from legacy UI spec. |
