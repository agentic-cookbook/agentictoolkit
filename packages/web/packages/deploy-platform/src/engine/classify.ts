// ---------------------------------------------------------------------------
// The ONE configuration-status domain model.
//
// Every UI surface that shows "configured / not configured" derives from THIS
// module and NOTHING computes its own answer, so they can never disagree:
//   • the Overview banner (front page),
//   • the Config ▸ Sites topic badge,
//   • the Config ▸ Platforms per-integration badge,
//   • the per-endpoint "not configured" indicator in the Sites editor,
//   • the Auto Configure run (which projects it adds).
//
// The bug this fixes: those surfaces each rolled their own count from a DIFFERENT
// axis — the banner counted unmonitored deploy PROJECTS while the Sites badge
// counted unconfigured ENDPOINTS — so a fleet with 5 unconfigured sites and 0
// unmonitored projects showed "⚠ 5" in Config but NO banner on the front page.
//
// There are genuinely two gaps (an endpoint with no deploy wiring, vs. a deploy
// project no endpoint monitors). The model owns BOTH and exposes a single
// `counts.total`, so any surface that wants "is anything unconfigured?" asks the
// same question and gets the same answer.
// ---------------------------------------------------------------------------
import { platformCanon } from "../canon/index.js";

// Backend-infra kinds (health probes, MCP, DNS) that are legitimately NOT tied to
// a deploy project, so they never raise the "unconfigured" warning. The engine owns
// this vocabulary because `endpointNeedsWiring` is what acts on it; a consumer that
// needs the set itself (the status app's endpoint-kinds, on both its server and its
// web side) RE-EXPORTS this one rather than restating the members.
export const NON_DEPLOY_KINDS: ReadonlySet<string> = new Set<string>(["health", "custom", "dns"]);

// ── Per-endpoint ─────────────────────────────────────────────────────────────

/** The endpoint fields the wiring logic reads (EndpointView is assignable to this). */
export interface EndpointLike {
  kind: string;
  platform: string | null;
  deployProject: string | null;
  // "Leave this monitor alone": when true the "no deploy project" warning is suppressed
  // even if platform/project are missing (the per-endpoint "Ignore" button persists this).
  //
  // ONE flag on purpose. A host whose board has a second way to say the same thing folds
  // it in when it maps its rows onto this view — the status monitor's `isActive: false`
  // (monitoring paused, so out of the auto-configure conversation) becomes this, on its
  // server (`autoConfigureOptedOut`) and in its browser alike. Adding a member per host
  // vocabulary would put the fold in the classifier, where every OTHER host would then
  // have to know about a field that means nothing to it.
  ignoreProjectWarning?: boolean;
}

/** A frontend/app endpoint that ought to be wired to a deploy project. Backend-infra
 *  kinds (health probes, MCP, DNS) are legitimately NOT tied to a deploy project. */
export function endpointNeedsWiring(kind: string): boolean {
  return !NON_DEPLOY_KINDS.has(kind);
}

/** The three mutually-exclusive states a monitored endpoint can be in on the
 *  "configured?" axis — what the Sites list's config filter selects on. */
export type EndpointConfigStatus = "configured" | "unconfigured" | "ignored";

/**
 * One endpoint's configuration status — classified HERE so the Sites filter, the
 * per-row "⚠ not configured" warning, and the counts can never disagree (the same
 * single-source rationale as `projectStatus`):
 *   • `configured`   — wired (platform + deploy project), OR an infra kind that
 *     needs no deploy project at all (health / DNS / MCP probes);
 *   • `unconfigured` — a deploy-backed endpoint missing its platform/project that
 *     the operator has NOT dismissed (this IS the `endpointUnconfigured` set);
 *   • `ignored`      — the same gap, but the operator opted out of the warning (see
 *     {@link EndpointLike.ignoreProjectWarning}, which every way a host lets them say
 *     that folds into).
 *
 * A paused monitor that IS wired still reads `configured` — the opt-out is only consulted
 * in the unwired branch, so pausing a site does not un-configure it. (Its deploy project
 * likewise stays claimed; see the status app's `listEndpointsForWiring`.)
 */
export function endpointConfigStatus(e: EndpointLike): EndpointConfigStatus {
  if (!endpointNeedsWiring(e.kind)) return "configured"; // infra kind — nothing to wire
  if (e.platform && e.deployProject) return "configured"; // fully wired
  return e.ignoreProjectWarning ? "ignored" : "unconfigured";
}

