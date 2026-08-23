"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { TeamsFeature } from "@agentic-toolkit/teams";
// The parse helper comes from the server-safe ./parse subpath, and keeping the grammar in one
// module is what stops this host and the hub drifting into parsing the same URL differently.
import { parseTeamsPath } from "@agentic-toolkit/teams/parse";

/**
 * The Teams feature — this site's gated product surface (docs/platform/feature-platform-phase2.md).
 * Same URL grammar as the hub's /<slug>/teams routes, now rooted at the workspace rather than
 * at /home:
 *   /<ws> | /<ws>/all | /<ws>/<id> | /<ws>/<id>/<topic> | /<ws>/<id>/<topic>/<leaf>
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header.
 * `scopedBase` arrives already built. Declared here rather than in a page because both
 * `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module because a model carries functions, which cannot cross from a Server Component
 * into the client shell — see SiteHomeRoute.
 *
 * NOTE `workspaceSlug` is deliberately NOT passed, and the chooser above does not change that:
 * the Teams list is scoped to a workspace's ecosystem via the backend's explicit `?ecosystemId=`
 * override, and how site mounts acquire ecosystem scope is the open platform decision
 * (feature-platform-phase2 §2). Until it's made, the feature renders a DEFINED empty state
 * ("Teams aren't available on this site yet…", creation suppressed) rather than a wrong
 * (token-ecosystem) set or an unexplained spinner; resolving §2 is a one-prop change at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const teamRegistryHome = defineSiteHome({
  parse: parseTeamsPath,
  render: ({ scopedBase, view }) => <TeamsFeature basePath={scopedBase} {...view} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default teamRegistryHome;
