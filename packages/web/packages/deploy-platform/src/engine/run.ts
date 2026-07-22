// ---------------------------------------------------------------------------
// "Auto Configure" orchestration — the generalized I/O side of the MATCH. Given
// deploy projects, it wires each one to the EXISTING site (endpoint) that already
// monitors its domain, by setting that endpoint's platform + deployProject.
//
// Creation is OPT-IN (`opts.create`): when a target group is supplied, a project
// no site monitors yet is turned into a new site + endpoint (or a new endpoint on
// the site that owns its apex). Without `create` it stays MATCH-ONLY — the
// per-platform "Match" / "Match all" actions never create, so they can't graft a
// phantom site. The global "Auto Configure" review flow passes `create` once the
// operator has pruned (ignored) the projects they don't want.
//
// plan.ts stays PURE (the planner); the network writes live here. The sequential
// apply-with-rollback loop (`applySequentially`) is shared by this runner AND the
// builder runner so their sequencing/skip-collection semantics can't drift.
// ---------------------------------------------------------------------------
import { epHost, platformCanon } from "../canon/index.js";
import { planAddProject, type EndpointLite, type ProjectLite } from "./plan.js";
import { endpointUnconfigured } from "./classify.js";

/** Render an unknown thrown value as a display string (Error → message, else String). */
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** "1 site" / "3 sites" — count plus a correctly-pluralized noun. */
function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * The subset of the monitored-sites client the status runner calls. The matcher needs
 * the endpoint read + the wiring write; the opt-in creation path additionally needs
 * createSite + createEndpoint. The engine is pure I/O-injection — the CALLER supplies
 * this (the status web app wires its real monitored-sites client; tests inject a fake).
 */
export interface StatusAddApi {
  listAllEndpoints(): Promise<EndpointLite[]>;
  updateEndpoint(id: string, body: Record<string, unknown>): Promise<unknown>;
  createSite(body: { name: string; slug: string; groupId: string }): Promise<{ id: string }>;
  // Returns the CREATED endpoint as an `EndpointLite` — the adapter maps whatever the
  // server returns (a full endpoint row) onto the lite view. Its REAL server id is what
  // later intra-run variants chain against, so it must be the actual id, not synthesized.
  createEndpoint(siteId: string, body: Record<string, unknown>): Promise<EndpointLite>;
  // Only used to ROLL BACK a just-created site when its endpoint fails to create —
  // so a half-made (endpoint-less) site can't strand the project (its slug would
  // 409 every future retry). Never used to delete a site that already has endpoints.
  deleteSite(id: string): Promise<void>;
}

/** Opt-in creation: the target group new sites are filed under. Absent → match-only. */
export interface CreateOpts {
  groupId: string;
}

/** The aggregated outcome of an auto-configure run, generalized over the project type so
 *  the status runner (ProjectLite) and the builder runner share ONE result shape. `added`
 *  are items whose existing target was matched/wired; `created` are items a new site was
 *  built for (opt-in create path); `skipped` are items left with a self-contained reason. */
export interface AutoConfigureResult<T = ProjectLite> {
  added: T[];
  created: T[];
  skipped: { project: T; reason: string }[];
}

/** The outcome of applying ONE plan step — the vocabulary `applySequentially` aggregates. */
export type ApplyOutcome = { kind: "added" } | { kind: "created" } | { kind: "skipped"; reason: string };

/**
 * Run `applyOne` over `items` STRICTLY IN SEQUENCE (never parallel), collecting each item
 * into added / created / skipped. Sequential because each apply may mutate shared working
 * state that later applies must see (a wiring, or a site, created earlier in the run).
 * Resilient: one item throwing is recorded in `skipped`, never fatal to the rest. This is
 * the single sequencing definition reused by BOTH `runAutoConfigure` and
 * `runBuilderAutoConfigure` — neither duplicates the loop.
 */
export async function applySequentially<T>(
  items: T[],
  applyOne: (item: T) => Promise<ApplyOutcome>,
  onProgress?: (done: number, total: number) => void,
): Promise<AutoConfigureResult<T>> {
  const added: T[] = [];
  const created: T[] = [];
  const skipped: { project: T; reason: string }[] = [];
  const total = items.length;
  let done = 0;
  for (const item of items) {
    try {
      const r = await applyOne(item);
      if (r.kind === "added") added.push(item);
      else if (r.kind === "created") created.push(item);
      else skipped.push({ project: item, reason: r.reason });
    } catch (e) {
      skipped.push({ project: item, reason: msg(e) });
    }
    done += 1;
    onProgress?.(done, total);
  }
  return { added, created, skipped };
}

// A mutable endpoint snapshot so a sequential run sees the wirings earlier matches
// applied (e.g. a project's staging + prod variants resolving against the same site).
interface Working {
  endpoints: EndpointLite[];
}

