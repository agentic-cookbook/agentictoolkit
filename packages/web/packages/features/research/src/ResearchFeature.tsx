"use client";

import { useCallback } from "react";
import { RailHostBoundary, useBasePathRoute } from "@agentic-toolkit/resource";
import { ResearchPane } from "./ResearchPane";

/**
 * The URL-owning entry for the `/<slug>/research` route: it maps the path segment (the open
 * document id) onto {@link ResearchPane}'s opt-in `urlSelection`, so the open document lives in the
 * URL and is deep-linkable (like personas/ecosystems). Feature links are workspace-relative:
 * `<basePath>/<docId>`, the base held constant while navigating within the workspace.
 *
 * ResearchPane also supports being rendered directly, WITHOUT this entry, so selection stays
 * internal and opening a document never navigates the surface away — but no host does that today
 * (the hub's `renderFeaturePanel("research")` arm is unreached). See ResearchPane's header.
 */
export function ResearchFeature({
  basePath,
  docBasePath,
  docId,
  userSlug,
  workspaceSlug,
}: {
  /** The feature's URL base (drives the route): the hub passes `/<slug>/research`. Supplied by the
   *  host route rather than derived here, so the same feature mounts under either scheme. */
  basePath: string;
  /** Where an OPEN document lives, when that is not directly under `basePath`. Defaults to
   *  `basePath`, which is the hub: `/<slug>/research` lists and `/<slug>/research/<docId>`
   *  opens. The research SITE splits them — `/<ws>/home` lists and `/<ws>/edit/<docId>` opens —
   *  because its gated surfaces are two named route segments rather than one catch-all, which is
   *  in turn because its `/<ws>` root is a public page. */
  docBasePath?: string;
  /** The open document's id (first path segment), or undefined for the bare list. */
  docId?: string;
  /** The public-URL slug to publish under — see {@link ResearchPane}'s `userSlug` doc. Optional: a
   *  host that doesn't have a richer profile-slug field to offer can omit it. */
  userSlug?: string;
  /** Pins every op to the WORKSPACE'S owning principal — see {@link ResearchPane}'s doc. */
  workspaceSlug?: string;
}) {
  // Two bases, one behaviour: opening a document pushes under `docBasePath`, and CLOSING one
  // (`null`) returns to `basePath`. When the two are the same string — every host but the
  // research site — both hooks build identical URLs and this is exactly the old single-base
  // `pushSegment`.
  const list = useBasePathRoute(basePath);
  const docs = useBasePathRoute(docBasePath ?? basePath);
  const onSelectDoc = useCallback(
    (id: string | null) => (id === null ? list.pushSegment(null) : docs.pushSegment(id)),
    [list, docs],
  );
  // RailHostBoundary: the pane's document list + exit guard exist only as rail-host
  // publications; on a bare feature site (no hub shell) the boundary self-hosts them.
  return (
    <RailHostBoundary>
      <ResearchPane
        userSlug={userSlug}
        workspaceSlug={workspaceSlug}
        urlSelection={{
          docId,
          onSelectDoc: onSelectDoc,
        }}
      />
    </RailHostBoundary>
  );
}
