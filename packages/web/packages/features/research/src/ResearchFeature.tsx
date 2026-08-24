"use client";

import { useCallback } from "react";
import { RailHostBoundary, useBasePathRoute } from "@agentic-toolkit/resource";
import { ResearchPane } from "./ResearchPane";
import { researchSegments } from "./parse-path";

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
  categorySlugs = EMPTY_SLUGS,
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
  /** The selected category chain, outermost first — parsed from the URL by {@link parseResearchPath}
   *  (see `./parse-path`). Empty means the whole list, same as omitting the prop. */
  categorySlugs?: string[];
  /** The public-URL slug to publish under — see {@link ResearchPane}'s `userSlug` doc. Optional: a
   *  host that doesn't have a richer profile-slug field to offer can omit it. */
  userSlug?: string;
  /** Pins every op to the WORKSPACE'S owning principal — see {@link ResearchPane}'s doc. */
  workspaceSlug?: string;
}) {
  // Two bases, one behaviour: opening a document pushes under `docBasePath`, and CLOSING one
  // (`null`) returns to `basePath` — but now to the CHAIN the reader was browsing within that
  // base, not to the bare base, so closing a document never drops the rail back to the top.
  // `pushList`/`docRoute` are bare object literals `useBasePathRoute` returns fresh every render;
  // `onSelectDoc`/`onSelectCategory`'s identity depends only on the (stable) methods inside them
  // plus `categorySlugs`, not on those objects, so depending on the objects directly would hand
  // out a new identity every render even though nothing about the render-relevant inputs changed.
  const { pushDeep: pushList } = useBasePathRoute(basePath);
  const docRoute = useBasePathRoute(docBasePath ?? basePath);
  // Research site: the editor is its own route, so a document URL there carries no chain — the
  // chain lives only on the list route (`/<ws>/home/<chain…>`), and reopening the list restores
  // it. Hub: one route holds both list and open document, so the separator has to be written into
  // the same URL the document id lives in.
  const splitDocRoute = (docBasePath ?? basePath) !== basePath;
  // parseResearchPath hands back a fresh array every render, so keying the callback's identity on
  // `categorySlugs` itself would defeat the memo on every render regardless of whether the chain
  // actually changed. Key on the joined string instead — same primitive-keying idea as the `plan`
  // memo in ResearchPane.
  const categoryKey = categorySlugs.join("/");
  const onSelectDoc = useCallback(
    (id: string | null) => {
      // Closing always returns to the chain the reader was browsing, never to the bare base.
      if (id === null) return pushList(...researchSegments(categorySlugs));
      return splitDocRoute
        ? docRoute.pushSegment(id)
        : docRoute.pushDeep(...researchSegments(categorySlugs, id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categorySlugs is keyed via categoryKey
    [pushList, docRoute.pushSegment, docRoute.pushDeep, splitDocRoute, categoryKey],
  );
  const onSelectCategory = useCallback(
    (slugs: string[]) => pushList(...researchSegments(slugs)),
    [pushList],
  );
  // RailHostBoundary: the pane's document list + exit guard exist only as rail-host
  // publications; on a bare feature site (no hub shell) the boundary self-hosts them.
  return (
    <RailHostBoundary>
      <ResearchPane
        userSlug={userSlug}
        workspaceSlug={workspaceSlug}
        categorySlugs={categorySlugs}
        onSelectCategory={onSelectCategory}
        urlSelection={{
          docId,
          onSelectDoc: onSelectDoc,
        }}
      />
    </RailHostBoundary>
  );
}

// Module scope so the default param above doesn't hand out a new array identity every render.
const EMPTY_SLUGS: string[] = [];
