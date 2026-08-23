"use client";

import { useMemo, type ReactElement } from "react";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ProductsFeature } from "@agentic-toolkit/adh-products";
import type { EcosystemsPathSelection } from "@agentic-toolkit/ecosystems";
// Grammar from the server-safe ./parse subpath — the ONLY home for parse helpers now
// (the barrels deliberately do not re-export them; see any feature barrel's note).
import { parseEcosystemsPath } from "@agentic-toolkit/ecosystems/parse";
// The feature fetches through the toolkit's react-query cache, which reads the toolkit's OWN
// QueryClient context — mount its provider here (same physical module as the hooks; a
// host-provided QueryClientProvider would be a different copy and invisible to them).
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { productFeaturePanelRenderer } from "./feature-panels";

/**
 * The Products feature — this site's gated product surface, and the REASON Products left the
 * hub's workspace rail: agenticdeveloperproducts.com is where you manage products now, so the
 * hub stopped offering the topic (see ALL_FEATURES in the hub's workspace-features.ts — the
 * `/<workspace>/products` route still resolves for links that already exist, but nothing points
 * at it). This is the SAME @agentic-toolkit/adh-products surface that route renders.
 *
 * URL grammar (parseEcosystemsPath), rooted at the workspace:
 *   /<ws> | /<ws>/<productId> | /<ws>/<productId>/<topic>[/<leafId>[/<entityId>]]
 *
 * Host seams supplied here:
 * - renderFeaturePanel: REQUIRED, and this site's own — the three ids the feature does not own
 *   (Dashboards / Billing, plus the Storage group's All Data member). See
 *   ./feature-panels for what each of them is here and how it differs from the hub's.
 * - renderTransfer / renderTransferOwnership are NOT supplied, so an open product, bucket or
 *   application shows no Transfer Ownership section. That is the honest result rather than an
 *   omission: building the destination list means naming every workspace the caller belongs to
 *   AND every ecosystem under each, which is the hub's own workspace API layer. Both are
 *   optional seams for exactly this case.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header.
 * `scopedBase` arrives already built. Declared here rather than in a page because both
 * `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module for two reasons at once: a host seam is a function, and so are a model's own
 * `parse`/`render` — neither can cross the serialization boundary.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const productsHome = defineSiteHome({
  parse: parseEcosystemsPath,
  render: ({ scopedBase, workspaceSlug, view }) => (
    <ToolkitQueryProvider>
      <ProductsHome base={scopedBase} workspaceSlug={workspaceSlug} {...view} />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default productsHome;

/**
 * A component rather than JSX inline in `render`, because the feature-panel renderer closes over
 * the workspace slug and so has to be memoized — `render` is a plain function the shell calls,
 * not a component, so a hook cannot live there.
 */
function ProductsHome({
  base,
  workspaceSlug,
  ...selection
}: { base: string; workspaceSlug: string } & EcosystemsPathSelection): ReactElement {
  const renderFeaturePanel = useMemo(
    () => productFeaturePanelRenderer({ workspaceSlug }),
    [workspaceSlug],
  );
  return (
    <ProductsFeature
      basePath={base}
      workspaceSlug={workspaceSlug}
      renderFeaturePanel={renderFeaturePanel}
      {...selection}
    />
  );
}
