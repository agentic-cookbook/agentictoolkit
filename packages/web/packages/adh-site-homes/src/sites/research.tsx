"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ResearchFeature } from "@agentic-toolkit/research";
// The parse helper comes from the server-safe ./parse subpath, and keeping the grammar in one
// module is what stops this host and the hub drifting into parsing the same URL differently.
import { parseResearchPath } from "@agentic-toolkit/research/parse";

/**
 * The Research feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md): the signed-in user's markdown research documents
 * (search, editor, publish flow), the SAME @agentic-toolkit/research surface the hub's
 * /<slug>/research route renders. Rooted at the workspace, like every site in the family:
 *   /<ws>         → the research document list (nothing open)
 *   /<ws>/<docId> → that document open in the editor
 * The public cross-author paper search that previously occupied /home lives at /search, and the
 * published corpus itself at /papers/<author>.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header.
 * `scopedBase` arrives already built. Declared here rather than in a page because both
 * `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module because a model carries functions, which cannot cross from a Server Component
 * into the client shell — see SiteHomeRoute. The page's `metadata` moved to the layouts for the
 * same reason: a client page cannot export it.
 *
 * `workspaceSlug` is deliberately NOT passed: the documents are token-scoped, which is what they
 * were before the workspace segment existed. Scoping them to the chosen workspace is the open
 * platform decision (feature-platform-phase2 §2), and it stays one prop at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const researchHome = defineSiteHome({
  parse: parseResearchPath,
  render: ({ scopedBase, view }) => <ResearchFeature basePath={scopedBase} {...view} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default researchHome;
