"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { GamesFeature } from "@agentic-toolkit/games";
import { parseEcosystemsPath } from "@agentic-toolkit/ecosystems/parse";

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
export const gamesHome = defineSiteHome({
  // No games-owned grammar any more (§1 of the product-gaming-modes design): a game has no
  // address of its own, it is reached through its product's ecosystem id. This rail IS an
  // ecosystems rail under the Product noun with a games topic set, so this parses with
  // `@agentic-toolkit/ecosystems`'s own SERVER-SAFE `./parse` subpath directly rather than
  // through a games-side wrapper — mirrors `@agentic-toolkit/gamification`'s site, which
  // wraps that same parser in its own `parseGamificationPath` only because it also re-uses
  // this exact grammar for a different feature; games has no such wrapper left to keep.
  parse: parseEcosystemsPath,
  render: ({ scopedBase, workspaceSlug, view }) => (
    // The toolkit's OWN react-query runtime, mounted once by the SITE — the same arrangement
    // @agentic-toolkit/gamification's site uses, and the reason the feature doesn't mount one
    // for itself. A host-constructed QueryClientProvider cannot serve toolkit hooks: `link:`
    // gives the package its own physical copy of react-query, so the client has to come from
    // the toolkit.
    <ToolkitQueryProvider>
      <GamesFeature basePath={scopedBase} workspaceSlug={workspaceSlug} {...view} />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default gamesHome;
