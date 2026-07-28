import { platformCanon, envFromProject, hostEnv, siteApex, projectBaseName, epHost, slugify } from "../canon/index.js";
import { endpointNeedsWiring } from "./classify.js";

// A project with no known domain (e.g. a Cloudflare Worker) still gets a site +
// endpoint on Add — with this placeholder URL the operator fills in afterwards.
export const PLACEHOLDER_URL = "https://";

// ---------------------------------------------------------------------------
// "Add" planning — given a deploy project (with a domain attached, e.g.
// `agenticdeveloperhelp.com` or `staging.agenticdeveloperhelp.com`), decide how
// to represent it in the monitoring config. Domain-driven, per the operator's
// rule: match the project's domain to the site that owns that host.
//
//   1. An endpoint already monitors that exact host  → just wire it (set
//      platform + deployProject).
//   2. A site already owns the apex (has an endpoint on the same host minus any
//      `www.`/env prefix)                             → add a new endpoint there.
//   3. A site already monitors a SIBLING of this project (same platform, same
//      project base name)                             → add a new endpoint there.
//   4. Nothing owns it                                → create a new site, then
//      add the endpoint.
//
// Steps 2 and 3 both key off the same canonical form the NAME in step 4 is built
// from — matching and naming must agree, or a project matches nothing and is then
// named for a site that already exists (a slug collision that strands it forever).
//
// Pure: it returns a PLAN; the caller performs the API writes. Easy to unit-test.
// The host/project canonicalization helpers (hostEnv/siteApex/projectBaseName/
// epHost) live in ../canon so every deploy surface shares one definition.
// ---------------------------------------------------------------------------

export interface EndpointLite {
  id: string;
  siteId: string;
  url: string;
  kind: string;
  environment: string | null;
  platform: string | null;
  deployProject: string | null;
}
export interface ProjectLite {
  platform: string;
  projectName: string;
  domain: string | null;
  /** The project's explicit deploy environment, when known (Railway enumerates one entry
   *  per environment). Preferred over host-parsing so a provider host like
   *  `svc-testing.up.railway.app` — which no env-prefix regex can read — still lands the
   *  endpoint on the right environment. Absent/null → fall back to inferring from the host. */
  environment?: string | null;
}

export type AddPlan =
  | { kind: "conflict"; endpointId: string; existingProject: string }
  | { kind: "wire-endpoint"; endpointId: string; siteId: string; platform: string; deployProject: string; environment: string }
  | { kind: "add-endpoint"; siteId: string; url: string; environment: string; platform: string; deployProject: string }
  | { kind: "new-site"; siteName: string; siteSlug: string; url: string; environment: string; platform: string; deployProject: string };

/** Decide how to represent `project` in the config given the current endpoints. */
export function planAddProject(project: ProjectLite, endpoints: EndpointLite[]): AddPlan {
  const domain = (project.domain ?? "").toLowerCase().trim();
  const platform = platformCanon(project.platform);
  const deployProject = project.projectName;
  // An explicit environment (Railway enumerates one entry per env) beats host-parsing —
  // a provider host like `svc-testing.up.railway.app` has no env-prefix a regex can read.
  const explicitEnv = project.environment?.trim() || null;

  // No domain (e.g. a Cloudflare Worker) → still monitorable: create a site +
  // endpoint with a placeholder URL the operator fills in. Env from the name.
  if (!domain) {
    const baseName = projectBaseName(project.projectName);
    return { kind: "new-site", siteName: baseName, siteSlug: slugify(baseName), url: PLACEHOLDER_URL, environment: explicitEnv ?? envFromProject(project.projectName), platform, deployProject };
  }

  const env = explicitEnv ?? hostEnv(domain);
  const base = siteApex(domain);
  const projectBase = projectBaseName(deployProject);
  // Parse each endpoint's host + apex + deploy-backed-ness ONCE (else O(n) URL
  // re-parses per step, O(n·m) across an Add-all).
  const ix = endpoints.map((e) => {
    const host = epHost(e.url);
    return { e, host, apex: siteApex(host), wireable: endpointNeedsWiring(e.kind) };
  });

  // 1) A DEPLOY-BACKED endpoint already monitors this exact host → wire it.
  //    A health/dns/custom probe on the same host is NOT a deploy target, so skip
  //    it here (it falls through to step 2, which adds a proper endpoint instead).
  const exact = ix.find((x) => x.host === domain && x.wireable)?.e;
  if (exact) {
    // Already wired to a DIFFERENT project (e.g. two projects share a domain) →
    // ambiguous; don't clobber the existing wiring.
    if (exact.deployProject && exact.deployProject !== deployProject) {
      return { kind: "conflict", endpointId: exact.id, existingProject: exact.deployProject };
    }
    // Preserve an operator-set environment; only fill it in when missing.
    return { kind: "wire-endpoint", endpointId: exact.id, siteId: exact.siteId, platform, deployProject, environment: exact.environment || env };
  }

  // 2) A site already owns the apex (an endpoint on the same host sans env prefix).
  //    Prefer a deploy-backed (frontend/admin) endpoint so a new frontend isn't
  //    grafted onto a backend/health-only site that merely shares the apex.
  const owner = (ix.find((x) => x.apex === base && x.wireable) ?? ix.find((x) => x.apex === base))?.e;
  if (owner) {
    return { kind: "add-endpoint", siteId: owner.siteId, url: `https://${domain}`, environment: env, platform, deployProject };
  }

  // 3) A site already has an endpoint wired to a SIBLING of this project — same platform,
  //    same project BASE name (`x-production` / `x-staging` / `x-testing` → `x`) → add the
  //    new env's endpoint there. This groups a Railway project's per-environment entries
  //    onto ONE site even when their provider hosts (`svc-production…` / `svc-staging…`)
  //    share no apex, AND groups Vercel's per-env PROJECTS (`x-staging` is a different
  //    project from `x-production`, not a different env of one) onto that same site.
  //    Matching on the base is what makes step 4's base-derived NAME safe: without it a
  //    sibling is named for a site that already exists and its slug 409s forever.
  const sibling = ix.find(
    (x) => x.wireable && !!x.e.deployProject && projectBaseName(x.e.deployProject) === projectBase && platformCanon(x.e.platform) === platform,
  )?.e;
  if (sibling) {
    return { kind: "add-endpoint", siteId: sibling.siteId, url: `https://${domain}`, environment: env, platform, deployProject };
  }

  // 4) Nobody owns it — a new site named for the project's base (the same key step 3
  //    matches on, so the next sibling lands HERE instead of re-deriving this name).
  return { kind: "new-site", siteName: projectBase, siteSlug: slugify(projectBase), url: `https://${domain}`, environment: env, platform, deployProject };
}
