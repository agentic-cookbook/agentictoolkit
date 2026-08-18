import { mapLimit, withTimeout } from "../util/index.js";
import { providerConnFromConfig, type DeployDb } from "../conn/index.js";
import { deployProjectMeta } from "../schema/index.js";
import { platformCanon } from "../canon/index.js";
import {
  listRailwayProjects,
  listRailwayProjectDomains,
  railwayProjectEnvironments,
  railwayEnvRank,
  type RailwayEnvDomains,
  withResolvedCfAccount,
  listWorkerScripts,
  listWorkerCustomDomains,
  canonicalHostByWorker,
  fetchProjectDomains,
} from "../providers/index.js";

/** A deploy project as enumerated from the providers (Vercel meta + live Railway +
 *  live Cloudflare) — the ONE enumeration of "what projects exist", surfaced by
 *  /deploy-projects. */
export interface EnumeratedProject {
  platform: string;
  projectName: string;
  /** The deploy ENVIRONMENT this entry represents. Railway serves every environment
   *  (production/staging/testing) from ONE project, so its project is enumerated as one
   *  entry PER environment — each carrying that env's own domain(s). Vercel/Cloudflare
   *  projects are env-specific, so this is null there (their env is derived from the
   *  project name). Drives the per-environment `wired` correlation via `deployTargetKey`. */
  environment: string | null;
  domain: string | null;
  /** EVERY domain the project serves (canonical + redirect aliases). For Vercel
   *  this is the full custom-domain list; CF/Railway have one, so `[domain]`. */
  domains: string[];
  gitRepo: string | null;
  gitBranch: string | null;
  rootDirectory: string | null;
  framework: string | null;
}

/** An enumeration plus the PROVENANCE a caller needs to act on an ABSENCE. */
export interface DeployEnumeration {
  projects: EnumeratedProject[];
  /** The canonical platforms this run listed LIVE and completely — i.e. the ones whose
   *  absence from `projects` proves the project is gone. A provider that errored, timed
   *  out, isn't authorized to enumerate (a project-scoped Railway token), or degraded to
   *  its configured fallback list is deliberately ABSENT: its list is missing names that
   *  still exist, and a caller that treated those as retired would re-point live monitors.
   *
   *  `vercel` is never here — its projects come from the `deploy_project_meta` mirror, not
   *  from a call this function makes, so only the caller that refreshed that table knows
   *  whether the read behind it was complete. It adds `vercel` itself when it was. */
  verifiedPlatforms: string[];
  /** The canonical platforms whose DOMAIN reads all succeeded this pass — i.e. the ones
   *  whose `domains` lists are complete enough that a host's ABSENCE from them proves no
   *  project serves it.
   *
   *  A separate fact from {@link verifiedPlatforms}, because they fail separately: listing
   *  an account's projects and listing one project's domains are different calls with
   *  different scopes, and the domain fan-out is the one that fails PARTIALLY (a 403 on a
   *  single project, one project's timeout). Every such failure collapses to an EMPTY
   *  domain list, which reads exactly like "this project serves nothing" — so a caller
   *  that DELETES a monitor for being unclaimed needs this set, not merely a complete
   *  project list. Unlike `verifiedPlatforms`, `vercel` CAN appear here: the domain lists
   *  are fetched by this function (the meta mirror only supplies the canonical domain). */
  verifiedDomains: string[];
}

/**
 * Enumerate every deploy project the monitor knows about: the persisted Vercel meta
 * (with custom domains) plus freshly-polled Railway projects and Cloudflare worker
 * scripts. Each provider fetch is time-boxed and falls back to the last-known config
 * snapshot, so a slow/absent provider degrades to its cached list rather than failing.
 *
 * The bare project list, for the callers that only render it. A caller that must reason
 * about a project being MISSING needs {@link enumerateDeployProjectsVerified} instead —
 * this shape cannot distinguish "gone" from "we couldn't look".
 */
export async function enumerateDeployProjects(db: DeployDb): Promise<EnumeratedProject[]> {
  return (await enumerateDeployProjectsVerified(db)).projects;
}

