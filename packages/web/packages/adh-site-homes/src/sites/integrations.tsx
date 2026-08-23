"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { IntegrationsFeature } from "@agentic-toolkit/integrations";
import { parseIntegrationsPath } from "@agentic-toolkit/integrations/parse";

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
export const integrationsHome = defineSiteHome({
  // `/<workspace>/<destination>[/<configId>]` — fixed arity, so no separator. Imported from the
  // package's SERVER-SAFE ./parse subpath, never the barrel: the barrel's dist carries "use
  // client".
  parse: parseIntegrationsPath,
  render: ({ scopedBase, workspace, view }) => (
    // The toolkit's OWN react-query runtime, mounted once by the SITE — the feature's destination
    // list resolves the workspace's infrastructure ecosystem through
    // `useWorkspaceDefaultEcosystemId`, which is a react-query hook. A host-constructed
    // QueryClientProvider cannot serve toolkit hooks: `link:` gives the package its own physical
    // copy of react-query, so the client has to come from the toolkit.
    <ToolkitQueryProvider>
      {/* The whole workspace ROW, not just its slug: the first destination reads "My
          Integrations" on a personal workspace and "Org Integrations" on an organization, and
          that is the only place the shell's resolved `kind` is legible. */}
      <IntegrationsFeature basePath={scopedBase} workspace={workspace} {...view} />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default integrationsHome;
