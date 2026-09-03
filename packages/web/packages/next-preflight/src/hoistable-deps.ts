import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Sites already checked in THIS process, so a repeated config evaluation does not
 * re-fork python3.
 *
 * The `--check` run is a blocking ~350ms `spawnSync`, and `next.config` is evaluated
 * more than once per site: dev-server boot, every config reload `next dev` performs,
 * and each build worker. Bringing up the local suite's 47 sites paid for 47 of these
 * serially, for an answer that cannot change within a process — the isolate script
 * reads manifests off disk, and a manifest edit is exactly the thing that triggers the
 * config reload that re-runs it, so a stale cache within one process is only reachable
 * by editing a DIFFERENT site's manifest. Memoized per resolved site path for the same
 * reason `commitSha` memoizes its `git rev-parse` fork (`next-env/src/commit-sha.ts:40`).
 *
 * Keyed on the realpath, not the caller's string, so two spellings of one site share
 * an entry. Only a CONCLUSIVE run is recorded: a run that failed to start, or was
 * killed by a signal, leaves the key absent so the next evaluation retries it — the
 * transient conditions those represent (a fork that hit EAGAIN, an OOM kill) are
 * precisely the ones worth retrying.
 */
const checkedSites = new Set<string>();

/**
 * The two places a fleet repo keeps the isolate script, nearest ancestor first.
 *
 * adh is a monorepo whose sites live under `frontend/src/websites/`, so its tools sit at
 * `frontend/src/tools/`. Every repo split out of it since drops that prefix: the sites are
 * under `websites/` and the tools are `websites/tools/`, byte-identical members of the
 * closure fanned out from adh-tools.
 *
 * Both spellings are checked because a split repo that matched neither did not FAIL — it
 * returned `undefined` and took the "outside adh, nothing to check" path, which is the same
 * answer a legitimate non-fleet consumer gets. So the gate that exists to catch an
 * undeclared cross-workspace `link:` silently stopped running in exactly the repos whose
 * `link:` paths had just been rewritten by the split.
 */
const ISOLATE_SCRIPT_PATHS: readonly (readonly string[])[] = [
  ["frontend", "src", "tools", "vercel-isolate-deps.py"],
  ["websites", "tools", "vercel-isolate-deps.py"],
];

/** Walk up from `dir` looking for a fleet repo's isolate script; `undefined` outside one. */
function findIsolateScript(dir: string): string | undefined {
  let d = dir;
  for (;;) {
    for (const parts of ISOLATE_SCRIPT_PATHS) {
      const p = join(d, ...parts);
      if (existsSync(p)) return p;
    }
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
 * Two failure modes are silent no-ops, and both are deliberate:
 *
 * - script not found (outside an adh checkout) — necessary; non-adh consumers and
 *   the toolkit's own tests must not break.
 * - `run.error` with `code === "ENOENT"` (no python3 on PATH) — this gate is not the
 *   place to fail a build over a missing interpreter, and the same check runs again
 *   on Vercel where python3 is guaranteed.
 *
 * The rest are NOT silent:
 *
 * - `run.error` with any OTHER code is a spawn that FAILED, not an interpreter that
 *   is absent. `EAGAIN` (process/thread limit), `EMFILE`/`ENFILE` (fd exhaustion) and
 *   `ENOBUFS` all arrive here, and all of them are most likely precisely when the
 *   gate matters most: a parallel build of 47 sites is what exhausts those limits.
 *   Treating them as "no python3" would disable the gate across the whole fleet at
 *   exactly the moment an undeclared dependency is cheapest to ship. Warns naming the
 *   code, and — like the signal case below — is left unmemoized so the next config
 *   evaluation retries.
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
  if (checkedSites.has(site)) return; // see checkedSites — same answer, ~350ms cheaper
  const script = findIsolateScript(site);
  if (!script) return;

  const run = spawnSync("python3", [script, "--check", site], { encoding: "utf8" });
  if (run.error) {
    const code = (run.error as NodeJS.ErrnoException).code;
    // ENOENT is the only one that means "no python3"; every other code is a spawn
    // that failed for a reason the gate should not swallow (see the docblock).
    if (code !== "ENOENT") {
      console.warn(
        `assertHoistableDeps: could not spawn python3 (${code ?? run.error.message}) — ` +
          "--check did not run; the hoistable-dependency gate is OFF for this evaluation",
      );
    }
    return;
  }
  if (run.status === null) {
    console.warn(
      `assertHoistableDeps: python3 was killed by signal ${run.signal} — --check did not run`,
    );
    return;
  }
  if (run.status === 0) {
    checkedSites.add(site);
    return;
  }

  throw new Error("\n" + (run.stdout ?? "") + (run.stderr ?? "") + "\n");
}
