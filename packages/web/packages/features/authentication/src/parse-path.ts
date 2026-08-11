import { notFound } from "next/navigation";

/** The two token families this feature manages, as they stand in the URL. */
export const TOKEN_SECTIONS = ["api", "storage"] as const;
export type TokenSection = (typeof TOKEN_SECTIONS)[number];

export interface TokensPathSelection {
  /** The open topic, or undefined for the bare topic list. */
  section?: TokenSection;
  /** The selected token's id within that topic, or undefined for none. */
  tokenId?: string;
}

/**
 * The segments BELOW the workspace → this feature's view state:
 *
 *   /<ws>                      the topic list, nothing selected
 *   /<ws>/<section>            that family's token list, nothing selected
 *   /<ws>/<section>/<tokenId>  that token's detail
 *
 * Both deeper levels are addressable, which the HTD recipe requires of every rail
 * (`must-deep-link-every-level`).
 *
 * An unrecognised section — or a fourth segment — is `notFound()`, not a silently ignored
 * selection. The section list is SETTLED (there are two token families and the backend has no
 * third), so a bad segment can only be a bad URL; letting it through would render the topic list
 * with a selection that matches nothing, which looks like the feature deciding not to open rather
 * than the address being wrong.
 */
export function parseTokensPath(segments: string[]): TokensPathSelection {
  const [section, tokenId, ...rest] = segments;
  if (rest.length > 0) notFound();
  if (section === undefined) return {};
  if (!(TOKEN_SECTIONS as readonly string[]).includes(section)) notFound();
  return { section: section as TokenSection, tokenId };
}
