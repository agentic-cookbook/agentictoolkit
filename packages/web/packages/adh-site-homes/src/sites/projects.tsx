"use client";

import type { ReactNode } from "react";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ProjectsFeature } from "@agentic-toolkit/projects";
import { parseProjectsPath } from "@agentic-toolkit/projects/parse";
// Relative, not a package subpath: ProfileProjects lives IN this site now (it imports the adh
// vocabulary tier, which a portable @agentic-toolkit package may not — see its own docblock), not
// in @agentic-toolkit/projects.
import { ProfileProjects } from "./ProfileProjects";

/**
 * The Projects feature — this site's gated product surface (docs/platform/feature-platform.md).
 *
 * This file DECLARES the site's workspace route; it does not assemble it. SiteHomeRoute owns the
 * assembly for every site: it reads the `[workspace]` param and the path below it, and mounts what
 * `render` returns inside SiteHomeShell — which fetches the caller's workspaces, resolves the one
 * to use (this URL's segment → their stored preference → their personal workspace), keeps the URL
 * in step, and renders the chooser in a bar under the header. `scopedBase` arrives already built,
 * so the URL grammar below lives in the shared package rather than once per site:
 *   /<ws> | /<ws>/all | /<ws>/<id> | /<ws>/<id>/<topic> | /<ws>/<id>/<topic>/<leaf>
 *
 * Declared HERE rather than in a page, because it is mounted TWICE — `app/[workspace]/[[...path]]`
 * and `app/home` — and two declarations of one grammar is the duplication the model exists to
 * remove. `/home` carries no params at all, which is exactly how it redirects: the shell resolves
 * a workspace and replaces the URL with it.
 *
 * A client module because a model carries functions, and functions cannot cross from a Server
 * Component into the client shell — see SiteHomeRoute. Nothing here renders on the server anyway:
 * the shell and the feature are both "use client".
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const projectsHome = defineSiteHome({
  // Same grammar as the hub's /<slug>/projects route — parsed by @agentic-toolkit/projects so the
  // two hosts can't drift into parsing the same URL differently.
  parse: parseProjectsPath,
  render: ({ scopedBase, workspaceSlug, view }, host: ProjectsHostSeams) => (
    <ProjectsFeature
      basePath={scopedBase}
      workspaceSlug={workspaceSlug}
      // Undefined on this site ⇒ an open project's Overview shows no Transfer Ownership section,
      // which is ProjectsFeature's own documented degrade. Forwarding it is what lets the hub
      // mount THIS model at `/<ws>/projects` instead of keeping a ProjectsRoute of its own.
      renderTransferOwnership={host.renderTransferOwnership}
      {...view}
    />
  ),
  // What this site contributes to `/<slug>/profile`. The workspace `render` above draws a place
  // the caller WORKS; this draws a page ABOUT someone who may be a stranger, so it is a separate
  // declaration rather than a mode of the same one.
  profileSection: (principal) => <ProfileProjects principal={principal} />,
});

/**
 * What a HOST may add to this site's Projects surface.
 *
 * One field, and it is one a feature site cannot fill: the destination list for a transfer means
 * naming every workspace the caller belongs to, which is the hub's own workspace API layer, and
 * the section's UI (`WorkspaceTransferPane`) is hub-local for the same reason.
 *
 * The type is ProjectsFeature's own prop, restated here only because the package does not export
 * a name for it. If it grows one, this should become a re-export rather than a second spelling.
 */
export interface ProjectsHostSeams {
  /** Transfer Ownership for an open project. Omitted ⇒ Overview shows no such section. */
  renderTransferOwnership?: (project: { id: string; name: string }) => ReactNode;
}

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default projectsHome;
