interface VercelDomain {
  name: string;
  verified?: boolean;
  redirect?: string | null;
}

// Custom domains change ~never, but the lookup fan-out used to rerun on every
// fresh snapshot build (≥ every 30s with viewers) — hundreds of needless Vercel
// API calls. Cache the project's verified domain list for an hour (module-scope);
// BOTH the canonical-domain pick and the full-domain list derive from it, so a
// project is queried at most once an hour however many callers ask.
const DOMAIN_CACHE_TTL_MS = 60 * 60 * 1000;
const domainListCache = new Map<string, { domains: VercelDomain[]; at: number }>();

/**
 * The project's verified custom domains (apex + redirect aliases, minus
 * `*.vercel.app`), from the authoritative project domains API. Cached per project.
 * On any failure (token lacks scope, network) returns the last-known list, or [] —
 * and says so via `live`, so a caller can tell "this project serves no custom
 * domain" from "we could not look".
 */
async function fetchProjectDomainList(
  token: string,
  teamId: string | undefined,
  projectName: string,
): Promise<{ domains: VercelDomain[]; live: boolean }> {
  const hit = domainListCache.get(projectName);
  if (hit && Date.now() - hit.at < DOMAIN_CACHE_TTL_MS) return { domains: hit.domains, live: true };
  try {
    const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/domains`);
    if (teamId) url.searchParams.set("teamId", teamId);
    // Self-bounded so a stalled connection can't hang a caller (e.g. the
    // deploy-projects enumeration that resolves every project's domains).
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { domains: hit?.domains ?? [], live: false };
    const body = (await res.json()) as { domains?: VercelDomain[] };
    const domains = (body.domains ?? []).filter((d) => d.verified && !d.name.endsWith(".vercel.app"));
    domainListCache.set(projectName, { domains, at: Date.now() });
    return { domains, live: true };
  } catch {
    return { domains: hit?.domains ?? [], live: false };
  }
}

/**
 * EVERY verified custom domain of the project — the canonical apex PLUS redirect
 * aliases (e.g. `olylo.ai`/`www.olylo.ai` → `ia.olylo.ai`). The deploy-projects
 * enumeration surfaces these so Auto Configure can wire an endpoint monitoring ANY
 * of a project's domains, not just the one canonical host (which is why the
 * `olylo.ai` apex endpoint could never auto-configure — its project's canonical
 * domain is `ia.olylo.ai`).
 *
 * `live` is the PROVENANCE, and it is why this returns a shape rather than a bare
 * array: a 403 (token without project scope), a timeout, or a 5xx all return an
 * EMPTY list, which is indistinguishable from a project that genuinely serves no
 * custom domain — and a caller deciding that nothing claims a host, and therefore
 * that a monitor should be DELETED, must not treat the two the same. `live: false`
 * means this list is missing domains that may well exist.
 */
export async function fetchProjectDomains(
  token: string,
  teamId: string | undefined,
  projectName: string,
): Promise<{ domains: string[]; live: boolean }> {
  const { domains, live } = await fetchProjectDomainList(token, teamId, projectName);
  return { domains: domains.map((d) => d.name), live };
}
