/**
 * Password-manager opt-out for this package's own fields.
 *
 * A deliberate copy of `@agentic-toolkit/ui/lib/autofill`, which is the fleet's list of
 * record and carries the full rationale (which vendor reads which attribute, and
 * why `autocomplete="off"` alone moves none of them). It is copied rather than
 * imported because `@agentic-toolkit/controls` depends on nothing from the UI kit —
 * `@agentic-toolkit/model` and `shiki` are its only runtime deps — and a host site is
 * expected to be able to mount one control without pulling the kit in. Six string
 * literals are the cheaper of the two prices;
 * `frontend/tools/verify_autofill_copies.py` in the adh repo is what keeps them
 * in step, since the prose saying "keep the two in step" demonstrably did not.
 *
 * The conditional form is copied too, for the one field here that needs it:
 * `TextField` renders `type="email" | "url" | "tel"`, which in a settings panel is
 * frequently the READER'S own address rather than a record's, and its prop
 * interface is closed — no rest spread — so without an explicit escape hatch a
 * caller has no way at all to say "this one wants a manager". Fields that are
 * never the reader's own (`SecureTextField`, the search boxes) keep spreading the
 * unconditional bag.
 */
export const noAutofillProps = {
  autoComplete: 'off',
  'data-form-type': 'other',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-protonpass-ignore': 'true',
} as const

/**
 * The opt-out for a field whose caller may name an autofill token.
 *
 * Same rule as `@agentic-toolkit/ui`'s helper of this name: a field naming a real
 * token (`email`, `tel`, `url`, `name`, …) is *asking* for a manager and gets
 * handed straight back with none of the ignore attributes; `"off"` counts as no
 * token, because it is the same request this makes, only weaker. The value is
 * trimmed and lowercased first — the HTML attribute is case-insensitive, and a raw
 * `!== 'off'` would read `"Off"` or `" off "` as a real token and silently hand the
 * field to every manager.
 */
export function noAutofillPropsFor(
  autoComplete: string | undefined,
): Partial<typeof noAutofillProps> {
  const token = autoComplete?.trim().toLowerCase()
  return token && token !== 'off' ? {} : noAutofillProps
}
