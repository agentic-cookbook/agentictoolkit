"use client";

import { defineSiteHome, noSubPath } from "@agentic-toolkit/adh/home";
import { SiteHomePlaceholder } from "@agentic-toolkit/adh/layout";

/**
 * This site's workspace route — `/<workspace>`.
 *
 * Declared here rather than in a page because it is mounted TWICE: at `app/[workspace]/[[...path]]` (the route
 * itself) and at `app/home` (the workspace-less entry every cross-site link names). SiteHomeRoute
 * owns the assembly for both — it reads the workspace segment and mounts what `render` returns
 * inside SiteHomeShell, which fetches the caller's workspaces, resolves the one to use (this
 * URL's segment → their stored preference → their personal workspace), keeps the URL in step,
 * and renders the chooser in a bar under the header.
 *
 * This site has no landing view of its own yet, so `render` is the shared placeholder. The
 * chooser above it is live either way; giving the site real content later is a change to `render`
 * and nothing else.
 *
 * A client module because a model carries functions, and functions cannot cross from a Server
 * Component into the client shell — see SiteHomeRoute.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const helpHome = defineSiteHome({
  // No grammar below the workspace: `/<workspace>` is this site's whole address. `noSubPath` is
  // the family's way of saying so — every site mounts the same optional catch-all, so the depth a
  // site accepts is a line here rather than which directories it happens to have.
  parse: noSubPath,
  render: () => <SiteHomePlaceholder siteId="help" />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default helpHome;
