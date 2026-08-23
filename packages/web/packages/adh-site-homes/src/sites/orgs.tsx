"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { helpFor } from "@agentic-toolkit/adh/help/store";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { OrganizationsFeature } from "@agentic-toolkit/organizations";
import { parseOrganizationsPath } from "@agentic-toolkit/organizations/parse";

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
export const orgsHome = defineSiteHome({
  // `/<workspace>/<orgSlug>/<topic>[/…]` — the tail below the topic is handed over whole rather
  // than parsed here, because a topic may own a grammar deeper than one segment (see the parser's
  // own note). Imported from the package's SERVER-SAFE ./parse subpath, never the barrel: the
  // barrel's dist carries "use client".
  parse: parseOrganizationsPath,
  // `workspaceSlug` IS passed on, and the workspace row with it. This site's root list is scoped
  // exactly like its siblings': the orgs you own or belong to under a personal workspace, the orgs
  // an ORG owns under an org workspace. It did not used to be — the list asked a pure membership
  // question and gave the same answer under every workspace, so switching workspaces moved the
  // chrome and nothing else, and the workspace you switched INTO appeared in its own list. The
  // `workspace` row comes along because the rail's own wording depends on `kind` and `name`, and
  // the shell already holds the row (see SiteHomeScope) — re-fetching it for one enum would answer
  // later than the render that needs it and flip the sentence under the user's cursor.
  render: ({ scopedBase, workspaceSlug, workspace, view }) => (
    // The toolkit's OWN react-query runtime, mounted once by the SITE — the same arrangement
    // @agentic-toolkit/ecosystems' site uses, and the reason the feature doesn't mount one for
    // itself. A host-constructed QueryClientProvider cannot serve toolkit hooks: `link:` gives the
    // package its own physical copy of react-query, so the client has to come from the toolkit.
    <ToolkitQueryProvider>
      {/* `helpFor` is passed IN rather than reached for: a pane's blurb is adh's product
          vocabulary, which the portable feature package may not import. The site is an app, so it
          may name it. */}
      <OrganizationsFeature
        basePath={scopedBase}
        workspaceSlug={workspaceSlug}
        workspaceKind={workspace.kind}
        workspaceName={workspace.name}
        helpFor={helpFor}
        {...view}
      />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default orgsHome;
