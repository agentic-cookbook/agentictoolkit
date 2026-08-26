// @vitest-environment node
// ^ Required, not a preference: this file drives config-time machinery (node fs,
// module resolution) rather than a component, and jsdom's globals interfere with
// tooling that assumes a plain Node process.
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * `featureVitest()` builds its whole alias map from ONE input — the directory it
 * believes it is testing — and a wrong one fails silently rather than loudly.
 * `packages/web/` is the case that matters: it has a `package.json`, so the
 * original guard (which only checked for that file) passed, but it links no
 * `@agenticdevelopertoolkit/*` package, so `adtAlias()` returns its two hardcoded
 * react entries, throws nothing, and every toolkit import in the run resolves out
 * of the toolkit's own node_modules instead — the two-Reacts failure that
 * `vitest.adt.ts` exists to prevent, reached through the guard meant to stop it.
 *
 * So assert the guard against the thing it is actually for. This package is a real
 * feature package that links one; `packages/web/` is the near-miss.
 *
 * Loaded at runtime rather than by a static import for the same reason the other
 * config-shaped tests are: a static edge to a file outside `rootDir: './src'`
 * drags it into tsc's program and `pnpm run lint` fails with TS6059.
 */
const PACKAGE_DIR = fileURLToPath(new URL("../", import.meta.url)); // src/x -> the package
const WEB_WORKSPACE_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const NOT_A_PACKAGE = fileURLToPath(new URL("./no-such-directory-here/", import.meta.url));

let assertFeaturePackageDir: (packageDir: string) => string = () => "";

beforeAll(async () => {
  const loaded = (await import(new URL("../../vitest.preset.ts", import.meta.url).href)) as {
    assertFeaturePackageDir: (packageDir: string) => string;
  };
  assertFeaturePackageDir = loaded.assertFeaturePackageDir;
});

describe("featureVitest's package-directory guard", () => {
  it("accepts a feature package that links a toolkit package", () => {
    expect(assertFeaturePackageDir(PACKAGE_DIR)).toBe(PACKAGE_DIR);
  });

  // The whole point. This directory HAS a package.json, so a guard that only
  // looked for one reported it fine while pinning nothing.
  it("rejects the web workspace root, which has a manifest but links nothing", () => {
    expect(() => assertFeaturePackageDir(WEB_WORKSPACE_ROOT)).toThrow(
      /@agenticdevelopertoolkit\/\*/,
    );
    // and it names the directory it was given, so the message says which cwd was wrong
    expect(() => assertFeaturePackageDir(WEB_WORKSPACE_ROOT)).toThrow(WEB_WORKSPACE_ROOT);
  });

  it("rejects a directory with no manifest at all", () => {
    expect(() => assertFeaturePackageDir(NOT_A_PACKAGE)).toThrow(/has no package\.json/);
    expect(() => assertFeaturePackageDir(NOT_A_PACKAGE)).toThrow(NOT_A_PACKAGE);
  });
});
