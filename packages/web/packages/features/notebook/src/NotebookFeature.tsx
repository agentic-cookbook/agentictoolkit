"use client";

import { RailHostBoundary, useBasePathRoute } from "@agentic-toolkit/resource";
import { NotebookPane } from "./NotebookPane";
import { notebookSegments } from "./parse-path";
import { NOTES_CORPUS, type NotebookCorpus } from "./corpus";

/**
 * The URL-owning entry for the notebook route: it maps {@link NotebookPane}'s selection onto
 * the path, so both halves of the selection — which category you are in, and which note is
 * open — live in the URL and are deep-linkable.
 *
 * The grammar is `<basePath>/<category>/<subcategory>/…/-/<noteId>`; see `parse-path.ts` for
 * why the separator exists. Both callbacks push a WHOLE selection rather than mutating one
 * level, which is what lets a category pick clear the open note in a single navigation
 * instead of two.
 */
export function NotebookFeature({
  basePath,
  categorySlugs,
  noteId,
  workspaceSlug,
  corpus = NOTES_CORPUS,
}: {
  /** The feature's URL base (drives the route): the site passes the workspace-scoped `/home`.
   *  Supplied by the host route rather than derived here, so the same feature mounts under
   *  either scheme. */
  basePath: string;
  /** The selected category chain (the path segments before the separator). */
  categorySlugs?: string[];
  /** The open note's id (the segment after the separator), or undefined for the bare list. */
  noteId?: string;
  /** Pins every op to the WORKSPACE'S owning principal — see {@link NotebookPane}'s doc. */
  workspaceSlug?: string;
  /** WHICH SHELF this route is over. Defaults to the owner's notes; `DocsFeature` below is
   *  this same feature bound to `DOCS_CORPUS`. The URL grammar is shared rather than
   *  duplicated per corpus: a chain of categories, the separator, and a document id is the
   *  same shape whichever shelf the document sits on. */
  corpus?: NotebookCorpus;
}) {
  const { pushDeep } = useBasePathRoute(basePath);
  // RailHostBoundary: the pane's category/note levels and its exit guard exist only as
  // rail-host publications; on a bare feature site (no hub shell) the boundary self-hosts them.
  return (
    <RailHostBoundary>
      <NotebookPane
        categorySlugs={categorySlugs ?? []}
        noteId={noteId}
        workspaceSlug={workspaceSlug}
        corpus={corpus}
        onSelectCategory={(slugs) => pushDeep(...notebookSegments(slugs))}
        onSelectNote={(id, slugs) => pushDeep(...notebookSegments(slugs, id))}
      />
    </RailHostBoundary>
  );
}