/** {@link enumerateDeployProjects}, plus which platforms the listing can speak for. */
export async function enumerateDeployProjectsVerified(db: DeployDb): Promise<DeployEnumeration> {
  const conn = await providerConnFromConfig(db);
  const railwayTimer = withTimeout(6_000);
  // One Railway project list, shared by the enumeration AND the per-project domain
  // resolution — so the latter can overlap the Cloudflare work instead of waiting for it.
  // The timer bounds ONLY this list call, so clear it the moment the list settles (not
  // after the whole Promise.all, which now also includes the slower domain resolution).
  // `live` records whether that list came from the ACCOUNT or from the configured
  // fallback — the difference between "these are all the projects there are" and "these
  // are the ones somebody wrote down". Only the former licenses reading an absence.
  const railwayListingP: Promise<{ projects: { id: string; name: string }[]; live: boolean }> = (
    conn.railway.token
      ? listRailwayProjects(conn.railway.token, railwayTimer.signal).then((r) =>
          r ? { projects: r, live: true } : { projects: conn.railway.projects ?? [], live: false },
        )
      : Promise.resolve({ projects: [] as { id: string; name: string }[], live: false })
  ).finally(() => railwayTimer.done());
  const railwayProjectsP = railwayListingP.then((l) => l.projects);

  const [metas, railwayListing, cf, railwayDomains] = await Promise.all([
    db.select().from(deployProjectMeta),
    railwayListingP,
    // Resolve the CF account ONCE (a blank CLOUDFLARE_ACCOUNT_ID is discovered from the
    // token), then fan out to the worker list + the live custom-domain map under that
    // single account — so the two can't race a duplicate /accounts probe. Null (no token
    // or unresolved account) degrades both to their fallbacks below.
    withResolvedCfAccount(conn.cloudflare, async (acct, token, signal) => {
      const [scriptsResult, hostToWorker] = await Promise.all([
        listWorkerScripts(acct, token, signal),
        listWorkerCustomDomains(acct, token, signal),
      ]);
      return { scripts: "scripts" in scriptsResult ? scriptsResult.scripts : null, hostToWorker };
    }),
    // Railway writes no project meta either, so resolve one representative host per
    // project. Chained off the SAME project list so it overlaps the Cloudflare fetch.
    railwayProjectsP.then((projects) => resolveRailwayDomains(conn.railway.token, projects)),
  ]);

  const railwayProjects = railwayListing.projects;
  const railwayDomainByProject = railwayDomains.byProject;
  const workerScripts = cf?.scripts ?? conn.cloudflare.workerScripts ?? [];
  // The live worker custom-domain map (the SAME source Cloudflare routes with),
  // inverted to worker→host. Vercel writes domains into deployProjectMeta, but CF/Railway
  // never do — without this every CF worker enumerates domain-less and can't auto-configure.
  const cfHostByWorker = cf?.hostToWorker ? canonicalHostByWorker(cf.hostToWorker) : {};

  const metaByKey = new Map(metas.map((m) => [`${m.platform}|${m.projectName}`, m]));

  // Vercel (from meta) + Cloudflare (worker scripts) are env-specific projects — one
  // pair each. Railway is expanded PER ENVIRONMENT below, so it's deliberately absent here.
  const pairs = new Map<string, { platform: string; projectName: string }>();
  for (const m of metas) pairs.set(`${m.platform}|${m.projectName}`, { platform: m.platform, projectName: m.projectName });
  for (const s of workerScripts) pairs.set(`cloudflare-pages|${s}`, { platform: 'cloudflare-pages', projectName: s });

  // Resolve EVERY Vercel project's FULL domain list (canonical apex + redirect
  // aliases like olylo.ai/www.olylo.ai → ia.olylo.ai) so Auto Configure can wire an
  // endpoint that monitors ANY of a project's domains, not just the one canonical
  // host. Cached per project (1h) in the fetcher and each fetch self-bounds at 5s,
  // so a slow/absent Vercel degrades to the single canonical domain (below) rather
  // than stalling the enumeration.
  const vercelDomains = new Map<string, string[]>();
  // Every Vercel project's domain read succeeded — the precondition for reading a host's
  // absence from these lists as "no Vercel project serves it". ONE project's failed read
  // (403, timeout, 5xx) disqualifies the platform: its domains are missing from the index,
  // and a caller can't know which host that cost it. A tokenless run never looks at all.
  let vercelDomainsLive = !!conn.vercel.token;
  if (conn.vercel.token) {
    const vercelPairs = [...pairs.values()].filter((p) => platformCanon(p.platform) === 'vercel');
    await mapLimit(vercelPairs, 8, async (p) => {
      const { domains: ds, live } = await fetchProjectDomains(conn.vercel.token!, conn.vercel.teamId, p.projectName);
      if (!live) vercelDomainsLive = false;
      if (ds.length) vercelDomains.set(p.projectName, ds);
    });
  }

  // Vercel + Cloudflare: one env-agnostic entry per pair (environment null — their env
  // is encoded in the project name, resolved downstream by envFromProject).
  const vercelCf: EnumeratedProject[] = [...pairs.values()].map(({ platform, projectName }) => {
    const m = metaByKey.get(`${platformCanon(platform)}|${projectName}`) ?? metaByKey.get(`${platform}|${projectName}`);
    const liveDomain = platformCanon(platform) === 'cloudflare' ? cfHostByWorker[projectName] : undefined;
    // `|| undefined` so an EMPTY-STRING meta domain (a cleared field, not null) still
    // falls through to the live domain — `??` alone would keep the "".
    const domain = (m?.domain || undefined) ?? liveDomain ?? null;
    // Full domain list: Vercel from the live resolution above (every alias); CF has one
    // representative host, so [domain]. Falls back to the canonical domain otherwise.
    const domains =
      platformCanon(platform) === 'vercel'
        ? vercelDomains.get(projectName) ?? (domain ? [domain] : [])
        : domain
          ? [domain]
          : [];
    return {
      platform,
      projectName,
      environment: null,
      domain,
      domains,
      gitRepo: m?.gitRepo ?? null,
      gitBranch: m?.gitBranch ?? null,
      rootDirectory: m?.rootDirectory ?? null,
      framework: m?.framework ?? null,
    };
  });

  // Railway: ONE entry PER environment (production/staging/testing) so every env
  // enumerates — and can be pulled in — as its own monitorable target, instead of
  // collapsing the whole project to a single production host. A project whose services
  // expose no domain in any env (a Postgres/Redis project) still surfaces as a single
  // domain-less entry so the operator can see and ignore it.
  const railway: EnumeratedProject[] = railwayProjects.flatMap((p) => {
    const envs = railwayDomainByProject.get(p.name) ?? [];
    if (envs.length === 0) {
      return [{ platform: 'railway', projectName: p.name, environment: null, domain: null, domains: [], gitRepo: null, gitBranch: null, rootDirectory: null, framework: null }];
    }
    return envs.map((e) => ({
      platform: 'railway',
      projectName: p.name,
      environment: e.environment,
      domain: e.domain,
      domains: e.domains,
      gitRepo: null,
      gitBranch: null,
      rootDirectory: null,
      framework: null,
    }));
  });

  // Same rule as Railway's: `cf.scripts` is null when the worker listing failed or the
  // account couldn't be resolved, and `workerScripts` then falls back to the configured
  // list — which cannot be read as the complete truth about what exists.
  const verifiedPlatforms = [...(railwayListing.live ? ["railway"] : []), ...(cf?.scripts ? ["cloudflare"] : [])];

  // Domain provenance, per platform. Each needs BOTH halves — a complete project list AND
  // complete domain reads over it — because a project missing from the list contributes no
  // domains just as surely as a project whose domain read failed. Cloudflare's domains come
  // from the account-wide `/workers/domains` map, so its one null is the whole platform's.
  const verifiedDomains = [
    ...(vercelDomainsLive ? ["vercel"] : []),
    ...(railwayListing.live && railwayDomains.complete ? ["railway"] : []),
    ...(cf?.scripts && cf.hostToWorker ? ["cloudflare"] : []),
  ];

  const projects = [...vercelCf, ...railway].sort(
    (a, b) =>
      a.platform.localeCompare(b.platform) ||
      a.projectName.localeCompare(b.projectName) ||
      // Production-first within a project (NOT alphabetical): a Railway project's env
      // entries must lead with production so uniqueByProject keeps the production
      // representative — a bare localeCompare would rank `pr-123`/`canary` ahead of it.
      railwayEnvRank(a.environment) - railwayEnvRank(b.environment) ||
      (a.environment ?? '').localeCompare(b.environment ?? ''),
  );

  return { projects, verifiedPlatforms, verifiedDomains };
}

