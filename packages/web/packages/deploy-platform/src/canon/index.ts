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
const WWW_PREFIX = /^www\./;

/** Env implied by a host's leading label: `staging.x` → staging, plain apex → production.
 *  A leading `www.` is skipped first, exactly as {@link siteApex} folds it away — otherwise
 *  `www.staging.x.com` reads as production and its staging deployment is monitored, and
 *  reported, as prod. */
export function hostEnv(host: string): string {
  const m = ENV_PREFIX.exec(host.replace(WWW_PREFIX, ""));
  if (!m) return "production";
  const p = m[1]!;
  return p === "prod" || p === "production" ? "production" : p === "preview" ? "staging" : p;
}

/**
 * The host a SITE is identified by: leading `www.` and/or env labels removed, so
 * `www.x.com`, `x.com`, `staging.x.com` and `www.staging.x.com` all collapse to `x.com`.
 *
 * `www.` matters as much as the env labels do: a product whose production endpoint is
 * `www.x.com` while its staging host is `staging.x.com` shares NO apex under env-label
 * stripping alone — so the staging project looks unowned, gets planned as a new site named
 * after the same project base, and collides with the site production already created.
 * Loops because either prefix can front the other, but never strips below TWO labels:
 * `staging.io` must not reduce to `io`, or every host under that TLD shares one "apex".
 */
export function siteApex(host: string): string {
  let h = host;
  for (;;) {
    const next = h.replace(WWW_PREFIX, "").replace(ENV_PREFIX, "");
    if (next === h || next.split(".").length < 2) return h;
    h = next;
  }
}

// Hosts a deploy PROVIDER hands out. Two sites under `*.up.railway.app` share only their
// provider, not a product family — so these can never seed the family grouping below the
// way two `*.example.com` hosts do.
const PROVIDER_SUFFIXES = [
  "vercel.app",
  "railway.app",
  "pages.dev",
  "workers.dev",
  "netlify.app",
  "onrender.com",
  "fly.dev",
  "herokuapp.com",
  "github.io",
  "web.app",
  "firebaseapp.com",
  "azurestaticapps.net",
  "ondigitalocean.app",
  "deno.dev",
  "surge.sh",
];

// Public suffixes that take THREE labels rather than two. Deliberately tiny — the fleet is
// .com/.app/.ai/.dev; extend it when a real host needs it rather than vendoring a PSL.
const TWO_PART_TLDS = ["co.uk", "org.uk", "ac.uk", "com.au", "co.nz", "co.jp", "com.br"];

/**
 * The registrable domain a host belongs to (`x.com` for `a.b.x.com`) — the COARSE "same
 * product family" key, one level up from `siteApex`. `null` when the answer would be
 * meaningless: a provider-issued host, or a host with no dot at all.
 */
export function domainFamily(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h.includes(".")) return null;
  if (PROVIDER_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return null;
  const labels = h.split(".");
  const take = TWO_PART_TLDS.includes(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.length <= take ? h : labels.slice(-take).join(".");
}

/** Project name minus its env marker → the base every environment of one product shares.
 *  Both spellings {@link envFromProject} reads: the current `-staging`/`-testing`/
 *  `-production` SUFFIX and the legacy `staging.`/`testing.` PREFIX (`staging.adh` → `adh`).
 *  The two must stay symmetric — a name whose env this can't strip matches no sibling and
 *  is then NAMED for the base its sibling's site already holds. */
export function projectBaseName(projectName: string): string {
  return projectName.replace(/^(staging|testing)\./, "").replace(/-(production|staging|testing)$/, "");
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
