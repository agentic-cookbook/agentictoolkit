import { platformCanon, deployProjectKey, envFromProject, hostEnv, siteApex, projectBaseName, epHost, slugify } from "../canon/index.js";
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
// A project with NO domain (a Cloudflare Worker) runs the SAME table: steps 1-2 are
// host-driven so they simply don't apply, step 3 still groups it with its siblings,
// and step 4 gives it a placeholder URL. It deliberately has no short-circuit of its
// own — one that skipped straight to step 4 broke the invariant above, so `api-staging`
// created a second site beside `api-production`'s instead of joining it.
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
  /** The operator opt-out, exactly as {@link EndpointLike} defines it (this type is the
   *  `StatusAddApi` view of an endpoint, and is passed straight to `endpointUnconfigured`
   *  by `wireMatchingEndpoints`). Declared HERE because it was NOT, so a host that mapped
   *  its rows onto this type dropped the flag and the endpoint axis wired every opted-out
   *  monitor anyway — a silent bug the type could have refused. Optional, and every reader
   *  checks it against `true`: a caller with no such vocabulary means "not opted out". */
  ignoreProjectWarning?: boolean;
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
  /** The sibling site this project would join already has THAT environment wired to a
   *  different project — adding another would leave two monitors claiming to be the same
   *  deployment. Named instead of silently added; the operator picks which one is real. */
  | { kind: "env-conflict"; endpointId: string; siteId: string; environment: string; existingProject: string }
  /** `replaces` — the RETIRED project name this endpoint was wired to and is being
   *  re-pointed away from (a rename/delete on the platform). Present only on a repair;
   *  absent when the endpoint was simply unwired. Callers report it: silently rewriting
   *  wiring the operator can still see on the board would be an unexplained change. */
  | { kind: "wire-endpoint"; endpointId: string; siteId: string; platform: string; deployProject: string; environment: string; replaces?: string; replacesPlatform?: string }
  | { kind: "add-endpoint"; siteId: string; url: string; environment: string; platform: string; deployProject: string }
  | { kind: "new-site"; siteName: string; siteSlug: string; url: string; environment: string; platform: string; deployProject: string };

/** This run's answer to "does this deploy project still exist?" — the enumerated names,
 *  PLUS which platforms that enumeration is allowed to speak for. Both halves are required
 *  because absence only means "deleted" on a platform we actually READ: a platform whose
 *  listing failed, or that degraded to a configured fallback list, is missing names that
 *  are perfectly alive, and treating those as retired would re-point live monitors. */
export interface LiveProjectIndex {
  /** Every enumerated project, keyed by {@link deployProjectKey}. */
  keys: ReadonlySet<string>;
  /** The CANONICAL platforms whose enumeration was a complete, authenticated, live read —
   *  the only ones whose absence is evidence. Empty ⇒ nothing is ever judged retired. */
  platforms: ReadonlySet<string>;
}

/** What the planner may consult BEYOND the endpoints — all optional, all narrowing. */
export interface PlanOpts {
  /** This run's live-project index (see {@link LiveProjectIndex}). Supplying it lets the
   *  planner tell a real conflict (two LIVE projects claiming one domain — genuinely
   *  ambiguous) from STALE WIRING (an endpoint naming a project the platform no longer
   *  has, because it was renamed or deleted). Stale wiring is REPAIRED by re-pointing the
   *  endpoint; without it every existing wiring is assumed live, which is the conservative
   *  reading and today's behavior. */
  liveProjects?: LiveProjectIndex;
}

/** Build {@link PlanOpts.liveProjects} from this run's enumeration — the ONE place the
 *  key shape is produced, so a caller can't index it differently from the planner that
 *  reads it (an off-by-one-format set would silently declare every project retired, the
 *  most destructive possible failure of this feature).
 *
 *  `verifiedPlatforms` is REQUIRED, and naming nothing is the safe answer: a caller that
 *  can't say which listings were authoritative gets an index that repairs nothing, rather
 *  than one that silently trusts a fallback list. Canonicalized here so the caller may
 *  pass whatever spelling its provider layer uses (`cloudflare-pages` ≡ `cloudflare`). */
export function indexLiveProjects(
  projects: readonly { platform: string; projectName: string }[],
  verifiedPlatforms: readonly string[],
): LiveProjectIndex {
  return {
    keys: new Set(projects.map((p) => deployProjectKey(p.platform, p.projectName))),
    platforms: new Set(verifiedPlatforms.map(platformCanon)),
  };
}

