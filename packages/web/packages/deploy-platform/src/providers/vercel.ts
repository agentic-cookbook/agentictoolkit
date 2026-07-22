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
 * On any failure (token lacks scope, network) returns the last-known list, or [].
 */
async function fetchProjectDomainList(token: string, teamId: string | undefined, projectName: string): Promise<VercelDomain[]> {
  const hit = domainListCache.get(projectName);
  if (hit && Date.now() - hit.at < DOMAIN_CACHE_TTL_MS) return hit.domains;
  try {
    const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/domains`);
    if (teamId) url.searchParams.set("teamId", teamId);
    // Self-bounded so a stalled connection can't hang a caller (e.g. the
    // deploy-projects enumeration that resolves every project's domains).
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return hit?.domains ?? [];
    const body = (await res.json()) as { domains?: VercelDomain[] };
    const domains = (body.domains ?? []).filter((d) => d.verified && !d.name.endsWith(".vercel.app"));
    domainListCache.set(projectName, { domains, at: Date.now() });
    return domains;
  } catch {
    return hit?.domains ?? [];
  }
}

/**
 * EVERY verified custom domain of the project — the canonical apex PLUS redirect
 * aliases (e.g. `olylo.ai`/`www.olylo.ai` → `ia.olylo.ai`). The deploy-projects
 * enumeration surfaces these so Auto Configure can wire an endpoint monitoring ANY
 * of a project's domains, not just the one canonical host (which is why the
 * `olylo.ai` apex endpoint could never auto-configure — its project's canonical
 * domain is `ia.olylo.ai`).
 */
export async function fetchProjectDomains(token: string, teamId: string | undefined, projectName: string): Promise<string[]> {
  const list = await fetchProjectDomainList(token, teamId, projectName);
  return list.map((d) => d.name);
}