/** True when an endpoint should be wired but isn't (missing platform or project) and
 *  the operator hasn't dismissed the warning. Delegates to `endpointConfigStatus` so
 *  the boolean and the three-way classifier are one source of truth. */
export function endpointUnconfigured(e: EndpointLike): boolean {
  return endpointConfigStatus(e) === "unconfigured";
}

// ── Per-project ──────────────────────────────────────────────────────────────

/** The deploy-project fields the status logic reads (DeployProject is assignable). */
export interface ProjectLike {
  wired: boolean; // already referenced by a monitored endpoint
  ignored: boolean; // operator-exempted from the "unconfigured" warning
  domain: string | null;
}

export type ProjectStatus = "monitored" | "ignored" | "unmonitored";

/** One project's status on the SAME axis the banner + Platforms badges use. */
export function projectStatus(p: { wired: boolean; ignored: boolean }): ProjectStatus {
  if (p.wired) return "monitored";
  if (p.ignored) return "ignored";
  return "unmonitored";
}

/** A deploy project that no endpoint monitors and the operator hasn't ignored. */
export function projectUnconfigured(p: { wired: boolean; ignored: boolean }): boolean {
  return projectStatus(p) === "unmonitored";
}

/** The pending deploy projects split into what Auto Configure can act on. One
 *  definition shared by every "Add" / "Auto Configure" entry point so their counts
 *  (and the banner's) can't drift. */
export interface PendingPartition<T> {
  /** Unconfigured projects (no endpoint, not ignored) — what the banner counts. */
  pending: T[];
  /** The domain-backed subset — the ones Auto Configure / "Add all" can add. */
  addable: T[];
  /** Pending projects with no domain — left for manual setup. */
  noDomain: number;
}

export function partitionPending<T extends ProjectLike>(projects: T[]): PendingPartition<T> {
  const pending = projects.filter(projectUnconfigured);
  const addable = pending.filter((p) => !!p.domain);
  return { pending, addable, noDomain: pending.length - addable.length };
}

// ── The aggregate ────────────────────────────────────────────────────────────

/** Everything the UI needs to render configuration health, computed once from the
 *  two raw inputs (monitored endpoints + enumerated deploy projects). */
export interface ConfigStatus<E extends EndpointLike = EndpointLike, P extends ProjectLike = ProjectLike> {
  /** Endpoints that should be wired to a deploy project but aren't (the Sites gap). */
  unconfiguredSites: E[];
  /** Deploy projects no endpoint monitors and the operator hasn't ignored. */
  unmonitoredProjects: P[];
  /** Domain-backed subset of `unmonitoredProjects` — what Auto Configure can add. */
  addableProjects: P[];
  /** Unmonitored projects with no domain — can't be auto-added (need a URL). */
  noDomainProjects: number;
  /** Unmonitored-project count keyed by CANONICAL platform (the Platforms badges). */
  unmonitoredByPlatform: Map<string, number>;
  /** The headline counts — the SAME numbers every surface renders. */
  counts: {
    /** Endpoints flagged "not configured". */
    sites: number;
    /** Deploy projects flagged "not monitored". */
    projects: number;
    /** sites + projects — drives whether the Overview banner appears at all. */
    total: number;
  };
}

/**
 * Compute the whole configuration-status model from the raw data. Pure and
 * synchronous: the same inputs always give the same model, so it's trivially
 * unit-testable and every surface that calls it agrees by construction.
 */
export function computeConfigStatus<E extends EndpointLike, P extends ProjectLike & { platform: string }>(
  endpoints: E[],
  projects: P[],
): ConfigStatus<E, P> {
  const unconfiguredSites = endpoints.filter(endpointUnconfigured);
  const { pending, addable, noDomain } = partitionPending(projects);

  const unmonitoredByPlatform = new Map<string, number>();
  for (const p of pending) {
    const key = platformCanon(p.platform);
    unmonitoredByPlatform.set(key, (unmonitoredByPlatform.get(key) ?? 0) + 1);
  }

  const sites = unconfiguredSites.length;
  const projectsCount = pending.length;
  return {
    unconfiguredSites,
    unmonitoredProjects: pending,
    addableProjects: addable,
    noDomainProjects: noDomain,
    unmonitoredByPlatform,
    counts: { sites, projects: projectsCount, total: sites + projectsCount },
  };
}
