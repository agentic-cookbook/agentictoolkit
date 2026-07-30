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
import { deployProjectKey, domainFamily, epHost, platformCanon, slugify } from "../canon/index.js";
import { PLACEHOLDER_URL, indexLiveProjects, planAddProject, type EndpointLite, type LiveProjectIndex, type PlanOpts, type ProjectLite } from "./plan.js";
import { endpointNeedsWiring, endpointUnconfigured, type EndpointLike } from "./classify.js";

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
  // Every existing site (id + slug + group). Two things on the create path need it: a
  // site slug is UNIQUE PER GROUP, so a derived slug that is already taken has to be
  // disambiguated rather than 409 and strand the project on every future run; and a new
  // site belongs with the group that already owns its domain family, not wherever the
  // fallback points.
  listSites(): Promise<SiteLite[]>;
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

/** An existing site, as the create path needs to see it. */
export interface SiteLite {
  id: string;
  slug: string;
  groupId: string;
}

/** Opt-in creation. Absent → match-only. */
export interface CreateOpts {
  /** The group new sites are filed under. By DEFAULT a FALLBACK: a new site whose domain
   *  family a group already owns joins THAT group instead, so one product's sites stay
   *  together. Whenever that redirection happens the run says so (see
   *  {@link AutoConfigureResult.notes}) — it is never a silent substitution. */
  groupId: string;
  /** true → `groupId` is AUTHORITATIVE; the domain-family rule is not consulted at all.
   *  For a board whose groups aren't per-product (per-environment, say), where filing a
   *  production site with its family would put it in the Testing group. */
  forceGroup?: boolean;
}

/** The aggregated outcome of an auto-configure run, generalized over the project type so
 *  the status runner (ProjectLite) and the builder runner share ONE result shape. `added`
 *  are items whose existing target was matched/wired; `created` are items a new site was
 *  built for (opt-in create path); `skipped` are items left with a self-contained reason. */
export interface AutoConfigureResult<T = ProjectLite> {
  added: T[];
  created: T[];
  skipped: { project: T; reason: string }[];
  /** Items that SUCCEEDED, with something the operator has to be told: a new site filed
   *  with its domain family's group rather than the selected one, or a monitor taken over
   *  from a project the platform no longer has. A decision we make FOR the operator — an
   *  override, or a rewrite of wiring they can still see — is one we have to report;
   *  silence here reads as "it went exactly as you asked". */
  notes: { project: T; note: string }[];
}

/** The outcome of applying ONE plan step — the vocabulary `applySequentially` aggregates.
 *  A success may carry a `note`: it worked, with a caveat the operator needs told. */
export type ApplyOutcome =
  | { kind: "added"; note?: string }
  | { kind: "created"; note?: string }
  | { kind: "skipped"; reason: string };

/**
 * Run `applyOne` over `items` STRICTLY IN SEQUENCE (never parallel), collecting each item
 * into added / created / skipped (+ any notes). Sequential because each apply may mutate
 * shared working state that later applies must see (a wiring, or a site, created earlier in
 * the run). Resilient: one item throwing is recorded in `skipped`, never fatal to the rest.
 * This is the single sequencing definition reused by BOTH `runAutoConfigure` and
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
  const notes: { project: T; note: string }[] = [];
  const total = items.length;
  let done = 0;
  for (const item of items) {
    try {
      const r = await applyOne(item);
      if (r.kind === "added") added.push(item);
      else if (r.kind === "created") created.push(item);
      else skipped.push({ project: item, reason: r.reason });
      if (r.kind !== "skipped" && r.note) notes.push({ project: item, note: r.note });
    } catch (e) {
      skipped.push({ project: item, reason: msg(e) });
    }
    done += 1;
    onProgress?.(done, total);
  }
  return { added, created, skipped, notes };
}

// A mutable snapshot so a sequential run sees what earlier applies did (e.g. a project's
// staging + prod variants resolving against the same site, or the slug the previous
// project just claimed).
interface Working {
  endpoints: EndpointLite[];
  /** `${groupId}|${slug}` for every site that exists — INCLUDING ones created earlier in
   *  this same run, so two projects in one batch can't derive the same slug and 409. */
  takenSlugs: Set<string>;
  /** Registrable domain family → the ONE group that owns it, or null when two groups split
   *  it (ambiguous — we never guess which half is right). Built ONCE from the fleet, so
   *  filing a new site is a map lookup instead of a full endpoint re-scan (which is
   *  O(endpoints × created) across a batch — exactly the re-parsing the planner precomputes
   *  its way out of). Deliberately IMMUTABLE: a site created mid-run is filed either with
   *  the family's existing owner or, for an unowned family, with the fallback — and the map
   *  already answers both of those the same way, so maintaining it could not change an
   *  answer. The next run rebuilds it from the fleet. */
  familyGroup: ReadonlyMap<string, string | null>;
  /** The projects the platforms still have (see {@link PlanOpts.liveProjects}). Absent
   *  when the caller can't enumerate. Immutable for the run: it describes the PLATFORMS,
   *  and nothing we do to the monitoring config changes what exists on them. */
  liveProjects?: LiveProjectIndex;
}