/** Decide how to represent `project` in the config given the current endpoints. */
export function planAddProject(project: ProjectLite, endpoints: EndpointLite[], opts: PlanOpts = {}): AddPlan {
  const domain = (project.domain ?? "").toLowerCase().trim();
  const platform = platformCanon(project.platform);
  const deployProject = project.projectName;
  // An explicit environment (Railway enumerates one entry per env) beats host-parsing —
  // a provider host like `svc-testing.up.railway.app` has no env-prefix a regex can read.
  const explicitEnv = project.environment?.trim() || null;

  // No domain (e.g. a Cloudflare Worker) → still monitorable, with a placeholder URL the
  // operator fills in afterwards, and its env read from the NAME (no host to read it from).
  const env = explicitEnv ?? (domain ? hostEnv(domain) : envFromProject(project.projectName));
  const url = domain ? `https://${domain}` : PLACEHOLDER_URL;
  const base = siteApex(domain);
  const projectBase = projectBaseName(deployProject);
  // Parse each endpoint's host + apex + deploy-backed-ness ONCE (else O(n) URL
  // re-parses per step, O(n·m) across an Add-all).
  const ix = endpoints.map((e) => {
    const host = epHost(e.url);
    return { e, host, apex: siteApex(host), wireable: endpointNeedsWiring(e.kind) };
  });

  // Does the project an endpoint is wired to STILL EXIST on its platform? Answered
  // against the ENDPOINT's own platform, not the one we're adding on — a monitor left
  // behind by a platform MIGRATION (site moves Vercel → Railway; the old Vercel project
  // is deleted, the new Railway one claims the same host) names a dead project just as
  // surely as a rename does, and refusing to look across platforms would leave exactly
  // that case unrepairable forever.
  //
  // What makes the cross-platform read safe is `platforms`: absence is evidence ONLY for
  // a platform whose listing this run completed and authenticated. Unknown platform,
  // unknown name, or no index at all ⇒ live, which keeps the conservative branch (leave
  // it alone) in every case we cannot actually prove.
  const stillLive = (e: EndpointLite): boolean => {
    const live = opts.liveProjects;
    if (!live || !e.deployProject) return true;
    const p = platformCanon(e.platform);
    if (!live.platforms.has(p)) return true;
    return live.keys.has(deployProjectKey(p, e.deployProject));
  };

  // 1) A DEPLOY-BACKED endpoint already monitors this exact host → wire it.
  //    A health/dns/custom probe on the same host is NOT a deploy target, so skip
  //    it here (it falls through to step 2, which adds a proper endpoint instead).
  //    Host-driven, so it doesn't apply to a domain-less project — and it must not
  //    "match" one against an endpoint whose URL failed to parse (also host "").
  const exact = domain ? ix.find((x) => x.host === domain && x.wireable)?.e : undefined;
  if (exact) {
    // Already wired to a DIFFERENT project. Two LIVE projects sharing a domain is
    // genuinely ambiguous — don't clobber it. But a name the platform NO LONGER HAS is
    // not a rival: it is this same deployment under its OLD name (renamed, or replaced),
    // and leaving it is what made the project read "not monitored" while its own domain
    // sat monitored — an alert with NO action that could ever clear it, re-offered on
    // every run. Re-point the endpoint instead, and say what was replaced.
    if (exact.deployProject && exact.deployProject !== deployProject) {
      if (stillLive(exact)) return { kind: "conflict", endpointId: exact.id, existingProject: exact.deployProject };
      return {
        kind: "wire-endpoint",
        endpointId: exact.id,
        siteId: exact.siteId,
        platform,
        deployProject,
        environment: exact.environment || env,
        replaces: exact.deployProject,
        // The platform the RETIRED name belonged to — not necessarily this project's. A
        // migration re-points a vercel monitor onto a railway project, and a report that
        // named the new platform would say railway no longer has a name railway never had.
        replacesPlatform: platformCanon(exact.platform),
      };
    }
    // Preserve an operator-set environment; only fill it in when missing.
    return { kind: "wire-endpoint", endpointId: exact.id, siteId: exact.siteId, platform, deployProject, environment: exact.environment || env };
  }

  // 2) A site already owns the apex (an endpoint on the same host sans env prefix).
  //    Prefer a deploy-backed (frontend/admin) endpoint so a new frontend isn't
  //    grafted onto a backend/health-only site that merely shares the apex.
  //    Also host-driven: `base` is "" for a domain-less project, which would otherwise
  //    "own the apex" of every unparseable endpoint URL.
  const owner = base ? (ix.find((x) => x.apex === base && x.wireable) ?? ix.find((x) => x.apex === base))?.e : undefined;
  if (owner) {
    return { kind: "add-endpoint", siteId: owner.siteId, url, environment: env, platform, deployProject };
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
    // …unless that site's SAME environment is already backed by ANOTHER project. Siblings
    // share only a name here (step 2 missed, so their hosts share no apex), and a site
    // carrying two `production` monitors wired to different deploy projects is a duplicate
    // no display can untangle — one of them is not what it claims to be. Name it and let
    // the operator decide, rather than quietly adding the second.
    //
    // A RETIRED rival is deliberately still a rival here — unlike step 1. There the repair
    // is exact: the incumbent monitors THIS project's own domain, so re-pointing it states
    // a fact. Here the rival monitors a different host, so there is nothing to re-point;
    // relaxing the guard would only ADD a second monitor beside the stale one, leaving the
    // site with two claims on one environment — the very state this rule exists to prevent
    // — and the stale one would not even be swept, since the cycle's retire vetoes on a
    // host that still answers.
    const rival = ix.find(
      (x) =>
        x.e.siteId === sibling.siteId &&
        x.wireable &&
        x.e.environment === env &&
        !!x.e.deployProject &&
        x.e.deployProject !== deployProject,
    )?.e;
    if (rival) {
      return { kind: "env-conflict", endpointId: rival.id, siteId: rival.siteId, environment: env, existingProject: rival.deployProject! };
    }
    return { kind: "add-endpoint", siteId: sibling.siteId, url, environment: env, platform, deployProject };
  }

  // 4) Nobody owns it — a new site named for the project's base (the same key step 3
  //    matches on, so the next sibling lands HERE instead of re-deriving this name).
  return { kind: "new-site", siteName: projectBase, siteSlug: slugify(projectBase), url, environment: env, platform, deployProject };
}
