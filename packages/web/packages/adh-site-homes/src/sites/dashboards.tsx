"use client";

import type { ReactNode } from "react";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { reservedWorkspaceSlugs } from "@agentic-toolkit/adh/site";
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
 * `workspaceSlug` is still not passed BY DEFAULT: the lists are token-scoped, which is what they
 * were before the workspace segment existed, and scoping them to the chosen workspace is the open
 * platform decision (feature-platform-phase2 §2). What changed on 2026-08-30 is that a host which
 * has ALREADY made that decision for itself can say so — see `scopeToWorkspace` on
 * {@link DashboardsHostSeams}. That is not §2 being answered here; it is §2 staying open while
 * the hub stops needing a second mount to act on the answer it already had.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const dashboardsHome = defineSiteHome({
  parse: parseDashboardsPath,
  render: ({ scopedBase, workspaceSlug, view }, host: DashboardsHostSeams) => (
    <DashboardsFeature
      basePath={scopedBase}
      // The family's reserved-word list, called HERE rather than injected, because
      // `reservedWorkspaceSlugs()` takes no arguments and none of it is a site's to decide — the
      // same reason the hub's own reservedSlugs.ts is four lines around one call. This site
      // validated new group and site handles against NOTHING until now, which is precisely the
      // defect that list exists for: a slug is minted once and spent at `/<workspace>` on all 38
      // sites, so a word this site had never heard of was claimable here and unreachable there.
      reservedSlugs={RESERVED_SLUGS}
      // §2, answered by the MOUNT and not here. Undefined ⇒ token-scoped, exactly as before.
      workspaceSlug={host.scopeToWorkspace ? workspaceSlug : undefined}
      renderTransferOwnership={host.renderTransferOwnership}
      {...view}
    />
  ),
});

/**
 * The family's reserved handles, as the array DashboardsFeature's validators want.
 *
 * Module scope: the call builds a Set and this render runs on every keystroke in the handle
 * fields it feeds.
 */
const RESERVED_SLUGS: readonly string[] = [...reservedWorkspaceSlugs()];

/** What a HOST may add to this site's Dashboards surface. */
export interface DashboardsHostSeams {
  /**
   * This host has decided feature-platform-phase2 §2 FOR ITSELF: scope the Groups and Sites
   * lists to the workspace the shell resolved, rather than to the token.
   *
   * A boolean rather than a `workspaceSlug` string, deliberately. The slug is already in the
   * render context — a host passing it back would be handing the model data it holds — so what a
   * host actually contributes here is the DECISION, and naming the decision is what keeps §2
   * legible as still open. The hub sets it because its route has passed the slug all along.
   */
  scopeToWorkspace?: boolean;
  /** Transfer Ownership for an open group. Omitted ⇒ no such section — the destination list is
   *  the caller's whole workspace tree, which is a host's to build and not this package's. */
  renderTransferOwnership?: (group: { id: string; name: string }) => ReactNode;
}

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default dashboardsHome;
