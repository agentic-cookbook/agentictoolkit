"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { RegistriesFeature } from "@agentic-toolkit/adh-registries";
// The grammar comes from the server-safe ./parse subpath (the barrel dist is a "use client"
// module), and keeping it in one place is what stops this host and the hub drifting into
// parsing the same URL differently.
import { parseRegistriesPath } from "@agentic-toolkit/adh-registries/parse";

/**
 * This site's workspace route — `/<workspace>` and everything under it.
 *
 * The Registries feature: the owner's explorer over the registries this workspace built (their
 * details, sections, signup form, permissions and review queue), and the registrant's editor for
 * their own listing in someone else's. The SAME @agentic-toolkit/adh-registries surface the hub's
 * `/<slug>/registries` route renders — which is the point, because until 2026-08-31 it was NOT:
 * the whole implementation lived in `websites/agenticdeveloperhub/src/registries/`, and the site
 * the feature is named after shipped a `SiteHomePlaceholder`. Anyone who followed a cross-site
 * link to agenticdeveloperregistries.com landed on "coming soon" for a feature that had been
 * built and was running one origin over.
 *
 * `scopedBase` is `/<workspace>` here and `/<slug>/registries` on the hub, and that difference
 * needs no seam: every link the feature builds comes off the base it is handed, and the shell
 * computes the site's base the same way FleetSiteRoute computes the hub's. The grammar below the
 * base is identical on both, which is why one parser serves both.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header. Declared
 * here rather than in a page because both `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module because a model carries functions, which cannot cross from a Server Component
 * into the client shell — see SiteHomeRoute.
 *
 * `workspaceSlug` is deliberately NOT a prop of this feature at all: a registry belongs to the
 * caller's token, which is what it belonged to before the workspace segment existed. Scoping
 * registries to the chosen workspace is the open platform decision (feature-platform-phase2 §2),
 * and when it is answered it arrives as one prop here — the same seam every other model uses.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const registriesHome = defineSiteHome({
  parse: parseRegistriesPath,
  // `selection`, not a spread: the parse result is a discriminated UNION describing which of the
  // feature's two screens the URL names, not a bag of props. Spreading it would put `kind` on the
  // component and lose the exhaustiveness the union is there to give.
  render: ({ scopedBase, view }) => <RegistriesFeature basePath={scopedBase} selection={view} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default registriesHome;
