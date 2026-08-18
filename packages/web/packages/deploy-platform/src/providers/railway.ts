import { pickCanonicalHost } from "./host-pick.js";
import { noteRateLimited } from "../cooldown/provider-cooldown.js";

/** A Railway project to poll — comes from the railway integration's config. */
export interface RailwayProject {
  id: string;
  name: string;
}

interface RailwayEnvNode {
  id: string;
  name: string;
}

/** Build an environmentId→name map from a Railway `environments.edges` array — the
 *  one place that shape is flattened (used by both the deployments + domains fetches). */
function buildEnvNameMap(edges: { node: RailwayEnvNode }[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of edges ?? []) map[e.node.id] = e.node.name;
  return map;
}

const GQL_ENDPOINT = "https://backboard.railway.app/graphql/v2";

export async function gqlPost(token: string, query: string, signal: AbortSignal, variables?: Record<string, unknown>): Promise<Response> {
  const res = await fetch(GQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // Pass ids as GraphQL VARIABLES, never string-interpolated into the query, so a value
    // with a quote/brace can't break (or rewrite) the query.
    body: JSON.stringify(variables ? { query, variables } : { query }),
    signal,
  });
  // The one choke point every Railway call goes through — note a 429 here so the
  // whole provider cools down, whichever query tripped it.
  if (res.status === 429) noteRateLimited("railway", res.headers.get("retry-after"));
  return res;
}

/**
 * Enumerate EVERY Railway project the token can see, so all of them show up — not
 * just a hardcoded set, via the ROOT `projects` query (the token's whole workspace).
 *
 * Use the root `projects` query, NOT `me { projects }`: Railway migrated personal
 * accounts into workspaces, and a workspace-scoped token (what the dashboard mints)
 * isn't authorized for the `me` viewer at all — `me { projects }` returns
 * "Not Authorized" even though the token can read every project in its workspace.
 * (Project-scoped tokens are different again: they authorize only via the
 * `Project-Access-Token` header, so over `Authorization: Bearer` — the header gqlPost
 * uses — they return "Not Authorized" for EVERYTHING and don't work with this poller.)
 *
 * Returns `null` ONLY when the listing couldn't be performed — the token isn't
 * authorized to enumerate (revoked/invalid, or project-scoped) or the call errored;
 * the caller then falls back to the configured list. Returns `[]` when enumeration
 * SUCCEEDED but the workspace has no projects — a real, authorized empty. Callers must
 * keep these distinct: `null` means "couldn't see", `[]` means "saw nothing", and
 * only the former should fall back / be treated as a blind spot. Exported for the
 * live deploy-projects enumeration.
 */
