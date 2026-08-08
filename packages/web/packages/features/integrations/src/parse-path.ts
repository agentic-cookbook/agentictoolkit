// The integrations URL grammar — the ONE authoritative parse of an integrations route's path
// segments into IntegrationsFeature's selection props, plus its inverse. Both live here so the
// reader and the writer can never disagree about which segment is the destination.
//
//   /<base>                            → nothing selected
//   /<base>/workspace                  → the workspace's own integrations
//   /<base>/persona.acme.scout         → that persona's integrations
//   /<base>/<ecosystemId>              → that product's integrations
//   /<base>/<destination>/<configId>   → one integration instance open
//
// FIXED ARITY, so no separator is needed (unlike the notebook's category chain): a destination is
// exactly one segment and an instance is exactly one segment. Both are opaque ids the feature
// resolves by LOOKUP rather than by shape — see `destinations.ts` for why that matters and for the
// reserved `workspace` literal.
//
// SERVER-SAFE, and its own entry (`@agentic-toolkit/integrations/parse`) for that reason: the
// package barrel's dist carries "use client", so an RSC importing the parser from there would
// throw on a render-only client reference. Mirrors @agentic-toolkit/notebook/parse.

/** The selection IntegrationsFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto its props (the host supplies `basePath` and the workspace). */
export interface IntegrationsPathSelection {
  /** The chosen destination's id, or undefined for the bare list. */
  destinationId?: string;
  /** The open integration instance's address (its rdid, or its uuid when it has no rdid),
   *  or undefined when only the destination is chosen. */
  configId?: string;
}

/**
 * Parse an integrations route's catch-all `path` segments (see the grammar above).
 *
 * A config id without a destination is unreachable BY CONSTRUCTION rather than by a check here:
 * the first segment is always the destination, so `/<base>/<configId>` simply names a destination
 * that will not resolve, and the feature answers that the same way it answers any unknown
 * destination — by showing the destination list. Empty segments are dropped so a trailing or
 * doubled slash lands on the same selection as the tidy URL.
 */
export function parseIntegrationsPath(path?: string[]): IntegrationsPathSelection {
  const segments = (path ?? []).filter(Boolean);
  const [destinationId, configId] = segments;
  return {
    ...(destinationId ? { destinationId } : {}),
    ...(destinationId && configId ? { configId } : {}),
  };
}

/**
 * The inverse: the path segments below the base for a selection. Callers hand these to `pushDeep`,
 * so the arity is written by the same module that reads it. A null/absent config id yields the
 * destination alone (closing the instance), and a null destination yields nothing (the bare list)
 * — dropping any config id with it, since an instance is only addressable through its destination.
 */
export function integrationsSegments(
  destinationId?: string | null,
  configId?: string | null,
): string[] {
  if (!destinationId) return [];
  return configId ? [destinationId, configId] : [destinationId];
}
