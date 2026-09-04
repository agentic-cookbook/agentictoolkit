import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

// `existsSync` is left real by default (a plain pass-through), and overridden
// per-test below — `findIsolateScript`'s own ancestor walk over a fresh tmpdir
// already exercises the "not found" path without any mocking at all.
const { mockExistsSync, realExistsSyncBox } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  realExistsSyncBox: { fn: undefined as ((p: unknown) => boolean) | undefined },
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  realExistsSyncBox.fn = actual.existsSync as (p: unknown) => boolean;
  mockExistsSync.mockImplementation(realExistsSyncBox.fn);
  return { ...actual, existsSync: mockExistsSync };
});

import { assertHoistableDeps } from "../hoistable-deps.js";

const mockSpawnSync = vi.mocked(spawnSync);

let root: string;
let site: string;

beforeEach(() => {
  // realpathSync'd: `assertHoistableDeps` resolves the site through realpathSync
  // before walking for the isolate script, and on macOS tmpdir sits under a
  // symlink (/var -> /private/var) — comparing against an unresolved `root`
  // would build a `script` path that never matches what the walk actually sees.
  root = realpathSync(mkdtempSync(join(tmpdir(), "preflight-")));
  site = join(root, "sites", "registries");
  mkdirSync(site, { recursive: true });
  mockSpawnSync.mockReset();
  mockExistsSync.mockReset();
  // Non-null: the box is filled by the `node:fs` mock factory, which vitest runs before
  // this file's imports resolve — so it is populated by the time any hook can run. Typed
  // optional because the factory is what assigns it, and nothing else can prove that to tsc.
  mockExistsSync.mockImplementation(realExistsSyncBox.fn!);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

/**
 * Put an isolate script where the ancestor walk will find it, and make `existsSync`
 * answer for that path alone — the three-line preamble every test below the first two
 * repeated verbatim.
 */
function installScript(): string {
  const script = join(root, "websites", "tools", "vercel-isolate-deps.py");
  mkdirSync(join(root, "websites", "tools"), { recursive: true });
  mockExistsSync.mockImplementation((p) => String(p) === script);
  return script;
}

/** A `spawnSync` result for a fork that never started, carrying `err.code`. */
function spawnError(code: string): ReturnType<typeof spawnSync> {
  const error = Object.assign(new Error(`spawnSync python3 ${code}`), { code });
  return {
    error,
    status: null,
    signal: null,
    stdout: "",
    stderr: "",
    pid: 0,
    output: [null, "", ""],
  } as ReturnType<typeof spawnSync>;
}

/** A `spawnSync` result for `--check` finding nothing wrong. */
function cleanRun(): ReturnType<typeof spawnSync> {
  return {
    error: undefined,
    status: 0,
    signal: null,
    stdout: "",
    stderr: "",
    pid: 0,
    output: [null, "", ""],
  } as ReturnType<typeof spawnSync>;
}

// `assertHoistableDeps` delegates the actual worklist walk to
// `vercel-isolate-deps.py --check` — see that script's own tests for the
// property being asserted. What belongs here is the TypeScript wrapper's own
// behaviour: finding (or not finding) the script, and turning its exit code
// into a thrown Error (or not).
describe("assertHoistableDeps", () => {
  it("throws, naming the path, when siteDir does not exist", () => {
    // realpathSync throwing can only mean the CALLER passed a path that does not
    // exist — a bug in the caller's siteDir derivation (Task 5's concern). Silently
    // disabling the gate here is the worst response: a mis-derived siteDir would
    // leave the gate permanently and invisibly off, exactly the "green locally, red
    // on Vercel" failure class this whole check exists to catch.
    const missing = join(root, "sites", "does-not-exist");

    expect(() => assertHoistableDeps(missing)).toThrowError(
      new RegExp(missing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  /**
   * adh keeps its sites one directory deeper — `frontend/websites/` — so its copy of the
   * script is at `frontend/websites/tools/`. That is the SAME relative path, matched one level
   * further down the ancestor walk, which is why one spelling covers both layouts.
   *
   * The walk is the one place a layout difference could disable this gate INVISIBLY: a layout
   * the probe does not match returns `undefined` and takes the "outside a fleet repo, nothing
   * to check" path — the same answer a legitimate non-fleet consumer gets. The gate would then
   * be off in exactly the repos whose `link:` paths had just been rewritten by a split, and the
   * only symptom is a Vercel build failing on a dependency that was green locally throughout.
   */
  it("finds adh's script at frontend/websites/tools, from a site under frontend/websites", () => {
    const adhSite = join(root, "frontend", "websites", "registries");
    mkdirSync(adhSite, { recursive: true });
    const script = join(root, "frontend", "websites", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "frontend", "websites", "tools"), { recursive: true });
    mockExistsSync.mockImplementation((p) => String(p) === script);
    mockSpawnSync.mockReturnValue({
      status: 1,
      signal: null,
      stdout: "undeclared: @agentic-toolkit/integrations",
      stderr: "",
      pid: 0,
      output: [null, "undeclared: @agentic-toolkit/integrations", ""],
    } as ReturnType<typeof spawnSync>);

    // Throwing at all is the assertion: a gate that had not found the script would have
    // returned silently, and the site would build.
    expect(() => assertHoistableDeps(adhSite)).toThrowError(/undeclared/);
    expect(mockSpawnSync.mock.calls[0]?.[1]).toContain(script);
  });

  /**
   * The walk stops at the repo it started in.
   *
   * A fleet repo vendors its toolkits as git submodules under `websites/external/`, and those
   * carry sites of their own. Without a boundary the walk climbs straight out of the submodule
   * and resolves the OUTER repo's isolate script, which then checks the submodule's demo site
   * against a worklist built from manifests it has nothing to do with — five cross-workspace
   * requirements reported against a site that declares none of them, and no edit to that site
   * that can make it pass. `undefined` is the correct answer there: the demo site is not a
   * fleet site, and "nothing to check" is exactly what a non-fleet consumer gets.
   */
  it("stops at a .git boundary rather than answering from the enclosing repo", () => {
    const script = join(root, "websites", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "websites", "tools"), { recursive: true });
    const inner = join(root, "websites", "external", "agentictoolkit");
    const innerSite = join(inner, "websites", "site");
    mkdirSync(innerSite, { recursive: true });
    // A submodule's `.git` is a FILE, not a directory — `existsSync` answers for both, which
    // is the whole reason the boundary is probed that way rather than with a stat on a dir.
    const innerGit = join(inner, ".git");
    mockExistsSync.mockImplementation((p) => String(p) === script || String(p) === innerGit);

    expect(() => assertHoistableDeps(innerSite)).not.toThrow();
    expect(mockSpawnSync).not.toHaveBeenCalled();

    // …and the same outer script is still found from a site that really is the outer repo's,
    // so the boundary has not simply turned the gate off.
    mockSpawnSync.mockReturnValue(cleanRun());
    assertHoistableDeps(site);
    expect(mockSpawnSync.mock.calls[0]?.[1]).toContain(script);
  });

  it("returns without throwing when no isolate script is found on any ancestor, and does not spawn", () => {
    // `root` is a fresh tmpdir with no `websites/tools/vercel-isolate-deps.py` anywhere
    // above it (up to the real filesystem root) and no `.git` to stop at, so the ancestor
    // walk in `findIsolateScript` exhausts without a hit.
    expect(() => assertHoistableDeps(site)).not.toThrow();
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  it("throws, with the script's stdout in the message, when --check exits non-zero", () => {
    const script = join(root, "websites", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "websites", "tools"), { recursive: true });
    mockExistsSync.mockImplementation((p) => String(p) === script);
    mockSpawnSync.mockReturnValue({
      status: 1,
      signal: null,
      stdout: "boom",
      stderr: "",
      pid: 0,
      output: [null, "boom", ""],
    } as ReturnType<typeof spawnSync>);

    expect(() => assertHoistableDeps(site)).toThrowError(/boom/);
  });

  it("returns silently when spawnSync reports ENOENT — there is no python3 to run", () => {
    const script = installScript();
    mockSpawnSync.mockReturnValue(spawnError("ENOENT"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(script).toBeTruthy();

    expect(() => assertHoistableDeps(site)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  // The half that distinguishes "no interpreter" from "the fork failed". EAGAIN
  // (process/thread limit), EMFILE/ENFILE (fd exhaustion) and ENOBUFS all arrive as
  // `run.error` too, and all three are most likely under a parallel build of 47 sites
  // — i.e. exactly when an undeclared dependency is cheapest to ship. Reading them as
  // "no python3" turns the gate off fleet-wide at that moment, and the build log looks
  // identical to a clean pass. Non-fatal (a fork failure must not fail a build) but
  // LOUD, and deliberately left out of the memo so the next config evaluation retries.
  it("warns, naming the code, when the spawn fails for any reason other than ENOENT", () => {
    installScript();
    mockSpawnSync.mockReturnValue(spawnError("EAGAIN"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => assertHoistableDeps(site)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EAGAIN"));

    // Not memoized: a second evaluation must try again.
    mockSpawnSync.mockReturnValue(cleanRun());
    assertHoistableDeps(site);
    expect(mockSpawnSync).toHaveBeenCalledTimes(2);
  });

  // The `--check` run is a blocking ~350ms fork, and Next evaluates next.config more
  // than once per site (dev boot, every config reload, each build worker). Across the
  // local suite's 47 sites that is 47 forks per pass for an answer that cannot change
  // within a process.
  it("spawns once per site, however many times it is called", () => {
    installScript();
    mockSpawnSync.mockReturnValue(cleanRun());

    assertHoistableDeps(site);
    assertHoistableDeps(site);
    assertHoistableDeps(site);

    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });

  it("does not throw but warns, naming the signal, when python3 is signal-killed", () => {
    // status: null with a signal (e.g. SIGKILL under an OOM'd parallel build) used to
    // read as indistinguishable from a clean pass. Keeping it non-fatal is right — a
    // signal-killed interpreter must not fail a build — but it must be VISIBLE in the
    // build log instead of silently identical to success.
    const script = join(root, "websites", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "websites", "tools"), { recursive: true });
    mockExistsSync.mockImplementation((p) => String(p) === script);
    mockSpawnSync.mockReturnValue({
      error: undefined,
      status: null,
      signal: "SIGKILL",
      stdout: "",
      stderr: "",
      pid: 0,
      output: [null, "", ""],
    } as ReturnType<typeof spawnSync>);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => assertHoistableDeps(site)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SIGKILL"));
  });
});