/**
 * Per-project time box for the domains lookup, how many attempts it gets, and how many
 * run at once.
 *
 * Railway's GraphQL is fast in the median with a very fat tail. Measured from inside a
 * deployed container, 200 samples of this exact query ran p50=83ms / p90=138ms /
 * p95=189ms but p99=2237ms with a 3.4s max — and because an enumeration runs minutes
 * apart, every one of them starts on a COLD connection, which added up to 4.2s of TLS
 * setup on top. A 6s box is therefore inside the tail, not outside it, and a deployment
 * logged ~40 self-inflicted `This operation was aborted` failures a day, arriving in
 * same-millisecond bursts as a whole concurrent wave lost together.
 *
 * The tail is INDEPENDENT per request rather than sticky to a slow project (one project
 * measured slow on 2 of 20 samples and fast on the other 18), so a second attempt lands
 * in the 83ms median. That is why this is a retry and NOT a longer box: widening the box
 * would make a genuinely stuck project hold one of the four slots for twice as long,
 * spending the fan-out on the project least likely to answer. It also matters that these
 * losses are not free — a lost lookup clears `complete`, which is what tells every caller
 * "we never saw this project", suppressing the whole retirement pass for the platform.
 */
const RAILWAY_DOMAINS_TIMEOUT_MS = 6_000;
const RAILWAY_DOMAINS_ATTEMPTS = 2;
const RAILWAY_DOMAINS_CONCURRENCY = 4;

