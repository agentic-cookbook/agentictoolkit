"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ResearchFeature } from "@agentic-toolkit/research";
// The parse helper comes from the server-safe ./parse subpath, and keeping the grammar in one
// module is what stops this host and the hub drifting into parsing the same URL differently.
import { parseResearchPath } from "@agentic-toolkit/research/parse";

/**
 * The Research feature — this site's gated product surface: the signed-in user's markdown
 * research papers (search, editor, publish flow), the SAME @agentic-toolkit/research surface the
 * hub's /<slug>/research route renders.
 *
 * This site's routes are NOT the family's, and the difference is the whole reason this file has
 * anything to say. On the other 38, `/<ws>` is the app. Here it is an AUTHOR'S PUBLIC PAPER
 * INDEX, and a published paper is `/<author>/<paper-slug>` — the site's content lives at the root
 * segment, so the gated surface moved down beside it:
 *
 *   /<ws>/home          → the paper list, nothing open   (app/[workspace]/home)
 *   /<ws>/edit/<docId>  → that paper open in the editor  (app/[workspace]/edit/[paperUuid])
 *
 * `scopedBase` still arrives as `/<ws>` — the workspace IS that segment on every site — and the
 * two surfaces are appended HERE, which is the one place that knows this site's URL layout.
 * `workspaceHref` tells the shell the same thing about `/home`: seed the gated surface, not the
 * public page.
 *
 * `parseResearchPath` is SHARED with the hub, but no longer unchanged: it now reads a category
 * chain ahead of the open document's id (`/<chain…>/-/<docId>`), so `/<ws>/home` is deep-linkable
 * into a category the same way the hub's `/<slug>/research` is. `edit` is this SITE's segment and
 * never reaches it — the edit route hands down `[paperUuid]` alone, carrying no chain.
 *
 * A client module because a model carries functions, which cannot cross from a Server Component
 * into the client shell — see SiteHomeRoute. The pages' `metadata` lives on the layouts for the
 * same reason: a client page cannot export it.
 *
 * `workspaceSlug` is deliberately NOT passed: the documents are token-scoped, which is what they
 * were before the workspace segment existed. Scoping them to the chosen workspace is the open
 * platform decision (feature-platform-phase2 §2), and it stays one prop at this seam.
 */
// Module scope, because it reaches an effect dependency array inside useWorkspaceRoute — an
// inline arrow would re-arm the seeding effect on every render.
const workspaceHref = (slug: string): string => `/${slug}/home`;

export const researchHome = defineSiteHome({
  parse: parseResearchPath,
  workspaceHref,
  render: ({ scopedBase, view }) => (
    <ResearchFeature
      basePath={`${scopedBase}/home`}
      docBasePath={`${scopedBase}/edit`}
      {...view}
    />
  ),
});

// The default export is what `app/home/page.tsx` and the two gated routes import, so those files
// can be the same bytes in every site. The named export above is the one this module's own
// documentation refers to; they are the same object.
export default researchHome;
