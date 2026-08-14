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
 * Four failure modes are silent no-ops, and only two of them are deliberate:
 *
 * - script not found (outside an adh checkout) — necessary; non-adh consumers and
 *   the toolkit's own tests must not break.
 * - `run.error` (no python3) — this gate is not the place to fail a build over a
 *   missing interpreter, and the same check runs again on Vercel where python3 is
 *   guaranteed.
 *
 * The other two are NOT silent:
 *
 * - `realpathSync` throwing means the CALLER passed a `siteDir` that does not exist
 *   — a bug in the caller's derivation, not a legitimate "nothing to check" case.
 *   Silently disabling the gate would be the worst possible response: a mis-derived
 *   `siteDir` leaves the gate permanently and invisibly off, exactly the "green
 *   locally, red on Vercel" failure class this whole check exists to catch. Throws,
 *   naming the offending path.
 * - `run.status === null` with a signal (python3 killed, e.g. OOM under a parallel
 *   build) stays non-fatal — a signal-killed interpreter must not fail a build — but
 *   `console.warn`s naming the signal, so it is visible in a build log instead of
 *   indistinguishable from a clean pass.
 */
export function assertHoistableDeps(siteDir: string): void {
  let site: string;
  try {
    site = realpathSync(siteDir);
  } catch {
    throw new Error(
      `assertHoistableDeps: siteDir does not exist: ${siteDir} (check its derivation)`,
    );
  }
  const script = findIsolateScript(site);
  if (!script) return;

  const run = spawnSync("python3", [script, "--check", site], { encoding: "utf8" });
  if (run.error) return; // no python3 — not this gate's job to fail a build over that
  if (run.status === null) {
    console.warn(
      `assertHoistableDeps: python3 was killed by signal ${run.signal} — --check did not run`,
    );
    return;
  }
  if (run.status === 0) return;

  throw new Error("\n" + (run.stdout ?? "") + (run.stderr ?? "") + "\n");
}
