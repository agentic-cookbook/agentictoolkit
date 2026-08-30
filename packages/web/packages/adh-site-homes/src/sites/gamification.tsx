"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { helpFor } from "@agentic-toolkit/adh/help/store";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { GamificationFeature } from "@agentic-toolkit/gamification";
import { parseGamificationPath } from "@agentic-toolkit/gamification/parse";

/**
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
export const gamificationHome = defineSiteHome({
  // `/<workspace>/<productId>/<topic>[/<leafId>[/<entityId>]]` — the ecosystems grammar, which is
  // what this rail navigates by. Imported from the package's SERVER-SAFE ./parse subpath, never
  // the barrel: the barrel's dist carries "use client".
  parse: parseGamificationPath,
  render: ({ scopedBase, workspaceSlug, view }) => (
    // The toolkit's OWN react-query runtime, mounted once by the SITE — the same arrangement
    // @agentic-toolkit/ecosystems' site uses, and the reason the feature doesn't mount one for
    // itself. A host-constructed QueryClientProvider cannot serve toolkit hooks: `link:` gives the
    // package its own physical copy of react-query, so the client has to come from the toolkit.
    <ToolkitQueryProvider>
      {/* `helpFor` is passed IN rather than reached for: a pane's blurb is adh's product
          vocabulary, which a portable feature package may not import. It comes from the site
          rather than from a host seam because there is one store and both hosts want it — the
          hub's own route passed the same key before it mounted this model. */}
      <GamificationFeature
        basePath={scopedBase}
        workspaceSlug={workspaceSlug}
        helpFor={helpFor}
        {...view}
      />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default gamificationHome;
