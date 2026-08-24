"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { DocsFeature } from "@agentic-toolkit/notebook";
import { parseNotebookPath } from "@agentic-toolkit/notebook/parse";

/**
 * The Docs feature — this site's gated product surface: the workspace owner's DOCS, browsed
 * through the same hierarchical category rail the notebook and the research surface use.
 *
 * A doc is the informal corpus: anything written down that is not a note and not composed
 * enough to be a paper. Markdown today; from v2, an uploaded file of any type — which is why
 * docs have a marker table and a storage bucket of their own (`content.docs`) rather than
 * being a second view of the notes rows.
 *
 * This site's workspace route — `/<workspace>` and everything below it.
 *
 * Declared here rather than in a page because it is mounted TWICE: at
 * `app/[workspace]/[[...path]]` (the route itself) and at `app/home` (the workspace-less entry
 * every cross-site link names). SiteHomeRoute owns the assembly for both — it reads the workspace
 * segment and the path below it, and mounts what `render` returns inside SiteHomeShell, which
 * fetches the caller's workspaces, resolves the one to use (this URL's segment → their stored
 * preference → their personal workspace), keeps the URL in step, and renders the chooser in a bar
 * under the header. `scopedBase` arrives already built, so no site builds `${base}/${slug}` by
 * hand.
 *
 * A client module because a model carries functions, and functions cannot cross from a Server
 * Component into the client shell — see SiteHomeRoute.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const docsHome = defineSiteHome({
  // `/<workspace>/<category>/<subcategory>/…[/-/<docId>]` — a variable-depth category chain,
  // then the open document behind a separator. The notebook's parser verbatim, because the
  // grammar is the corpus-independent half: a chain, the separator, an id. Imported from the
  // package's SERVER-SAFE ./parse subpath, never the barrel: the barrel's dist is "use client".
  parse: parseNotebookPath,
  // `workspaceSlug` pins the docs to the workspace's owning principal, so an org workspace shows
  // the ORG's documents. That is the placeholder ownership for org docs, exactly as it is for
  // notes: they are the org's documents, filed in the org's `docs` bucket. Org-SHARED semantics
  // are still undesigned and land at this same seam.
  render: ({ scopedBase, workspaceSlug, view }) => (
    // No ToolkitQueryProvider: this surface holds its data in plain component state, as the
    // notebook and research surfaces it descends from do.
    <DocsFeature basePath={scopedBase} workspaceSlug={workspaceSlug} {...view} />
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default docsHome;
