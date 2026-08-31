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
 * That layout is THIS SITE's, not the feature's, which is what {@link ResearchHostSeams} makes
 * sayable. Before 2026-08-31 it was hardcoded here, so the hub — whose `/<slug>/research` segment
 * is the feature's own root, with an open paper directly under it — could not mount this model at
 * all without pushing every deep link to `/<slug>/research/home/…`, a URL it does not own. It
 * kept a second composition of ResearchFeature instead. `baseIsFeatureRoot` is that host saying
 * where its base is; the feature has taken two bases since it was written (`docBasePath` defaults
 * to `basePath` "which is the hub"), so nothing about the feature had to change to admit it.
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
 * `workspaceSlug` is deliberately NOT passed by default: the documents are token-scoped, which is
 * what they were before the workspace segment existed. Scoping them to the chosen workspace is
 * the open platform decision (feature-platform-phase2 §2), and it stays one prop at this seam —
 * see `scopeToWorkspace`.
 */
// Module scope, because it reaches an effect dependency array inside useWorkspaceRoute — an
// inline arrow would re-arm the seeding effect on every render.
const workspaceHref = (slug: string): string => `/${slug}/home`;

export const researchHome = defineSiteHome({
  parse: parseResearchPath,
  workspaceHref,
  render: ({ scopedBase, workspaceSlug, view }, host: ResearchHostSeams) => (
    <ResearchFeature
      basePath={host.baseIsFeatureRoot ? scopedBase : `${scopedBase}/home`}
      // Undefined ⇒ ResearchFeature's own default, which IS `basePath` — one base, an open paper
      // directly under the list. Only this site splits them, and only because its root segment is
      // already spoken for.
      docBasePath={host.baseIsFeatureRoot ? undefined : `${scopedBase}/edit`}
      // §2, answered by the MOUNT and not here. Undefined ⇒ token-scoped, as before.
      workspaceSlug={host.scopeToWorkspace ? workspaceSlug : undefined}
      {...view}
    />
  ),
});

/** What a HOST may say about where this site's Research surface sits, and what scopes it. */
export interface ResearchHostSeams {
  /**
   * This host's `scopedBase` IS the feature's root: the list renders at the base and an open
   * paper sits directly under it (`/<base>/<docId>`). The hub's `/<slug>/research` is that host —
   * the whole segment is Research, so there is nothing to park the surface beside.
   *
   * Default false, which is THIS SITE's layout: `/<ws>` here is an author's public paper index,
   * so the gated list is one segment down at `/home` and the editor is its own route at `/edit`.
   * A site cannot express that as the base the shell computes, because the shell computes ONE
   * base per site and this site needs two.
   *
   * It is a fact about the HOST's URL space, not a preference — which is why it is a seam and not
   * a prop threaded through the site's pages. Getting it wrong does not degrade gracefully: every
   * link the feature builds comes off these two bases, so a hub mount without it would publish
   * `/<slug>/research/home/-/<docId>` from a rail whose route tree has no `home` segment.
   */
  baseIsFeatureRoot?: boolean;
  /**
   * This host has decided feature-platform-phase2 §2 FOR ITSELF: scope the papers to the
   * workspace the shell resolved, rather than leaving them token-scoped.
   *
   * A boolean rather than a `workspaceSlug` string, deliberately — the slug is already in the
   * render context, so what a host contributes is the DECISION, not the value. Same seam shape as
   * teams', dashboards' and personas', for the same reason: naming the decision keeps §2 legible
   * as still open rather than quietly settling it by copying one host's behaviour into a shared
   * model. The hub's route passed its slug from the day it was written; it now says that.
   */
  scopeToWorkspace?: boolean;
}

// The default export is what `app/home/page.tsx` and the two gated routes import, so those files
// can be the same bytes in every site. The named export above is the one this module's own
// documentation refers to; they are the same object.
export default researchHome;
