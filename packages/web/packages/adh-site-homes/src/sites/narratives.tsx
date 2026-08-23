"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { NarrativesFrame } from "@agentic-toolkit/narratives";
// The grammar pair from the package — kept in lockstep with the hub's narratives route
// (same inner/outer mapping), so a deep link resolves identically on both hosts.
import { narrativesInnerPath, narrativesOuterHref } from "@agentic-toolkit/narratives/parse";

/**
 * The Narratives feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md): the published static narratives bundle
 * (public/narratives-app, a self-contained HashRouter SPA) iframed by the shared
 * NarrativesFrame — the SAME embed the hub's /<slug>/narratives route renders. The bundle is
 * copied into THIS site's public/ (the frame requires it same-origin: its hash-mirroring reads
 * the iframe's location, which cross-origin would block).
 *
 * Deep-linkable, now rooted at the workspace rather than at /home: the segments below the
 * workspace are the inner narrative path (carried into the iframe hash on load), and the inner
 * app's own hash navigation is mirrored back into the outer URL via replaceState — so a specific
 * narrative view stays shareable and restorable. `scopedBase` is what makes that mirror land on
 * the workspace the visitor is actually in; it is the one value the old `"/home"` literal could
 * not express.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header. Declared
 * here rather than in a page because both `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module regardless of the model's own requirement: onNavigate reads `window`.
 *
 * Auth: both mounts sit under a HomeGate layout, which gates the route/UI. The bundle's static
 * data stays public, same as on the hub — one published artifact, not per-user data.
 */
export const narrativesHome = defineSiteHome({
  parse: narrativesInnerPath,
  render: ({ scopedBase, view }) => (
    <NarrativesFrame
      path={view}
      onNavigate={(next) =>
        window.history.replaceState(null, "", narrativesOuterHref(scopedBase, next))
      }
    />
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default narrativesHome;
