"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { DashboardsFeature } from "@agentic-toolkit/dashboards";
// The parse helper comes from the server-safe ./parse subpath, as it did when this was an RSC:
// the barrel dist is a "use client" module, and keeping the grammar in one module is what stops
// this host and the hub drifting into parsing the same URL differently.
import { parseDashboardsPath } from "@agentic-toolkit/dashboards/parse";

/**
 * The Dashboards (Site Monitoring) feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md). Same URL grammar as the hub's /<slug>/dashboards
 * routes, now rooted at the workspace rather than at /home:
 *   /<ws>                      → nothing open (pick Groups or Sites)
 *   /<ws>/<section>            → that section's list (groups | sites), no row open
 *   /<ws>/<section>/<rowId>    → that group/site open in the editor
 *
 * This file DECLARES the route; it does not assemble it. SiteHomeRoute owns the assembly for
 * every site: it reads the `[workspace]` param and the path below it, and mounts what `render`
 * returns inside SiteHomeShell — which fetches the caller's workspaces, resolves the one to use,
 * keeps the URL in step, and renders the chooser in a bar under the header. `scopedBase` arrives
 * already built, so no site builds `${base}/${slug}` by hand.
 *
 * Declared here rather than in a page because it is mounted TWICE — `app/[workspace]/[[...path]]`
 * and `app/home` — and two declarations of one grammar is the duplication the model removes.
 *
 * `workspaceSlug` is deliberately NOT passed: the lists are token-scoped, which is what they were
 * before the workspace segment existed. Scoping them to the chosen workspace is the open platform
 * decision (feature-platform-phase2 §2), and it stays one prop at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const dashboardsHome = defineSiteHome({
  parse: parseDashboardsPath,
  render: ({ scopedBase, view }) => <DashboardsFeature basePath={scopedBase} {...view} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default dashboardsHome;