/** Match one deploy project to the EXISTING site that monitors its domain and wire it
 *  (set platform + deployProject). When `create` is supplied, a project no site
 *  monitors is also turned into a new endpoint (on the site that owns its apex) or a
 *  new site + endpoint — so Auto Configure can ADD monitors, not just match. Without
 *  `create` it stays match-only: an unmonitored project is left for the operator, so
 *  the per-platform "Match" actions can never graft a phantom site. */
async function executeAdd(p: ProjectLite, working: Working, api: StatusAddApi, create?: CreateOpts): Promise<ApplyOutcome> {
  const plan = planAddProject({ platform: p.platform, projectName: p.projectName, domain: p.domain, environment: p.environment }, working.endpoints);
  // Reason is self-contained (no project prefix) so callers can render it as
  // `${project}: ${reason}` uniformly across skips and errors.
  if (plan.kind === "conflict") return { kind: "skipped", reason: `that domain is already wired to ${plan.existingProject}` };
  if (plan.kind === "wire-endpoint") {
    await api.updateEndpoint(plan.endpointId, { platform: plan.platform, deployProject: plan.deployProject, environment: plan.environment });
    working.endpoints = working.endpoints.map((e) =>
      e.id === plan.endpointId ? { ...e, platform: plan.platform, deployProject: plan.deployProject, environment: plan.environment } : e,
    );
    return { kind: "added" };
  }
  // add-endpoint / new-site: no existing endpoint monitors this domain. Match-only
  // (no `create`) leaves it for the operator; with `create` we add the monitor.
  if (!create) return { kind: "skipped", reason: "no site monitors this domain yet" };
  if (plan.kind === "add-endpoint") {
    const ep = await api.createEndpoint(plan.siteId, { url: plan.url, environment: plan.environment, platform: plan.platform, deployProject: plan.deployProject });
    // Reflect the new endpoint (with its real server id) in the working snapshot so a
    // later project's variant (e.g. this project's staging host) sees it and resolves
    // against the same site.
    working.endpoints = [...working.endpoints, ep];
    return { kind: "created" };
  }
  // new-site: nobody owns the apex → create the site, then its endpoint. If the
  // endpoint create fails, roll the site back: a site with no endpoint isn't just
  // useless, its (group, slug) would 409 every future Auto Configure run and strand
  // the project permanently. Rolling back lets the next run re-create it cleanly.
  const site = await api.createSite({ name: plan.siteName, slug: plan.siteSlug, groupId: create.groupId });
  let ep: EndpointLite;
  try {
    ep = await api.createEndpoint(site.id, { url: plan.url, environment: plan.environment, platform: plan.platform, deployProject: plan.deployProject });
  } catch (e) {
    await api.deleteSite(site.id).catch(() => {}); // best-effort rollback; report the original failure
    throw e;
  }
  working.endpoints = [...working.endpoints, ep];
  return { kind: "created" };
}

/** A project that couldn't be added, with a self-contained human reason. */
export interface SkippedAdd {
  project: string;
  reason: string;
}

/**
 * Sequentially match every project in `addable` to its existing site, chaining one
 * endpoint snapshot so later matches see earlier wirings. Sequential — not parallel —
 * because the chaining depends on each match seeing the previous one. With `opts.create`
 * a project no site monitors is turned into a new site/endpoint in that group; without
 * it, such a project is skipped (match-only). Resilient: a single project failing is
 * recorded in `skipped`, not fatal.
 */
export async function runAutoConfigure(
  addable: ProjectLite[],
  opts: { api: StatusAddApi; create?: CreateOpts; onProgress?: (done: number, total: number) => void },
): Promise<AutoConfigureResult<ProjectLite>> {
  const { api, create, onProgress } = opts;
  const working: Working = { endpoints: await api.listAllEndpoints() };
  return applySequentially(addable, (p) => executeAdd(p, working, api, create), onProgress);
}

// ---------------------------------------------------------------------------
// Endpoint-axis wiring — the COMPLEMENT to the project-axis match above.
//
// `runAutoConfigure` (the project axis) matches each UNmonitored project to the
// existing site that monitors its CANONICAL domain. But a project can be monitored
// via ONE of its domains while OTHER endpoints that monitor its other domains stay
// unconfigured — e.g. the olylo
// project is monitored via `ia.olylo.ai` (its canonical domain), yet the
// `olylo.ai` apex endpoint (a redirect to ia.olylo.ai, also a domain of the SAME
// project) is never wired. Matching an endpoint's host against the project's FULL
// domain list closes that gap.
// ---------------------------------------------------------------------------

/** A deploy project's identity + every domain it serves (the wiring match keys). */
export interface WireableProject {
  platform: string;
  projectName: string;
  domains: string[];
}

type Wiring = { platform: string; deployProject: string };

/**
 * Index host → wiring across every project's domains. A host claimed by TWO
 * different projects is ambiguous (mapped to null) and left alone — we never guess
 * which project a shared host belongs to.
 */
