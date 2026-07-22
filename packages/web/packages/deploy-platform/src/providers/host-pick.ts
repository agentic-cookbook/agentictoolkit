// One definition of "which hostname best represents a deploy target for
// monitoring", shared by the Cloudflare (worker → custom domain) and Railway
// (service → custom domain) enumeration so they pick consistently. A target can
// front several hostnames (an apex + its `www.` alias, a brand domain plus a
// vanity one); monitoring wants ONE stable URL, so the choice must be
// deterministic and prefer the most "canonical" host.

/**
 * Order two hosts from most- to least-canonical for monitoring:
 *   1. fewer labels (an apex before a deep subdomain) — checked FIRST so a `www.`
 *      apex alias still beats a deeper non-www subdomain,
 *   2. a bare host before its `www.` alias (tiebreak among equal-depth hosts),
 *   3. shorter before longer,
 *   4. alphabetical — so the result never depends on input order.
 * Returns <0 when `a` should sort before `b`.
 */
export function compareMonitorHost(a: string, b: string): number {
  const la = a.split(".").length, lb = b.split(".").length;
  if (la !== lb) return la - lb;
  const wa = a.startsWith("www.") ? 1 : 0, wb = b.startsWith("www.") ? 1 : 0;
  if (wa !== wb) return wa - wb;
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Pick the single canonical host from a set (lowercased, trimmed, blanks dropped),
 * or null when the set is empty. Deterministic via `compareMonitorHost`.
 */
export function pickCanonicalHost(hosts: readonly string[]): string | null {
  const cleaned = hosts.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0);
  if (cleaned.length === 0) return null;
  return cleaned.sort(compareMonitorHost)[0]!;
}
