/**
 * What a legal slug is, and what the server's bounds on the entry spine are — once.
 *
 * Both were previously stated only inside the registry create form, which is why the entry slug box
 * in `EntryIdentityPanel.tsx` had none of them (R4-I1): a registrant typing `Mike Fullerton`,
 * `jo`, `-mike` or 65 characters got a 400 that rejected every OTHER section's answers in the
 * same save and named nothing. Sharing the rule is what makes the two boxes agree; copying it
 * is what let them diverge in the first place.
 */

/**
 * `SLUG_RE`'s own upper bound: 1 + 62 + 1. Registry slugs and entry slugs share the pattern,
 * so they share this — it is a property of the regex, not of either table.
 */
export const SLUG_MAX = 64;

/**
 * The server's own limits on the entry spine, said out loud.
 *
 * Mirrors `entryWrite` in `backend/src/adh/src/routes/registryEntries.ts`. These are `maxLength`
 * on the box rather than a message on save: a cap the registrant cannot exceed needs no error,
 * and the alternative is a 400 that discards a whole save's worth of unrelated work.
 */
export const ENTRY_LIMITS = {
  displayName: 255,
  summary: 4000,
  category: 128,
  locationText: 255,
  regionCode: 8,
  countryCode: 2,
  linkLabel: 64,
  // The four below cannot be `maxLength` on a box: `TagSetField` takes neither a per-item
  // length nor a set size, and links are rows behind an "Add a link" button. They are stated
  // in `saveBlock` instead — at the field, rather than as a 400 that names none of them.
  linkCount: 32,
  keyword: 64,
  keywordCount: 32,
  language: 16,
  languageCount: 32,
} as const;

/** The same shape the server's `SLUG_RE` accepts, so a good name never produces a 400. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    // After the slice too: a cut mid-word leaves a trailing dash, which SLUG_RE rejects.
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes a keystroke into a slug box itself — lowercases and collapses a run of anything
 * else to a single dash, but does NOT trim a leading/trailing dash the way `slugify` does.
 * Typing "career-coaches" passes through the intermediate state "career-" for one keystroke
 * before the "c" lands; running it through `slugify` (as the registry box used to) strips that
 * trailing dash immediately, deleting it out from under the next character, so the box can
 * never settle on "career-coaches" no matter how it's typed.
 *
 * An edge dash is therefore a legal thing to be *typing* and an illegal thing to *save*, which
 * is why `slugProblem` names it rather than this function removing it. The registry box trims
 * once at submit (`submittedSlug` in `CreateRegistryDialog.tsx`) because that slug is minted there; the
 * entry box does not, because that slug is a stored column and silently rewriting a registrant's
 * permanent address is not a correction anyone asked for.
 */
export function normalizeSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, SLUG_MAX);
}

/**
 * Why this slug cannot be saved, or `null`. Blank is "not yet", not a problem to show.
 *
 * `SLUG_RE` (`/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/`) in words, minus the parts
 * `normalizeSlugInput` makes unreachable. The character set and the 64-character cap are
 * enforced by construction — the box normalises every keystroke and carries a `maxLength` —
 * so there is deliberately no message for either: a message that cannot be produced is a
 * claim no test can make bite (R4's `rl-slug-max` recorded exactly that about the `> 64`
 * branch this replaces). What is left is the two things the box can legitimately be holding:
 * too short, and an edge dash.
 */
export function slugProblem(slug: string): string | null {
  if (slug === '') return null;
  if (slug.length < 3) return 'A web address needs at least three characters.';
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return 'A web address cannot start or end with a hyphen.';
  }
  return null;
}

/**
 * Why this field-definition key cannot be saved, or `null`.
 *
 * The same SLUG_RE as a slug — the server gates a field def's key, a section's key and a
 * registry's slug with one regex — but a DIFFERENT answer for blank, which is why this is its
 * own function rather than a flag on `slugProblem`. A blank slug box is a registrant part-way
 * through typing an address, so it has nothing to say yet. A blank field key is what `addField`
 * mints, so it is the single most likely reason a save is about to 400, and staying quiet about
 * it is exactly how the half-applied save happened.
 *
 * The charset and length messages are here for the same reason they are absent from
 * `slugProblem`: the Key box derives its value with `slugify`, so those branches are unreachable
 * from the keyboard — but a key can also arrive from a registry built before that derivation
 * existed, and a rule the owner cannot act on is worse than one nobody trips.
 *
 * Worded as a sentence fragment: every caller prefixes the field's own label, so the message
 * reads "Years of experience: a field key needs at least three characters."
 */
export function keyProblem(key: string): string | null {
  if (key === '') return 'give it a label — its key is made from that.';
  if (key.length < 3) return 'a field key needs at least three characters.';
  if (key.length > SLUG_MAX) return 'a field key cannot be longer than ' + SLUG_MAX + ' characters.';
  if (key.startsWith('-') || key.endsWith('-')) {
    return 'a field key cannot start or end with a hyphen.';
  }
  if (!/^[a-z0-9-]+$/.test(key)) {
    return 'a field key can only use lowercase letters, numbers and hyphens.';
  }
  return null;
}
