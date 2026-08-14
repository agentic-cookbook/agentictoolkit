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
  mockExistsSync.mockImplementation(realExistsSyncBox.fn);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

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

  it("returns without throwing when no isolate script is found on any ancestor, and does not spawn", () => {
    // `root` is a fresh tmpdir with no `frontend/src/tools/vercel-isolate-deps.py`
    // anywhere above it (up to the real filesystem root), so the ancestor walk
    // in `findIsolateScript` exhausts without a hit.
    expect(() => assertHoistableDeps(site)).not.toThrow();
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  it("throws, with the script's stdout in the message, when --check exits non-zero", () => {
    const script = join(root, "frontend", "src", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "frontend", "src", "tools"), { recursive: true });
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

  it("returns without throwing when spawnSync reports an error (e.g. no python3)", () => {
    const script = join(root, "frontend", "src", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "frontend", "src", "tools"), { recursive: true });
    mockExistsSync.mockImplementation((p) => String(p) === script);
    mockSpawnSync.mockReturnValue({
      error: new Error("ENOENT"),
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [null, "", ""],
    } as ReturnType<typeof spawnSync>);

    expect(() => assertHoistableDeps(site)).not.toThrow();
  });

  it("does not throw but warns, naming the signal, when python3 is signal-killed", () => {
    // status: null with a signal (e.g. SIGKILL under an OOM'd parallel build) used to
    // read as indistinguishable from a clean pass. Keeping it non-fatal is right — a
    // signal-killed interpreter must not fail a build — but it must be VISIBLE in the
    // build log instead of silently identical to success.
    const script = join(root, "frontend", "src", "tools", "vercel-isolate-deps.py");
    mkdirSync(join(root, "frontend", "src", "tools"), { recursive: true });
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
