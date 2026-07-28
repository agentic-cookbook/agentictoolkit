// ---------------------------------------------------------------------------
// Builder's project → site model. Where the status app matches an enumerated
// deploy project to a MONITORING endpoint (host-driven), the builder matches the
// same enumerated project to a BUILDER SITE (repo/domain/slug-driven) and either
// fills in the site's production URL or creates the site.
//
// Pure planner (`planBuilderSite`) + injected-I/O runner (`runBuilderAutoConfigure`),
// mirroring plan.ts / run.ts. The runner reuses `applySequentially` from run.ts so
// its sequencing + skip-collection semantics are the SAME single definition — no
// duplicated loop. A site row is one insert, so the create path needs no multi-step
// rollback; an update/create that throws is recorded in `skipped`, never rethrown.
// ---------------------------------------------------------------------------
import { platformCanon, projectBaseName, epHost, slugify } from "../canon/index.js";
import { applySequentially, type ApplyOutcome, type AutoConfigureResult } from "./run.js";

/** A structural subset of the enumerate package's `EnumeratedProject` — only the
 *  fields the builder match reads (so a full `EnumeratedProject` is assignable). */
export interface EnumeratedProjectLike {
  platform: string;
  projectName: string;
  environment: string | null;
  domain: string | null;
  domains: string[];
  gitRepo: string | null;
  rootDirectory: string | null;
}

/** A builder site as the matcher needs to see it (the real record is assignable). */
export interface BuilderSiteLite {
  id: string;
  slug: string;
  name: string;
  repoDir: string;
  platform: string;
  prodUrl: string | null;
}

export type BuilderSitePlan =
  | { kind: "fill-prod-url"; siteId: string; prodUrl: string }
  | { kind: "new-site"; site: { name: string; slug: string; repoDir: string; platform: string; prodUrl: string | null } }
  | { kind: "skip"; reason: string };

/** Last path segment of a git repo ref (`owner/repo`, `git@host:owner/repo.git`,
 *  `https://host/owner/repo` …), with any `.git` suffix dropped. */
function repoTail(gitRepo: string): string {
  const noGit = gitRepo.replace(/\.git$/, "");
  return noGit.split(/[/:]/).filter(Boolean).pop() ?? noGit;
}

/** The project's PRODUCTION domain, or null. An env-agnostic entry (Vercel/CF,
 *  `environment === null`) and an explicit `production` entry carry the prod domain;
 *  a staging/testing entry must NOT set a site's prodUrl to its non-prod domain. */
function prodDomainOf(p: EnumeratedProjectLike): string | null {
  if (p.environment === null || p.environment === "production") return p.domain;
  return null;
}

/**
 * Match one enumerated project against builder sites: by rootDirectory == repoDir
 * first, then by canonical domain == prodUrl host, then by projectBaseName(projectName)
 * == slug. Matched + missing prodUrl ⇒ fill-prod-url (production domain). Unmatched with
 * a usable identity ⇒ new-site (platform from project.platform via platformCanon; repoDir
 * from rootDirectory ?? repo tail of gitRepo ?? projectName; prodUrl from the
 * production-environment domain if any). No rootDirectory AND no domain AND no gitRepo ⇒
 * skip("no identity").
 */
export function planBuilderSite(project: EnumeratedProjectLike, sites: BuilderSiteLite[]): BuilderSitePlan {
  const rootDir = project.rootDirectory?.trim() || null;
  const canonHost = project.domain ? epHost(`https://${project.domain}`) : null;
  const base = projectBaseName(project.projectName);

  // Match order: rootDirectory == repoDir, then canonical domain == prodUrl host,
  // then projectBaseName == slug. First hit wins. The slug comparison SLUGIFIES the base —
  // the same transform the create below names with, so a base that isn't already slug-shaped
  // (`staging.adh`) matches the site it created last run instead of asking for that slug again.
  const matched =
    (rootDir ? sites.find((s) => !!s.repoDir && s.repoDir === rootDir) : undefined) ??
    (canonHost ? sites.find((s) => !!s.prodUrl && epHost(s.prodUrl) === canonHost) : undefined) ??
    sites.find((s) => s.slug === slugify(base));

  const prodDomain = prodDomainOf(project);
  const prodUrl = prodDomain ? `https://${prodDomain}` : null;

  if (matched) {
    if (matched.prodUrl) return { kind: "skip", reason: "already configured" }; // nothing to fill
    if (prodUrl) return { kind: "fill-prod-url", siteId: matched.id, prodUrl };
    return { kind: "skip", reason: "no production domain to fill" };
  }

  // Unmatched — build a new site only when the project has a usable identity.
  if (!rootDir && !project.domain && !project.gitRepo) return { kind: "skip", reason: "no identity" };
  const repoDir = rootDir ?? (project.gitRepo ? repoTail(project.gitRepo) : null) ?? project.projectName;
  return {
    kind: "new-site",
    site: { name: base, slug: slugify(base), repoDir, platform: platformCanon(project.platform), prodUrl },
  };
}

/** The subset of the builder's site client the runner calls (the caller injects the real
 *  client; tests inject a fake). Creation is opt-in via the group in `runBuilderAutoConfigure`. */
export interface BuilderApplyApi {
  createSite(body: { name: string; slug: string; repoDir: string; platform: string; prodUrl: string | null; groupId: string }): Promise<{ id: string }>;
  updateSite(id: string, body: { prodUrl: string }): Promise<unknown>;
  deleteSite(id: string): Promise<void>;
}

/**
 * Apply {@link planBuilderSite} to every enumerated project in sequence, filling a
 * matched site's missing prodUrl or (opt-in via `opts.create`) creating a new site.
 * Reuses `applySequentially`, so the sequencing + skip-collection is the SAME definition
 * the status runner uses. A working site snapshot chains through the run so a site created
 * for one project entry is visible to a later entry of the same project (e.g. its staging
 * variant). Resilient: an update/create that throws is recorded in `skipped`, never fatal.
 */
export async function runBuilderAutoConfigure(
  projects: EnumeratedProjectLike[],
  sites: BuilderSiteLite[],
  opts: { api: BuilderApplyApi; create?: { groupId: string } },
): Promise<AutoConfigureResult<EnumeratedProjectLike>> {
  const { api, create } = opts;
  let working = [...sites]; // reassigned as sites are created so later matches see them
  return applySequentially(projects, async (project): Promise<ApplyOutcome> => {
    const plan = planBuilderSite(project, working);
    if (plan.kind === "skip") return { kind: "skipped", reason: plan.reason };
    if (plan.kind === "fill-prod-url") {
      await api.updateSite(plan.siteId, { prodUrl: plan.prodUrl });
      working = working.map((s) => (s.id === plan.siteId ? { ...s, prodUrl: plan.prodUrl } : s));
      return { kind: "added" };
    }
    // new-site: creation is opt-in — without a target group we leave it for the operator.
    if (!create) return { kind: "skipped", reason: "no group to create the site in" };
    const created = await api.createSite({ ...plan.site, groupId: create.groupId });
    working = [...working, { id: created.id, ...plan.site }];
    return { kind: "created" };
  });
}