export async function listRailwayProjects(token: string, signal: AbortSignal): Promise<RailwayProject[] | null> {
  try {
    const res = await gqlPost(token, `query { projects { edges { node { id name } } } }`, signal);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { projects?: { edges?: { node: { id: string; name: string } }[] } };
      errors?: unknown[];
    };
    if (body.errors?.length) return null; // revoked/invalid or project-scoped token → Not Authorized
    const edges = body.data?.projects?.edges ?? [];
    return edges.map((e) => ({ id: e.node.id, name: e.node.name })).filter((p) => p.id && p.name);
  } catch (err) {
    console.error(`Railway project listing failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Project domains — a Railway PROJECT bundles several services, each with its
// own custom + provider (`*.up.railway.app`) domains, across environments. The
// deploy-projects enumeration models a project as ONE entry, so we resolve ONE
// representative host for it (Railway persists no project meta, so without this
// every Railway project enumerates domain-less and can never auto-configure).
// ---------------------------------------------------------------------------

/** The domains on one service-instance (one service in one environment). */
export interface RailwayServiceDomains {
  /** Resolved environment NAME (production/staging/testing), or null if unknown. */
  environment: string | null;
  /** Operator-attached custom domains (e.g. api.example.com). */
  customDomains: string[];
  /** Railway-provided domains (e.g. svc-production.up.railway.app). */
  serviceDomains: string[];
}

interface RailwayProjectDomainsResponse {
  data?: {
    project?: {
      environments?: { edges?: { node: RailwayEnvNode }[] };
      services?: {
        edges?: {
          node: {
            serviceInstances?: {
              edges?: {
                node: {
                  environmentId: string | null;
                  domains?: { serviceDomains?: { domain: string }[]; customDomains?: { domain: string }[] } | null;
                };
              }[];
            };
          };
        }[];
      };
    };
  };
  errors?: { message: string }[];
}

/**
 * Fetch every service-instance's domains for one Railway project. Returns null on
 * any failure (a project-scoped token CAN read its own project; an unauthorized or
 * network error degrades to null so the caller falls back to no-domain). Service
 * instances with no domains at all are omitted.
 */
export async function listRailwayProjectDomains(
  token: string,
  projectId: string,
  signal: AbortSignal,
): Promise<RailwayServiceDomains[] | null> {
  try {
    const query = `query($id: String!) { project(id: $id) {
      environments { edges { node { id name } } }
      services { edges { node { serviceInstances { edges { node {
        environmentId
        domains { serviceDomains { domain } customDomains { domain } }
      } } } } } }
    } }`;
    const res = await gqlPost(token, query, signal, { id: projectId });
    if (!res.ok) return null;
    const body = (await res.json()) as RailwayProjectDomainsResponse;
    if (body.errors?.length) return null;
    const project = body.data?.project;
    if (!project) return null;

    const envNameById = buildEnvNameMap(project.environments?.edges);

    const out: RailwayServiceDomains[] = [];
    for (const svc of project.services?.edges ?? []) {
      for (const inst of svc.node.serviceInstances?.edges ?? []) {
        const node = inst.node;
        const customDomains = (node.domains?.customDomains ?? []).map((d) => d.domain).filter(Boolean);
        const serviceDomains = (node.domains?.serviceDomains ?? []).map((d) => d.domain).filter(Boolean);
        if (customDomains.length === 0 && serviceDomains.length === 0) continue;
        out.push({
          environment: node.environmentId ? envNameById[node.environmentId] ?? null : null,
          customDomains,
          serviceDomains,
        });
      }
    }
    return out;
  } catch (err) {
    // A failure caused by the CALLER's own time box is the caller's to report: it is the
    // only side that knows whether it will retry, and logging here made every transient
    // loss look like a Railway fault. Anything else is a genuine surprise and is reported
    // where it happens.
    if (!signal.aborted) {
      console.error(`Railway project ${projectId} domains failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}

/** One Railway ENVIRONMENT's monitorable hosts — the per-environment shape the
 *  deploy-projects enumeration expands a project into. */
export interface RailwayEnvDomains {
  /** production / staging / testing (lowercased), or null when Railway didn't name it. */
  environment: string | null;
  /** One representative host for this env (a custom domain when it has one, else the
   *  provider `*.up.railway.app` host). */
  domain: string | null;
  /** Every host this env serves — custom domains + provider hosts, deduped + sorted. */
  domains: string[];
}

/** Production-first rank so a project's environment entries lead with production.
 *  Exported so the deploy-projects enumeration can keep the same order after it
 *  re-sorts across platforms (a bare alphabetical env sort would put a Railway
 *  per-PR env like `pr-123` ahead of `production`). */
export function railwayEnvRank(env: string | null): number {
  switch (env) {
    case "production":
      return 0;
    case "staging":
      return 1;
    case "testing":
      return 2;
    default:
      return 3;
  }
}

/**
 * Split a Railway project's service-instance domains into ONE entry PER ENVIRONMENT
 * (production/staging/testing), so the deploy-projects enumeration can surface — and
 * Auto Configure can pull in — each environment as its own monitorable target instead
 * of collapsing the whole project to a single production host (what {@link
 * railwayProjectDomains} did, and why staging/testing never got monitored).
 *
 * Per environment `domains` is EVERY host that env serves — custom domains AND the
 * `*.up.railway.app` provider hosts (deduped + sorted). Provider hosts are included on
 * purpose: a non-production environment commonly has ONLY a provider domain (custom
 * domains usually sit on production alone), so excluding them — as the project-level
 * collapse does — would leave staging/testing domain-less and un-addable, defeating the
 * whole point. `domain` is one representative host, preferring a custom domain, else the
 * provider host. An environment whose services expose no domain at all (a Postgres/Redis
 * env) contributes no entry. Result is ordered production-first.
 */
export function railwayProjectEnvironments(services: RailwayServiceDomains[]): RailwayEnvDomains[] {
  // Group service instances by environment (keyed by the lowercased name; a null env —
  // an instance whose environmentId didn't resolve — buckets under "").
  const byEnv = new Map<string, { environment: string | null; customs: string[]; providers: string[] }>();
  for (const s of services) {
    const environment = s.environment ? s.environment.toLowerCase() : null;
    const bucket = byEnv.get(environment ?? "") ?? { environment, customs: [], providers: [] };
    bucket.customs.push(...s.customDomains);
    bucket.providers.push(...s.serviceDomains);
    byEnv.set(environment ?? "", bucket);
  }
  const out: RailwayEnvDomains[] = [];
  for (const { environment, customs, providers } of byEnv.values()) {
    const domains = [...new Set([...customs, ...providers])].filter(Boolean).sort();
    if (domains.length === 0) continue; // no monitorable host in this env — skip it
    const domain = pickCanonicalHost(customs) ?? pickCanonicalHost(providers);
    out.push({ environment, domain, domains });
  }
  return out.sort(
    (a, b) => railwayEnvRank(a.environment) - railwayEnvRank(b.environment) || (a.environment ?? "").localeCompare(b.environment ?? ""),
  );
}
