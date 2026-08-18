/**
 * Password-manager opt-out for this package's own fields.
 *
 * A deliberate copy of `@agentic-toolkit/ui/lib/autofill`, which is the fleet's list of
 * record and carries the full rationale (which vendor reads which attribute, and
 * why `autocomplete="off"` alone moves none of them). It is copied rather than
 * imported because this package ships zero runtime dependencies on purpose — a
 * site can render a registry with nothing but React, and `@agentic-toolkit/ui` is in
 * neither its peers nor its deps (see the note in editors/FieldDefEditor.tsx).
 * Six string literals are the cheaper of the two prices. Keep the two in step.
 *
 * Registry fields hold a *record's* data — an entry's name, its contact email,
 * its URL — never the reader's own credentials, so nothing here ever wants a
 * manager.
 */
export const noAutofillProps = {
  autoComplete: 'off',
  'data-form-type': 'other',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-protonpass-ignore': 'true',
} as const
