import { basename } from "node:path";
import { siteIdForDir, type SiteId } from "@agentic-toolkit/adh-registry";

/**
 * Which site is being built?
 *
 * Derived from the working directory, never passed in — so next.config.ts can
 * be byte-identical across the fleet and no site can misdeclare itself. Next
 * always runs with the site directory as cwd: suite.local invokes
 * `node_modules/.bin/next dev` inside it, deployment/build cds into it, and
 * Vercel sets a per-project rootDirectory.
 */
export function currentSiteId(cwd: string = process.cwd()): SiteId {
  const name = basename(cwd.replace(/[/\\]+$/, ""));
  // The folder is named for the domain, not for the id (`billing` builds in
  // `agenticdeveloperbilling/`), so the registry does the join — see siteIdForDir.
  const id = siteIdForDir(name);
  if (id === undefined) {
    throw new Error(
      [
        "",
        `Cannot build: "${name}" is not a registered site.`,
        "",
        "adhNextConfig() derives the site id from the working directory and looks",
        "it up in the fleet registry. Either this was run from the wrong directory,",
        "or the site is new and has not been added to:",
        "",
        "  packages/web/packages/adh-registry/src/sites/registry.ts",
        "",
      ].join("\n"),
    );
  }
  return id;
}
