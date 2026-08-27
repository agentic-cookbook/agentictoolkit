// @vitest-environment node
// ^ Required, not a preference — see nextAliasCoverage.test.ts's identical header for why:
// this file imports the workspace-root vitest.config.ts, which imports `vitest/config` ->
// esbuild, and esbuild refuses to load under jsdom.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * ../../../../vitest.config.ts (the workspace root config) fails fast when `--dir` targets
 * a package that owns its own vitest.config.ts, per its own header comment: loading the
 * root config there skips that package's aliases/environment/setup and its failures read
 * like a product regression rather than a wrong command (this is what happened to
 * `adh-ui`'s `--dir packages/adh-ui` before the guard existed).
 *
 * A guard that has never been proven to fire is not a guard, so this exercises both
 * directions directly against the real, exported functions rather than against prose: it
 * fires for a package known to own a config, stays out of the way for a package known not
 * to, and — since the fixture packages this scan is about could themselves rot — proves
 * against a throwaway directory tree that the DETECTION rule itself (not today's specific
 * package layout) is what is under test.
 */

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url)); // src/__tests__/x -> adh -> packages -> web

let checkDirTarget: (argv: string[], cwd: string, packagesDir?: string) => void;
let packagesWithOwnConfig: (packagesDir?: string) => string[];

beforeAll(async () => {
  const loaded = (await import(new URL("../../../../vitest.config.ts", import.meta.url).href)) as {
    checkDirTarget: typeof checkDirTarget;
    packagesWithOwnConfig: typeof packagesWithOwnConfig;
  };
  checkDirTarget = loaded.checkDirTarget;
  packagesWithOwnConfig = loaded.packagesWithOwnConfig;
});

const FIXTURE_ROOT = join(ROOT, "__vitestDirGuardFixture__");
const WITH_CONFIG = join(FIXTURE_ROOT, "has-own-config");
const WITHOUT_CONFIG = join(FIXTURE_ROOT, "no-own-config");

function makeFixture(): void {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  mkdirSync(WITH_CONFIG, { recursive: true });
  mkdirSync(WITHOUT_CONFIG, { recursive: true });
  writeFileSync(join(WITH_CONFIG, "vitest.config.ts"), "export default {}\n");
  writeFileSync(
    join(WITH_CONFIG, "package.json"),
    JSON.stringify({ name: "@agentic-toolkit/has-own-config" }),
  );
  writeFileSync(join(WITHOUT_CONFIG, "package.json"), JSON.stringify({ name: "@agentic-toolkit/no-own-config" }));
}

afterEach(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("workspace-root vitest.config.ts's --dir guard", () => {
  it("can see the exported functions at all", () => {
    expect(typeof checkDirTarget).toBe("function");
    expect(typeof packagesWithOwnConfig).toBe("function");
  });

  // Not a fixture assertion — a live check against today's real tree, so a future change
  // that stops adh-ui from owning its own config (or renames it) is caught here too.
  it("finds adh-ui among the real packages that own a config", () => {
    expect(packagesWithOwnConfig()).toContain("adh-ui");
  });

  it("fires, naming the filter command, for a package that owns a config", () => {
    makeFixture();
    expect(() => checkDirTarget(["node", "vitest.mjs", "run", "--dir", "has-own-config"], FIXTURE_ROOT, FIXTURE_ROOT)).toThrow(
      /has-own-config.*pnpm --filter @agentic-toolkit\/has-own-config run test/s,
    );
  });

  // `checkDirTarget` reads the value two ways — the separate `--dir value` argument and
  // the joined `--dir=value` — and only the first was exercised, so deleting the
  // `--dir=` branch left this file green while every `--dir=<pkg>` invocation walked
  // straight past the guard. Both spellings are what a human actually types.
  it("fires for the joined --dir=value spelling too", () => {
    makeFixture();
    expect(() =>
      checkDirTarget(["node", "vitest.mjs", "run", "--dir=has-own-config"], FIXTURE_ROOT, FIXTURE_ROOT),
    ).toThrow(/has-own-config.*pnpm --filter @agentic-toolkit\/has-own-config run test/s);
  });

  it("stays out of the way for --dir=value naming a package that owns no config", () => {
    makeFixture();
    expect(() =>
      checkDirTarget(["node", "vitest.mjs", "run", "--dir=no-own-config"], FIXTURE_ROOT, FIXTURE_ROOT),
    ).not.toThrow();
  });

  it("fires for a --dir value nested inside such a package, not just the exact root", () => {
    makeFixture();
    expect(() =>
      checkDirTarget(["node", "vitest.mjs", "run", "--dir", "has-own-config/src"], FIXTURE_ROOT, FIXTURE_ROOT),
    ).toThrow(/has-own-config/);
  });

  it("stays out of the way for a package that does not own a config", () => {
    makeFixture();
    expect(() =>
      checkDirTarget(["node", "vitest.mjs", "run", "--dir", "no-own-config"], FIXTURE_ROOT, FIXTURE_ROOT),
    ).not.toThrow();
  });

  it("stays out of the way when there is no --dir flag at all", () => {
    makeFixture();
    expect(() => checkDirTarget(["node", "vitest.mjs", "run"], FIXTURE_ROOT, FIXTURE_ROOT)).not.toThrow();
  });
});
