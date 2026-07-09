"use client";

import { useBasePathRoute } from "@agentic-toolkit/resource";
import { ResearchPane } from "./ResearchPane";

/**
 * The URL-owning entry for the `/<slug>/research` route: it maps the path segment (the open
 * document id) onto {@link ResearchPane}'s opt-in `urlSelection`, so the open document lives in the
 * URL and is deep-linkable (like personas/ecosystems). Feature links are workspace-relative:
 * `<basePath>/<docId>`, the base held constant while navigating within the workspace.
 *
 * Embedded uses of ResearchPane (the hub's ecosystem topic rail via renderFeaturePanel) render it
 * directly, WITHOUT this entry, so selection stays internal and opening a document never navigates
 * the surface away.
 */
export function ResearchFeature({
  basePath,
  docId,
  userSlug,
}: {
  /** The feature's URL base (drives the route): the hub passes `/<slug>/research`. Supplied by the
   *  host route rather than derived here, so the same feature mounts under either scheme. */
  basePath: string;
  /** The open document's id (first path segment), or undefined for the bare list. */
  docId?: string;
  /** The public-URL slug to publish under — see {@link ResearchPane}'s `userSlug` doc. Optional: a
   *  host that doesn't have a richer profile-slug field to offer can omit it. */
  userSlug?: string;
}) {
  const { pushSegment } = useBasePathRoute(basePath);
  return (
    <ResearchPane
      userSlug={userSlug}
      urlSelection={{
        docId,
        onSelectDoc: pushSegment,
      }}
    />
  );
}
