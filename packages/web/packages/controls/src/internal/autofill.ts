/**
 * Password-manager opt-out for this package's own fields.
 *
 * A deliberate copy of `@agentic-toolkit/ui/lib/autofill`, which is the fleet's list of
 * record and carries the full rationale (which vendor reads which attribute, and
 * why `autocomplete="off"` alone moves none of them). It is copied rather than
 * imported because `@agentic-toolkit/controls` depends on nothing from the UI kit —
 * `@agentic-toolkit/model` and `shiki` are its only runtime deps — and a host site is
 * expected to be able to mount one control without pulling the kit in. Six string
 * literals are the cheaper of the two prices. Keep the two in step.
 */
export const noAutofillProps = {
  autoComplete: 'off',
  'data-form-type': 'other',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-protonpass-ignore': 'true',
} as const
