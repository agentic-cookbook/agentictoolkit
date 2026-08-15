import { readFileSync } from "node:fs";
import path from "node:path";
import { resolvesFrom } from "./resolve.js";

/** The manifest fields whose entries must resolve from the linked package's own directory. */
const CHECKED_FIELDS = ["dependencies", "peerDependencies"] as const;

/**
 * Fail a local build whose `link:`ed toolkit checkout has not been installed since
 * one of its packages gained a dependency.
 *
 * The toolkit submodules are their own pnpm workspaces, so `pnpm install` at
 * frontend/src does NOT install them — `tools/build_shared_deps.py` does, gated on
 * `install_reason()`. Every orchestrated path runs that first (`pnpm build:shared`,
 * `deployment/build`, `.github/actions/setup-websites`, the dev suite bootstrap), and
 * a bare `next build` or `next dev` in a site directory runs none of them. So a
 * checkout whose toolkit node_modules predates a dependency being added builds against
 * a tree pnpm never re-linked, and nothing on that path says so.
 *
 * What that looked like when `fc1ca51c` (the User Settings overlay) added five deps to
 * `@agentic-toolkit/adh` — account, authentication, personas, profile, resource:
 *
 *     Error: Can't resolve '@agentic-toolkit/account/sources.css' in
 *       .../external/agentictoolkit/packages/web/packages/adh
 *
 * which names a package that is checked out, declared, and in the lockfile, and reads
 * as a broken toolkit rather than an un-run install — so the fix it suggests is to add
 * the toolkit's own private dependency to every site's package.json. It is not: the
 * failure is uniform across the fleet, `sites/hub` included, even though hub is the one
 * site that declares `@agentic-toolkit/account` itself. Declaring it at the site does
 * not help, because the unresolved import is the toolkit package's own — `packages/adh`
 * resolving from ITS directory, which never walks into a consumer's node_modules.
 *
 * Ported from `frontend/src/next-config-base.mjs:235` (`assertLinkedDepsInstalled`),
 * which was deleted with that file. It is NOT the same check as
 * {@link import("./hoistable-deps.js").assertHoistableDeps} and does not survive on its
 * back: that one asks whether the Vercel isolate's worklist REACHES a cross-workspace
 * requirement, and it is skipped off-Vercel in spirit and answers a hosted-layout
 * question. This one asks whether the local symlink farm HAS the package at all, which
 * is a question only a local, un-run install can answer no to. Losing it turned a named
 * failure back into "Can't resolve <some package>".
 *
 * **`peerDependencies` is checked alongside `dependencies`** — the hole the design spec
 * names in §2, and the one field the original loop read. Be precise about what widening
 * it buys, because the spec is equally precise that it is not the Vercel fix: a peer
 * that the symlink farm can see resolves here whether or not `pnpm deploy` would carry
 * it, so a peers-inclusive version of this loop is green on the fleet that was red on
 * Vercel. §6.1's `assertHoistableDeps` is what discriminates that case. What this
 * catches is the same STALE-INSTALL failure as the deps half: a linked package that
 * gained a peer (and the matching `link:` devDependency that satisfies it) since the
 * toolkit workspace was last installed resolves nothing, and without this line reports
 * itself as a missing module rather than as an un-run install.
 *
 * Checked one level deep — this site's `link:` deps, and THEIR declared requirements —
 * because that is the level pnpm does not install for us. Deeper links are installed by
 * the same command, so the first missing edge is enough to send you to it.
 *
 * Skipped on Vercel, where the hazard cannot occur (a hosted build installs from the
 * lockfile every time) and the layout is not this one: `pnpm deploy --node-linker=hoisted`
 * materializes the closure into a hoisted tree, so a check written against the isolated
 * layout would be answering a question about a tree that no longer exists.
 *
 * @param siteDir the site's own directory — the one holding the `package.json` whose
 *   `link:` deps are walked. Defaults to `process.cwd()`, which is what Next sets when
 *   it evaluates `next.config.ts`; passed explicitly by `adhNextConfig` for the same
 *   reason `readSiteVersion` takes it — a caller that already knows the path should not
 *   have to depend on cwd.
 */
export function assertLinkedDepsInstalled(siteDir: string = process.cwd()): void {
  if (process.env.VERCEL) return;
  let manifest: { dependencies?: Record<string, unknown> };
  try {
    manifest = JSON.parse(readFileSync(path.join(siteDir, "package.json"), "utf-8"));
  } catch {
    return; // No manifest to read links out of; nothing to assert.
  }
  const missing: string[] = [];
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (typeof spec !== "string" || !spec.startsWith("link:")) continue;
    const target = path.resolve(siteDir, spec.slice("link:".length));
    let linked: Record<string, Record<string, string> | undefined>;
    try {
      linked = JSON.parse(readFileSync(path.join(target, "package.json"), "utf-8"));
    } catch {
      continue; // A link: pointing at nothing is pnpm's error to report, not ours.
    }
    for (const field of CHECKED_FIELDS) {
      for (const dep of Object.keys(linked[field] ?? {})) {
        if (!resolvesFrom(target, dep)) missing.push(`${name} -> ${dep}`);
      }
    }
  }
  if (missing.length === 0) return;
  throw new Error(
    `${missing.length} dependency/dependencies of this site's link:ed packages are not ` +
      `installed:\n  ${missing.join("\n  ")}\n` +
      "Those packages live in a submodule that is its OWN pnpm workspace, so the " +
      "frontend/src install does not reach them. Install and build it:\n" +
      "  pnpm -C frontend/src build:shared\n" +
      "or build the site the way the deploy does, which runs that first:\n" +
      "  ./deployment/build <site>",
  );
}
