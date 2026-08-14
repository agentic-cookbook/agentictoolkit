import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walk up from `dir` looking for adh's isolate script; `undefined` outside adh. */
function findIsolateScript(dir: string): string | undefined {
  let d = dir;
  for (;;) {
    const p = join(d, "frontend", "src", "tools", "vercel-isolate-deps.py");
    if (existsSync(p)) return p;
    const parent = dirname(d);
    if (parent === d) return undefined;
    d = parent;
  }
}

/**
 * Assert every cross-workspace `link:` requirement this site reaches is one the
 * Vercel isolate step will materialize at the site root.
 *
 * NOT "the site declared it" — adh sites are forbidden to declare the
 * `@agenticdevelopertoolkit/*` scope (frontend/tools/verify_persona_deps.py), and
 * `vercel-isolate-deps.py` materializes it for them. The property that has to hold
 * is that its worklist reaches everything; see the design spec, section 6.1.
 *
 * Delegates to that script's `--check` rather than re-deriving the worklist here:
 * one implementation of the rule, checked from the dev loop.
 *
 * A no-op outside an adh checkout (script not found) and when python3 is absent, so
 * the toolkit's own tests and non-adh consumers of this package are unaffected.
 */
export function assertHoistableDeps(siteDir: string): void {
  let site: string;
  try {
    site = realpathSync(siteDir);
  } catch {
    return;
  }
  const script = findIsolateScript(site);
  if (!script) return;

  const run = spawnSync("python3", [script, "--check", site], { encoding: "utf8" });
  // ENOENT (no python3) or a signal: this gate is not the place to fail a build over
  // a missing interpreter, and the same check runs again on Vercel where python3 is
  // guaranteed.
  if (run.error || run.status === null) return;
  if (run.status === 0) return;

  throw new Error("\n" + (run.stdout ?? "") + (run.stderr ?? "") + "\n");
}