/** Index `domain family → owning group` across the whole fleet in ONE pass. A family owned
 *  by two different groups maps to null: it's split, and we never guess which half a new
 *  site belongs to. */
export function indexFamilyGroups(endpoints: EndpointLite[], sites: SiteLite[]): Map<string, string | null> {
  const siteGroup = new Map(sites.map((s) => [s.id, s.groupId]));
  const idx = new Map<string, string | null>();
  for (const e of endpoints) {
    const family = domainFamily(epHost(e.url));
    if (!family) continue;
    const g = siteGroup.get(e.siteId);
    if (!g) continue;
    const cur = idx.get(family);
    if (cur === undefined) idx.set(family, g);
    else if (cur !== null && cur !== g) idx.set(family, null);
  }
  return idx;
}

/** The group a NEW site for `host` belongs in: the one that already owns other sites in
 *  the same domain family (`lewis.agenticdeveloperhub.com` joins whatever group holds
 *  `agenticdeveloperhub.com`), else the operator's fallback. An unknown or split family
 *  falls back too. */
export function groupForNewSite(host: string, working: Working, fallbackGroupId: string): string {
  const family = domainFamily(host);
  if (!family) return fallbackGroupId;
  return working.familyGroup.get(family) ?? fallbackGroupId;
}

/**
 * A (name, slug) for a new site that no site in `groupId` already uses. Needed because the
 * planned slug is a PROJECT BASE name — two unrelated products can share one (Railway's
 * `myagenticprojects` and Vercel's `myagenticprojects-production`), and `(group, slug)` is
 * UNIQUE, so the collision 409s and strands the project on every future run. Falls back to
 * the host (self-describing, and the thing that actually differs), then to a counter.
 */
export function uniqueSiteIdentity(
  base: { name: string; slug: string },
  host: string,
  groupId: string,
  taken: Set<string>,
): { name: string; slug: string } {
  const free = (slug: string): boolean => slug.length > 0 && !taken.has(`${groupId}|${slug}`);
  if (free(base.slug)) return base;
  if (host && free(slugify(host))) return { name: host, slug: slugify(host) };
  // Only NUMBER a real base: an empty one (a project named entirely in punctuation, with
  // no host to fall back on) would otherwise yield the nonsense site ` (2)` / `-2`. Hand
  // the empty slug back and let the server's validation reject it, with a reason.
  if (base.slug.length > 0) {
    for (let n = 2; n < 100; n += 1) {
      if (free(`${base.slug}-${n}`)) return { name: `${base.name} (${n})`, slug: `${base.slug}-${n}` };
    }
  }
  return base; // every variant taken — let the server's constraint have the last word
}

/** Match one deploy project to the EXISTING site that monitors its domain and wire it
 *  (set platform + deployProject). When `create` is supplied, a project no site
 *  monitors is also turned into a new endpoint (on the site that owns its apex) or a
 *  new site + endpoint — so Auto Configure can ADD monitors, not just match. Without
 *  `create` it stays match-only: an unmonitored project is left for the operator, so
 *  the per-platform "Match" actions can never graft a phantom site. */
