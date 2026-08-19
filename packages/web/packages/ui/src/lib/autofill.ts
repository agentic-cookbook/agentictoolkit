/**
 * The one place the fleet says "this field is not a credential".
 *
 * Password managers do not read a field's purpose, they *guess* it from the
 * page around it — a text input next to the word "name", a search box on a
 * page that also has a sign-in link — and then hang their inline button in the
 * field and pop their vault over it. Across the fleet that guess is wrong far
 * more often than it is right: almost every edit field here holds ordinary
 * record data (a registry entry's label, a topic title, a filter box), and the
 * handful that hold real credentials say so with a proper `autoComplete` token.
 *
 * The line is WHOSE detail the field holds, not what it looks like. An `type="email"`
 * input is a record's data when an admin is adding somebody else (TeamMembersPane's
 * "Member email", UsersPane, add-users-modal's staged rows) and the reader's own when
 * it is where their verification code will be sent (account ContactsCard) — the second
 * names a token, the first does not, and they render the same control. The fields that
 * do name one, so the sentence above is true rather than aspirational: LoginCard
 * (`username`/`email` + `current-password`), SignupCard (`name`, `email`,
 * `new-password`), MfaStep (`one-time-code`), ContactsCard (`email`/`tel`), and
 * IntegrationDetail — which is the odd one out, naming `new-password` DEFENSIVELY to
 * stop Chrome offering a saved site password and spreading the bag itself to undo the
 * hand-back a token would otherwise earn it.
 *
 * Each vendor reads its own attribute and none of them read the others, so the
 * opt-out is the union of every manager we have actually seen pop up over an
 * adh field. `autocomplete="off"` alone moves none of them — it speaks only to
 * the browser's own autofill:
 *
 *   - `data-form-type="other"`      Dashlane (its SAWF "ignore" value)
 *   - `data-1p-ignore`              1Password 8
 *   - `data-lpignore`               LastPass
 *   - `data-bwignore`               Bitwarden
 *   - `data-protonpass-ignore`      Proton Pass
 *   - `autocomplete="off"`          the browser (Chrome/Safari/Firefox autofill)
 *
 * Keeping them out is not only cosmetic: several managers *mutate the DOM* to
 * plant their button (Dashlane adds `data-dashlane-rid`), and a mutation that
 * lands between SSR and hydration is a React hydration mismatch.
 *
 * These are plain attributes with no runtime behaviour, so they are safe on any
 * `<input>`/`<textarea>`, server-rendered, with nothing to hydrate.
 *
 * Packages that cannot depend on `@agentic-toolkit/ui` (`@agentic-toolkit/registry` and
 * `@agentic-toolkit/chat` ship zero runtime deps on purpose, so a host site can render
 * them without pulling the UI kit in) repeat the literal attributes inline and
 * point back here. This module stays the list of record.
 *
 * `frontend/tools/verify_autofill_copies.py` in the adh repo is what holds those copies
 * to it: it reads this literal and fails when any copy is short, drifted, or carries a
 * vendor this does not. It exists because the prose asking editors to keep them in step
 * was already there, and the chat composer's copy was one attribute short of this one
 * for as long as it existed — nothing else can see it, since these attributes have no
 * types and no runtime behaviour, and a short copy misbehaves only for whoever has the
 * one extension it dropped. Add a vendor HERE first; the copies are checked against it.
 */

/**
 * Spread onto a field that should never be offered a saved credential.
 *
 * Spread it BEFORE the caller's own props, so a field that genuinely wants the
 * manager can take itself back out — see {@link noAutofillPropsFor}, which is
 * what the shared `Input`/`Textarea` use to do that automatically.
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
 * The opt-out for a wrapper that forwards arbitrary props — `Input`, `Textarea`,
 * or any component built on them.
 *
 * A field that names a real autofill token (`current-password`, `new-password`,
 * `email`, `one-time-code`, `address-line1`, …) is *asking* for a manager, so it
 * gets the field handed straight back and none of the ignore attributes are
 * emitted. That makes the standard attribute the single declaration of intent:
 * a sign-in form keeps its password manager by saying `autoComplete="current-password"`,
 * as it already must for the browser, and nobody has to remember a second
 * fleet-private opt-in next to it.
 *
 * `autoComplete="off"` counts as "no token" — it is the same request this makes,
 * only weaker, so those fields get the full opt-out.
 *
 * The value is trimmed and lowercased before that comparison because the HTML
 * attribute is case-insensitive and space-separated: `"Off"`, `" off "` and
 * `"OFF"` are all the same instruction to the browser, and a raw `!== 'off'`
 * would read each of them as a real token and hand the field back to every
 * manager — silently, since the field still renders and still says `off`.
 */
export function noAutofillPropsFor(
  autoComplete: string | undefined,
): Partial<typeof noAutofillProps> {
  const token = autoComplete?.trim().toLowerCase()
  return token && token !== 'off' ? {} : noAutofillProps
}
