"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { EcosystemsFeature, IN_PACKAGE_TOPICS } from "@agentic-toolkit/ecosystems";
// The same grammar module the hub parses with, so the two hosts can't drift into reading the
// same URL differently.
import { parseEcosystemsPath } from "@agentic-toolkit/ecosystems/parse";

/**
 * The Ecosystems feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md): the SAME @agentic-toolkit/ecosystems explorer the
 * hub's /<slug>/ecosystems route renders, host-composed with this site's (deliberately smaller)
 * topic set, now rooted at the workspace rather than at /home.
 *
 * TOPIC SUBSET: the feature renders Settings and Child Ecosystems entirely in-package; every
 * other hub topic is host-owned composition (the hub's config panes — Applications/Integrations/
 * Buckets/Access/Users — and its workspace feature panels), which live in the hub and cannot
 * mount here. So this site injects just the two in-package topics and no-op renderers for the
 * rest; the rail grows as panes become site-mountable.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header.
 * `scopedBase` arrives already built. Declared here rather than in a page because both
 * `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module regardless of the model's own requirement: the injected renderers are functions,
 * which an RSC could never pass across the serialization boundary. EcosystemsFeature's
 * react-query hooks read the toolkit's OWN query runtime — ToolkitQueryProvider from
 * @agentic-toolkit/data/query (the same physical react-query module as the hooks; a
 * host-constructed QueryClientProvider can never be, see that module's doc) — mounted here since
 * this site has no other react-query consumer.
 *
 * `workspaceSlug` is still deliberately NOT passed. The site-mount scoping decision
 * (feature-platform-phase2 §2) is the owner's and remains open; a bare mount renders the
 * feature's unscoped ecosystem card landing, exactly as it did before the workspace segment
 * existed. Resolving §2 is one prop at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const ecosystemsHome = defineSiteHome({
  parse: parseEcosystemsPath,
  render: ({ scopedBase, view }) => (
    <ToolkitQueryProvider>
      <EcosystemsFeature basePath={scopedBase} topics={IN_PACKAGE_TOPICS} {...view} />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default ecosystemsHome;
