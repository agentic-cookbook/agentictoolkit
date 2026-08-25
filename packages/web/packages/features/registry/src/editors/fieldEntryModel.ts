import { tightestVisibility, visibilitiesWithin } from '@agenticdevelopertoolkit/registry-types';
import type { FieldDefLike } from '@agenticdevelopertoolkit/registry-types';
import type { FieldVisibility } from '../client';

/**
 * Everything the registrant-facing field control KNOWS, with none of what it looks like —
 * the same split `fieldDefModel` makes for the owner's builder, and for the same reason.
 *
 * `FieldEditor` beside this file is the zero-dependency rendering, for a host with no design
 * system of its own; a host that HAS one (adh's hub) builds the row from its own primitives
 * and imports this, so the two skins cannot disagree about what an audience is called, which
 * `<input type>` a catalog type takes, or how a stored value becomes text.
 */

/**
 * What each audience is CALLED to the registrant, whose question is "who sees this?" —
 * absolute, where the owner's own labels in `fieldDefModel` are ceilings ("at most …").
 *
 * Exhaustive `Record`s so an audience added to `FIELD_VISIBILITIES` is a compile error here
 * rather than an unlabelled `<option>` or a field that silently stops explaining itself.
 */
export const CHOICE_LABEL: Record<FieldVisibility, string> = {
  public: 'Anyone, including search engines',
  authenticated: 'Signed-in members only',
  private: 'Nobody but you and the registry owner',
};

/** The same audiences as a sentence, for the fields this host does not let them change. */
export const AUDIENCE_NOTE: Record<FieldVisibility, string | null> = {
  public: null,
  authenticated: 'Only signed-in members see this.',
  private: 'Only the registry owner sees this.',
};

/** The stored value as something an `<input value>` accepts, for the single-value types. */
export function asText(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** A choice field's options, filtered to the strings a `<option>` can actually render. */
export function optionsOf(def: FieldDefLike): string[] {
  const raw = def.config.options;
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : [];
}

/**
 * The `<input type>` a catalog type wants, where it is not `text`. The browser's own
 * keyboard and validation for a url/email/phone are the reason this mapping exists at all,
 * so a skin that re-derived it and missed an entry would silently take them away.
 */
export const INPUT_TYPE: Partial<Record<string, string>> = {
  url: 'url',
  email: 'email',
  phone: 'tel',
};

/** The address parts, in the order a form asks for them, with what each is called. */
export const ADDRESS_PARTS: readonly (readonly [key: string, label: string])[] = [
  ['line1', 'Street'],
  ['city', 'City'],
  ['region', 'Region'],
  ['postalCode', 'Postal code'],
  ['country', 'Country (2 letters)'],
];

// Re-exported through this module so a skin importing the entry model gets the clamping
// rules from the same place as the labels, rather than reaching past it into registry-types.
export { tightestVisibility, visibilitiesWithin };