export function indexEndpointWiring(projects: WireableProject[]): Map<string, Wiring | null> {
  const idx = new Map<string, Wiring | null>();
  for (const p of projects) {
    const wiring: Wiring = { platform: platformCanon(p.platform), deployProject: p.projectName };
    // Defensive: a stale cached /deploy-projects body (pre-`domains`) or an e2e mock
    // may omit the field; treat a missing list as no domains rather than throwing.
    for (const d of p.domains ?? []) {
      const host = epHost(`https://${d}`);
      if (!host) continue;
      const cur = idx.get(host);
      if (cur === undefined) idx.set(host, wiring);
      else if (cur && (cur.platform !== wiring.platform || cur.deployProject !== wiring.deployProject)) idx.set(host, null);
    }
  }
  return idx;
}

export interface WireRun {
  /** Existing endpoints newly wired to their deploy project. */
  wired: number;
  /** Endpoints whose wiring update failed, with a human reason. */
  skipped: SkippedAdd[];
}

/**
 * Wire every UNCONFIGURED endpoint to the deploy project that serves its host,
 * matched against each project's FULL domain list. Idempotent (skips already-wired
 * or operator-ignored endpoints via `endpointUnconfigured`) and resilient (a failed
 * update is recorded, not fatal). This is what finally auto-configures an endpoint
 * monitoring a project's non-canonical (redirect/alias) domain.
 */
export async function wireMatchingEndpoints(
  projects: WireableProject[],
  opts: { api: Pick<StatusAddApi, "listAllEndpoints" | "updateEndpoint">; onProgress?: (done: number, total: number) => void },
): Promise<WireRun> {
  const { api, onProgress } = opts;
  const index = indexEndpointWiring(projects);
  const endpoints = await api.listAllEndpoints();
  // Only UNCONFIGURED endpoints whose host maps to exactly one project (ambiguous
  // hosts resolve to null and are dropped by the `!!t.w` filter).
  const targets = endpoints
    .filter(endpointUnconfigured)
    .map((e) => ({ e, w: index.get(epHost(e.url)) }))
    .filter((t): t is { e: EndpointLite; w: Wiring } => !!t.w);

  let wired = 0;
  const skipped: SkippedAdd[] = [];
  let done = 0;
  for (const { e, w } of targets) {
    try {
      await api.updateEndpoint(e.id, { platform: w.platform, deployProject: w.deployProject });
      wired += 1;
    } catch (err) {
      skipped.push({ project: w.deployProject, reason: msg(err) });
    }
    done += 1;
    onProgress?.(done, targets.length);
  }
  return { wired, skipped };
}

export interface AutoConfigureSummary {
  /** Projects matched to their site (its canonical-domain endpoint wired) this run. */
  added: number;
  /** New sites created this run for projects no site monitored (the opt-in creation
   *  path). Optional so the match-only callers can omit it. */
  created?: number;
  /** Existing endpoints wired to their deploy project by the endpoint axis (the
   *  non-canonical / redirect-alias domains the project axis can't reach). */
  wired: number;
  /** Pending projects with no known domain — nothing to match a site against. */
  noDomain: number;
  /** Projects with a domain but no site monitors it yet, plus any conflicts. */
  skipped: number;
}

const projectsCount = (n: number): string => plural(n, "project");
const noSite = (n: number): string => `${projectsCount(n)} ${n === 1 ? "has" : "have"} no site yet`;

/** Why the leftover projects couldn't be matched: no domain to match against, or a
 *  domain conflict. The dominant "no site monitors this domain" case is the headline. */
function manualDetail(r: AutoConfigureSummary): string {
  const parts: string[] = [];
  if (r.noDomain > 0) parts.push(`${r.noDomain} with no domain`);
  if (r.skipped > 0) parts.push(`${r.skipped} unmatched`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/**
 * The result message after an Auto Configure run. Match-only: it WIRES existing sites
 * to their deploy projects (never creates a site). Names both axes — projects matched
 * to their canonical site AND endpoints wired by alias-domain matching. Leftovers are
 * projects no site monitors yet — the operator adds a site (Endpoints ▸ New endpoint)
 * and re-runs.
 */
export function summarizeAutoConfigure(r: AutoConfigureSummary): string {
  const created = r.created ?? 0;
  const manual = r.noDomain + r.skipped;
  const did: string[] = [];
  if (r.added > 0) did.push(`matched ${projectsCount(r.added)} to ${r.added === 1 ? "its site" : "their sites"}`);
  if (created > 0) did.push(`created ${plural(created, "site")}`);
  if (r.wired > 0) did.push(`wired ${plural(r.wired, "site")}`);
  if (did.length === 0) {
    return manual === 0
      ? "Nothing to match — every monitored site is already wired to its deploy project."
      : `No new matches — ${noSite(manual)}${manualDetail(r)}.`;
  }
  const sentence = did.join(", ").replace(/^./, (c) => c.toUpperCase());
  return manual === 0 ? `${sentence}.` : `${sentence}; ${noSite(manual)}${manualDetail(r)}.`;
}
