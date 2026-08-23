"use client";

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
  render: ({ scopedBase, workspaceSlug, view }) => (
    <ProjectsFeature basePath={scopedBase} workspaceSlug={workspaceSlug} {...view} />
  ),
  // What this site contributes to `/<slug>/profile`. The workspace `render` above draws a place
  // the caller WORKS; this draws a page ABOUT someone who may be a stranger, so it is a separate
  // declaration rather than a mode of the same one.
  profileSection: (principal) => <ProfileProjects principal={principal} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default projectsHome;