async function executeAdd(p: ProjectLite, working: Working, api: StatusAddApi, create?: CreateOpts): Promise<ApplyOutcome> {
  const plan = planAddProject(
    { platform: p.platform, projectName: p.projectName, domain: p.domain, environment: p.environment },
    working.endpoints,
    { liveProjects: working.liveProjects },
  );
  // Reason is self-contained (no project prefix) so callers can render it as
  // `${project}: ${reason}` uniformly across skips and errors.
  if (plan.kind === "conflict") return { kind: "skipped", reason: `that domain is already wired to ${plan.existingProject}` };
  if (plan.kind === "env-conflict") {
    return { kind: "skipped", reason: `its site's ${plan.environment} endpoint is already wired to ${plan.existingProject}` };
  }
  if (plan.kind === "wire-endpoint") {
    await api.updateEndpoint(plan.endpointId, { platform: plan.platform, deployProject: plan.deployProject, environment: plan.environment });
    working.endpoints = working.endpoints.map((e) =>
      e.id === plan.endpointId ? { ...e, platform: plan.platform, deployProject: plan.deployProject, environment: plan.environment } : e,
    );
    // Taking a monitor over from a retired project is a REWRITE of wiring the operator
    // can still see on the board — report it rather than let the row silently change name.
    return { kind: "added", note: plan.replaces ? `took over the monitor wired to ${plan.replaces}, which ${plan.replacesPlatform ?? plan.platform} no longer has` : undefined };
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
  // new-site: nobody owns the apex → create the site, then its endpoint. The site is filed
  // with its domain family's group when there is one (the fallback group is for genuinely
  // new families) unless the operator forced their pick, and its slug is disambiguated
  // against the ones already taken in that group — an unavoidable 409 here doesn't just
  // fail this run, it strands the project on every future one.
  const host = plan.url === PLACEHOLDER_URL ? "" : epHost(plan.url);
  const groupId = create.forceGroup ? create.groupId : groupForNewSite(host, working, create.groupId);
  // Landing somewhere other than the selected group is a decision we made FOR the operator;
  // say so rather than let the run read as "it went where you said".
  const note = groupId === create.groupId ? undefined : `filed under the group that already monitors ${domainFamily(host)}, not the one selected`;
  const identity = uniqueSiteIdentity({ name: plan.siteName, slug: plan.siteSlug }, host, groupId, working.takenSlugs);
  const site = await api.createSite({ name: identity.name, slug: identity.slug, groupId });
  const slugKey = `${groupId}|${identity.slug}`;
  working.takenSlugs.add(slugKey);
  let ep: EndpointLite;
  try {
    ep = await api.createEndpoint(site.id, { url: plan.url, environment: plan.environment, platform: plan.platform, deployProject: plan.deployProject });
  } catch (e) {
    // Roll the site back: a site with no endpoint isn't just useless, its (group, slug)
    // would 409 every future run. Release the slug ONLY if the delete actually landed —
    // otherwise the row still holds it and a later project must route around it.
    let rolledBack = true;
    await api.deleteSite(site.id).catch(() => {
      rolledBack = false;
    });
    if (rolledBack) working.takenSlugs.delete(slugKey);
    throw e; // report the original failure, not the rollback's outcome
  }
  working.endpoints = [...working.endpoints, ep];
  return { kind: "created", note };
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
  opts: { api: StatusAddApi; create?: CreateOpts; liveProjects?: PlanOpts["liveProjects"]; onProgress?: (done: number, total: number) => void },
): Promise<AutoConfigureResult<ProjectLite>> {
  const { api, create, liveProjects, onProgress } = opts;
  const [endpoints, sites] = await Promise.all([api.listAllEndpoints(), api.listSites()]);
  const working: Working = {
    endpoints,
    takenSlugs: new Set(sites.map((s) => `${s.groupId}|${s.slug}`)),
    familyGroup: indexFamilyGroups(endpoints, sites),
    liveProjects,
  };
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

// ---------------------------------------------------------------------------
// The REMOVAL axis — the SAME two lists, read the other way round.
//
// Adding asks "which project has no monitor?"; removing asks "which monitor has no
// project?". One rule answers it, because a deleted project claims no domains:
//
//   • an endpoint WIRED to a project → the project it names is the authority. Gone
//     from the platform's list ⇒ the monitor describes something that stopped
//     existing. (This subsumes the old Vercel-project-keyed rule, on every platform.)
//   • an endpoint with NO wiring → the domain lists are the authority. No project
//     serves its host ⇒ same verdict.
//
// A wired endpoint is deliberately NOT judged on its host: a live project may serve
// a host its domain list doesn't report (Cloudflare enumerates one representative
// host per worker), and "the operator pointed this monitor somewhere the project
// list can't see" is not evidence that anything was deleted.
//
// DNS says NOTHING here. A name that stopped resolving is how a DOWN endpoint is
// explained, not proof that the deployment behind it is gone — and a broken site's
// monitor is the alarm, not the mess.
// ---------------------------------------------------------------------------

/**
 * Provider-assigned default hosts. Every provider's domain read deliberately OMITS
 * them — Vercel filters `.vercel.app` out of its project domain list, and Cloudflare's
 * map carries custom domains only — so their absence from the claim index is a property
 * of the READ, never evidence about the project. An endpoint monitoring one can never
 * be a removal candidate.
 *
 * Railway is deliberately NOT here: it reports each service's `*.up.railway.app`
 * provider domains alongside its custom ones, so a Railway provider host missing from
 * the index really is a host nothing serves.
 */
export const UNLISTED_PROVIDER_SUFFIXES = [".vercel.app", ".workers.dev", ".pages.dev"] as const;

/** True when a host is absent from the domain lists BY CONSTRUCTION, so its absence
 *  carries no information (see {@link UNLISTED_PROVIDER_SUFFIXES}). */
export function hostOmittedFromDomainLists(host: string): boolean {
  return UNLISTED_PROVIDER_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * The endpoint's host, or "" when its URL isn't a URL at all.
 *
 * `epHost` deliberately falls back to the RAW string, which is right for the wiring
 * match (a bare `example.com` still matches a project domain) and wrong here: a value
 * no domain list could ever contain would read as a vanished host every pass. That
 * covers real config — `PLACEHOLDER_URL` ("https://"), the URL-less row the create path
 * leaves for a domain-less project to be filled in — which is unfinished config, not
 * config describing something deleted.
 */
function judgeableHost(url: string): string {
  try {
    return epHost(new URL(url).href);
  } catch {
    return "";
  }
}

/** The endpoint fields the removal rule reads: the configuration axis
 *  ({@link EndpointLike}) plus the URL whose host is looked up in the claim index. */
export type ClaimableEndpoint = EndpointLike & { url: string };

/**
 * "Both lists are up to date" as a PRECONDITION rather than a hope — the three facts
 * that decide what this pass may conclude from an absence. Every one of them is a
 * property of the reads that just happened, so a degraded pass withholds judgement
 * instead of condemning live config.
 */
export interface ClaimEvidence {
  /** Canonical platforms the board holds credentials for. Nothing configured ⇒ the
   *  inventory cannot speak for any host, and nothing is judged at all. */
  configuredPlatforms: readonly string[];
  /** Canonical platforms whose PROJECT list is complete and authenticated this pass —
   *  what licenses "the project this monitor names is gone". */
  verifiedPlatforms: readonly string[];
  /** Canonical platforms whose DOMAIN lists are complete this pass — what licenses
   *  "no project serves this host". Separate from `verifiedPlatforms` because listing an
   *  account's projects and listing one project's domains are different calls that fail
   *  independently (and the domain fan-out fails PARTIALLY). */
  verifiedDomains: readonly string[];
}

export interface UnclaimedEndpoints<T> {
  /** Endpoints describing something no platform has any more. */
  doomed: T[];
  /** Why judgement was WITHHELD from part (or all) of the board this pass — one line per
   *  reason, empty when every candidate was judged. Callers MUST log these: an empty
   *  `doomed` from a blind pass and an empty `doomed` from a healthy fleet are opposite
   *  facts, and they must never look alike in an operator's log. */
  withheld: string[];
}

/**
 * The monitors that describe something no longer on any platform — the removal rule
 * above, applied to one pass's inventory.
 *
 * Every safety condition is a REFUSAL to judge, never a heuristic that guesses:
 *
 *  • **Nothing configured** ⇒ judge nothing. An empty inventory is not an empty fleet.
 *  • **Per-platform blindness** ⇒ judge nothing on that platform. A wired monitor needs
 *    its own platform's project list; an unwired one needs EVERY configured platform's
 *    domain list, since any of them could be the one serving its host.
 *  • **The inventory claims none of the monitored hosts** ⇒ judge nothing. A re-scoped
 *    or swapped token returns a perfectly successful list of somebody ELSE's projects;
 *    two lists that overlap nowhere are not the same fleet.
 *  • **Every one of a platform's wired monitors reads vanished** ⇒ judge none of them.
 *    Mass deletion is what a credential change looks like; a real deletion is one row.
 *  • **Operator opt-out** — `ignoreProjectWarning` (the per-endpoint "Ignore" button)
 *    exempts an endpoint from removal exactly as it exempts it from the "not configured"
 *    warning. It is the ONE escape hatch for a monitor that legitimately has no deploy
 *    project (a third-party dependency watched on a deploy-backed kind); infra kinds
 *    (`health`/`dns`/`custom`) are excluded outright.
 *
 * What this function deliberately does NOT own is the probe: a monitor whose URL is
 * SERVING is a site worth watching whatever the inventory says, and the caller — which
 * is the only thing holding this cycle's probe results — applies that veto. It is
 * load-bearing, not belt-and-braces: it is what stands between a partially-wrong
 * inventory and the deletion of a live site's monitor.
 */
export function endpointsClaimedByNothing<T extends ClaimableEndpoint>(
  endpoints: readonly T[],
  projects: readonly WireableProject[],
  evidence: ClaimEvidence,
): UnclaimedEndpoints<T> {
  const configured = new Set(evidence.configuredPlatforms.map(platformCanon));
  if (configured.size === 0) {
    return { doomed: [], withheld: ["no deploy platform is configured — the inventory cannot speak for any host"] };
  }

  const withheld: string[] = [];
  const live = indexLiveProjects(projects, evidence.verifiedPlatforms);
  const verifiedDomains = new Set(evidence.verifiedDomains.map(platformCanon));
  const claims = indexEndpointWiring([...projects]);

  // Removal candidates: deploy-backed kinds the operator hasn't exempted, with a
  // parseable host the domain lists actually cover.
  const candidates = endpoints
    .filter((e) => endpointNeedsWiring(e.kind) && !e.ignoreProjectWarning)
    .map((e) => ({ e, host: judgeableHost(e.url) }))
    .filter((c) => !!c.host && !hostOmittedFromDomainLists(c.host));
  if (candidates.length === 0) return { doomed: [], withheld };

  // Do the two lists describe the same fleet at all? `null` (a host two projects claim)
  // counts as claimed — ambiguous wiring is emphatically not an absence.
  if (!candidates.some((c) => claims.get(c.host) !== undefined)) {
    return {
      doomed: [],
      withheld: [
        `the ${plural(projects.length, "enumerated project")} claim none of the ${plural(candidates.length, "monitored host")} — treating that as a credential/scope change, not a deleted fleet`,
      ],
    };
  }

  const doomed: T[] = [];

  // ── Wired: the project each one NAMES is the authority ────────────────────
  const byPlatform = new Map<string, { e: T; host: string }[]>();
  for (const c of candidates) {
    if (!c.e.platform || !c.e.deployProject) continue;
    const platform = platformCanon(c.e.platform);
    const group = byPlatform.get(platform);
    if (group) group.push(c);
    else byPlatform.set(platform, [c]);
  }
  for (const [platform, group] of byPlatform) {
    if (!live.platforms.has(platform)) {
      withheld.push(`${platform}: project list not complete this pass — ${plural(group.length, "wired monitor")} not judged`);
      continue;
    }
    const gone = group.filter((c) => !live.keys.has(deployProjectKey(platform, c.e.deployProject!)));
    if (gone.length === group.length) {
      withheld.push(
        `${platform}: ALL ${plural(group.length, "wired monitor")} name a project the enumeration didn't return — treating that as a credential/scope change, not mass deletion`,
      );
      continue;
    }
    doomed.push(...gone.map((c) => c.e));
  }

  // ── Unwired: the domain lists are the authority ───────────────────────────
  const unwired = candidates.filter((c) => !c.e.platform || !c.e.deployProject);
  if (unwired.length > 0) {
    // Any platform could be the one serving these hosts, so judging them needs EVERY
    // configured platform's domain list — a blind spot on any one of them could be
    // hiding exactly the project that claims the host.
    const blind = [...configured].filter((p) => !verifiedDomains.has(p)).sort();
    if (blind.length > 0) {
      withheld.push(`domain lists not complete for ${blind.join(", ")} — ${plural(unwired.length, "unwired monitor")} not judged`);
    } else {
      doomed.push(...unwired.filter((c) => claims.get(c.host) === undefined).map((c) => c.e));
    }
  }

  return { doomed, withheld };
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