/**
 * Resolve each Railway project's monitorable hosts, split PER ENVIRONMENT (projectName →
 * one {@link RailwayEnvDomains} per environment). Each env carries its own representative
 * `domain` + full `domains` list (custom domains plus provider hosts, so provider-only
 * non-production envs still surface); the enumeration expands these into one deploy-project
 * entry per environment. Each project is queried under its own time box and independently
 * fault-tolerant, so one slow/unauthorized project can't block or fail the others; a
 * project with no monitorable host in any env is simply absent from the map.
 *
 * `complete` is that fault tolerance made VISIBLE: absent from the map means "serves no
 * host" for a project that answered and "we never saw it" for one that timed out, and only
 * a caller told which happened can act on an absence. It is false the moment ONE project's
 * read fails — including the tokenless case, where nothing was read at all.
 */
async function resolveRailwayDomains(
  token: string | undefined,
  projects: { id: string; name: string }[],
): Promise<{ byProject: Map<string, RailwayEnvDomains[]>; complete: boolean }> {
  const out = new Map<string, RailwayEnvDomains[]>();
  if (!token) return { byProject: out, complete: false };
  if (projects.length === 0) return { byProject: out, complete: true };
  let complete = true;
  // Bounded concurrency (not an unbounded Promise.all): an account token can list many
  // projects, and Railway's GraphQL is rate-limited — a 100-wide fan-out would get
  // throttled, dropping domains. 4 in flight keeps it gentle.
  await mapLimit(projects, RAILWAY_DOMAINS_CONCURRENCY, async (p) => {
    // A project the list named without an id can't be queried at all — a blind spot, not
    // a project without domains.
    if (!p.id) {
      complete = false;
      return;
    }
    for (let attempt = 1; attempt <= RAILWAY_DOMAINS_ATTEMPTS; attempt++) {
      const timer = withTimeout(RAILWAY_DOMAINS_TIMEOUT_MS);
      try {
        const services = await listRailwayProjectDomains(token, p.id, timer.signal);
        if (!services) {
          // Only OUR box firing earns a second try. A project that ANSWERED with a
          // failure (unauthorized, a GraphQL error) gave a real verdict, and asking it
          // the identical question again would only spend the fan-out twice.
          if (timer.signal.aborted && attempt < RAILWAY_DOMAINS_ATTEMPTS) continue;
          if (timer.signal.aborted) {
            console.error(`Railway project ${p.id} domains timed out on all ${RAILWAY_DOMAINS_ATTEMPTS} attempts`);
          }
          complete = false;
          return;
        }
        const envs = railwayProjectEnvironments(services);
        // Only record projects that expose a real host in at least one env; provider-only /
        // Postgres projects (no domains anywhere) stay absent so they enumerate "no domain".
        if (envs.length) out.set(p.name, envs);
        return;
      } catch {
        // One project's failure must never fail the others (or the whole endpoint) —
        // it simply contributes no domain. listRailwayProjectDomains already swallows
        // its own errors; this guards anything unexpected in the pick.
        complete = false;
        return;
      } finally {
        timer.done();
      }
    }
  });
  return { byProject: out, complete };
}
