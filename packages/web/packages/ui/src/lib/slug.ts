// Generic slug rules shared by feature panes (site groups, research routes,
// schema names, …). The RESERVED word list is deliberately NOT here — reserved
// words protect a HOST's URL namespace (the hub's feature routes), so hosts
// bind their own set via the `reserved` parameter (see the hub's
// src/lib/reservedSlugs.ts, which wraps these with its list).

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Best-effort conversion of free text into a candidate slug. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      // AFTER the cut: truncation at 40 can land on a hyphen, and a candidate with a
      // leading/trailing hyphen fails SLUG_REGEX (and any backend slug rules).
      .replace(/^-+|-+$/g, "")
  );
}

/** Returns a human-readable error for an invalid slug, or `null` if valid.
 *  Pass a host's reserved-word set to also reject namespace collisions. */
export function validateSlug(slug: string, reserved?: ReadonlySet<string>): string | null {
  if (!slug) return "Slug is required.";
  if (slug.length < 3) return "Use at least 3 characters.";
  if (slug.length > 40) return "Use 40 characters or fewer.";
  if (!SLUG_REGEX.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens (no leading or trailing hyphen).";
  }
  if (reserved?.has(slug.toLowerCase())) return "That slug is reserved.";
  return null;
}
