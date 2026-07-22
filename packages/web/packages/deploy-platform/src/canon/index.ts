// Canonicalization + env-derivation helpers shared by the deploy engine: the
// platform/project correlation key, the project-name → environment convention, and
// the host/project string manipulation the "Add project" planner relies on. All pure.

// The deployments table records Cloudflare as "cloudflare-pages"; config uses the
// friendlier "cloudflare". Treat them as one platform when matching.
export function platformCanon(p: string | null | undefined): string {
  return p === "cloudflare-pages" ? "cloudflare" : (p ?? "");
}

/**
 * The correlation key shared by a deploy and an endpoint: canonical platform +
 * project, plus the environment ONLY for railway (where one project serves every
 * env). Vercel/Cloudflare projects are env-specific, so their key omits the env —
 * a deploy and its endpoint agree on the key from either side.
 */
export function deployTargetKey(platform: string | null | undefined, project: string | null | undefined, environment: string | null | undefined): string | null {
  const p = platformCanon(platform);
  if (!p || !project) return null;
  // Lowercase the env so a case difference between the enumerated project env (always
  // lowercased) and an endpoint's stored env can't silently break the correlation.
  return `${p}|${project}|${p === "railway" ? (environment?.toLowerCase() ?? "") : ""}`;
}

/**
 * Environment for a deploy/build row, derived from the project name.
 * The repo convention encodes env as a `staging.`/`testing.` prefix on the
 * Vercel project (`staging.adh`, `testing.admin.adh`); anything else is prod.
 * (The deploy's own `environment` field is the Vercel *target* and unreliable
 * here — `staging.adh`'s target is still "production".)
 */
export function envFromProject(projectName: string): string {
  // Vercel projects encode env either as a legacy `staging.`/`testing.` prefix
  // (e.g. `staging.adh`) or the current `-staging`/`-testing` suffix from
  // provision-vercel (e.g. `docs-staging`); anything else is production.
  if (projectName.startsWith("staging.") || projectName.endsWith("-staging")) return "staging";
  if (projectName.startsWith("testing.") || projectName.endsWith("-testing")) return "testing";
  return "production";
}

/** Hostname of a URL, or the raw string when it isn't a parseable URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const ENV_PREFIX = /^(staging|testing|preview|prod|production)\./;

/** Env implied by a host's leading label: `staging.x` → staging, plain apex → production. */
export function hostEnv(host: string): string {
  const m = ENV_PREFIX.exec(host);
  if (!m) return "production";
  const p = m[1]!;
  return p === "prod" || p === "production" ? "production" : p === "preview" ? "staging" : p;
}

/** Drop a single leading env label so staging/testing/prod hosts collapse to one apex. */
export function stripEnvPrefix(host: string): string {
  return host.replace(ENV_PREFIX, "");
}

/** Project name minus a trailing `-production`/`-staging`/`-testing` suffix → the base. */
export function projectBaseName(projectName: string): string {
  return projectName.replace(/-(production|staging|testing)$/, "");
}

/** Endpoint host, lowercased, with any `:port` stripped (project domains are bare). */
export function epHost(url: string): string {
  return hostOf(url).toLowerCase().replace(/:\d+$/, "");
}

/** Lowercase, hyphenate runs of non-alphanumerics, trim leading/trailing hyphens.
 * The one shared slug form for groups and sites. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
