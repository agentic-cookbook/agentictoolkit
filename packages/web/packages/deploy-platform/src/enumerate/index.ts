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

/**
 * Enumerate every deploy project the monitor knows about: the persisted Vercel meta
 * (with custom domains) plus freshly-polled Railway projects and Cloudflare worker
 * scripts. Each provider fetch is time-boxed and falls back to the last-known config
 * snapshot, so a slow/absent provider degrades to its cached list rather than failing.
 */
export async function enumerateDeployProjects(db: DeployDb): Promise<EnumeratedProject[]> {
  const conn = await providerConnFromConfig(db);
  const railwayTimer = withTimeout(6_000);
  // One Railway project list, shared by the enumeration AND the per-project domain
  // resolution — so the latter can overlap the Cloudflare work instead of waiting for it.
  // The timer bounds ONLY this list call, so clear it the moment the list settles (not
  // after the whole Promise.all, which now also includes the slower domain resolution).
  const railwayProjectsP: Promise<{ id: string; name: string }[]> = (
    conn.railway.token
      ? listRailwayProjects(conn.railway.token, railwayTimer.signal).then((r) => r ?? conn.railway.projects ?? [])
      : Promise.resolve<{ id: string; name: string }[]>([])
  ).finally(() => railwayTimer.done());

  const [metas, railwayProjects, cf, railwayDomainByProject] = await Promise.all([
    db.select().from(deployProjectMeta),
    railwayProjectsP,
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
  if (conn.vercel.token) {
    const vercelPairs = [...pairs.values()].filter((p) => platformCanon(p.platform) === 'vercel');
    await mapLimit(vercelPairs, 8, async (p) => {
      const ds = await fetchProjectDomains(conn.vercel.token!, conn.vercel.teamId, p.projectName);
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

  return [...vercelCf, ...railway].sort(
    (a, b) =>
      a.platform.localeCompare(b.platform) ||
      a.projectName.localeCompare(b.projectName) ||
      // Production-first within a project (NOT alphabetical): a Railway project's env
      // entries must lead with production so uniqueByProject keeps the production
      // representative — a bare localeCompare would rank `pr-123`/`canary` ahead of it.
      railwayEnvRank(a.environment) - railwayEnvRank(b.environment) ||
      (a.environment ?? '').localeCompare(b.environment ?? ''),
  );
}

/**
 * Resolve each Railway project's monitorable hosts, split PER ENVIRONMENT (projectName →
 * one {@link RailwayEnvDomains} per environment). Each env carries its own representative
 * `domain` + full `domains` list (custom domains plus provider hosts, so provider-only
 * non-production envs still surface); the enumeration expands these into one deploy-project
 * entry per environment. Each project is queried under its own time box and independently
 * fault-tolerant, so one slow/unauthorized project can't block or fail the others; a
 * project with no monitorable host in any env is simply absent from the map.
 */
async function resolveRailwayDomains(
  token: string | undefined,
  projects: { id: string; name: string }[],
): Promise<Map<string, RailwayEnvDomains[]>> {
  const out = new Map<string, RailwayEnvDomains[]>();
  if (!token || projects.length === 0) return out;
  // Bounded concurrency (not an unbounded Promise.all): an account token can list many
  // projects, and Railway's GraphQL is rate-limited — a 100-wide fan-out would get
  // throttled, dropping domains. 4 in flight keeps it gentle.
  await mapLimit(projects, 4, async (p) => {
    if (!p.id) return;
    const timer = withTimeout(6_000);
    try {
      const services = await listRailwayProjectDomains(token, p.id, timer.signal);
      if (!services) return;
      const envs = railwayProjectEnvironments(services);
      // Only record projects that expose a real host in at least one env; provider-only /
      // Postgres projects (no domains anywhere) stay absent so they enumerate "no domain".
      if (envs.length) out.set(p.name, envs);
    } catch {
      // One project's failure must never fail the others (or the whole endpoint) —
      // it simply contributes no domain. listRailwayProjectDomains already swallows
      // its own errors; this guards anything unexpected in the pick.
    } finally {
      timer.done();
    }
  });
  return out;
}
