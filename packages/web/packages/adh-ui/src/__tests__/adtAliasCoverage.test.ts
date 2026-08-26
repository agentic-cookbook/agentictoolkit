// @vitest-environment node
// ^ Required, not a preference — see nextAliasCoverage.test.ts's identical header for
// why a real environment matters for this shape of test: jsdom's globals interfere with
// module tooling that assumes a plain Node process.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * `adtAlias()`'s own header (../../../../vitest.adt.ts) names its failure mode: a
 * dependency that slips out of the derived alias list resolves from a SECOND
 * node_modules tree instead of failing loudly, and the resulting error names React
 * (or whatever the dependency is) rather than the workspace boundary that caused it.
 * `adtAlias()` throws on a name it cannot resolve from the consumer, so an
 * undeclared dependency does fail — but only for a package whose vitest config
 * actually calls it, and only once a test in that package runs. Deriving the
 * expected set here fails at the boundary instead, by name.
 *
 * `nextAliasCoverage.test.ts` (packages/adh/src/__tests__) solves the analogous
 * problem for `next/*` aliases by deriving the expected set from source rather than
 * trusting prose. This does the same thing for `@agenticdevelopertoolkit/ui`: read
 * ITS manifest directly, and assert every one of its declared runtime dependencies
 * shows up in `adtAlias()`'s output. The day ADT's `ui` package adds a dependency
 * this package's own package.json hasn't declared yet, that gap fails HERE, by name,
 * instead of downstream as "Cannot read properties of null (reading 'useId')".
 */

const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url)); // src/__tests__/x -> package root

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/**
 * Both loaded at runtime rather than by a static
 * `import { adtAlias, linkedAdtPackages } from '../../../../vitest.adt'` because that
 * static edge drags a file outside `rootDir: './src'` into tsc's program and
 * `pnpm run lint` fails with TS6059 — the same reason nextAliasCoverage.test.ts loads
 * vitest.config.ts this way rather than importing it directly.
 */
type AliasEntry = { name: string };

let adtAlias: (packageDir: string) => AliasEntry[] = () => [];
let linkedAdtPackages: (packageDir: string) => { name: string; manifestPath: string }[] = () => [];

beforeAll(async () => {
  const loaded = (await import(new URL("../../../../vitest.adt.ts", import.meta.url).href)) as {
    adtAlias: (packageDir: string) => AliasEntry[];
    linkedAdtPackages: (packageDir: string) => { name: string; manifestPath: string }[];
  };
  adtAlias = loaded.adtAlias;
  linkedAdtPackages = loaded.linkedAdtPackages;
});

describe("adh-ui's ADT alias coverage", () => {
  // Without this, every assertion below is vacuous the moment the scan stops
  // finding the linked package — a broken scan and a clean workspace look
  // identical from the outside.
  it("finds the linked ADT package this scan is about", () => {
    const names = linkedAdtPackages(PACKAGE_DIR).map((p) => p.name);
    expect(names).toContain("@agenticdevelopertoolkit/ui");
  });

  it("aliases every runtime dependency the linked ADT package declares", () => {
    const pinned = new Set(adtAlias(PACKAGE_DIR).map((entry) => entry.name));
    const missing: string[] = [];
    for (const { name, manifestPath } of linkedAdtPackages(PACKAGE_DIR)) {
      const linked = readJson(manifestPath);
      // Both `dependencies` and `peerDependencies`: react/react-dom reach ADT's
      // `ui` as peers today, and `adtAlias()`'s own wanted-set scan (vitest.adt.ts)
      // only walks a linked manifest's `dependencies` — it covers react/react-dom
      // only via its separate hardcoded add, not because it saw them here. A THIRD
      // peer dependency joining them would slip past that hardcoded add, and this
      // loop is what would still catch it.
      const deps = [
        ...Object.keys((linked.dependencies as Record<string, string>) ?? {}),
        ...Object.keys((linked.peerDependencies as Record<string, string>) ?? {}),
      ];
      for (const dep of deps) {
        if (!pinned.has(dep)) missing.push(`${dep} (required by ${name})`);
      }
    }
    expect(
      missing,
      "declare these in adh-ui's own package.json so adtAlias() can see and pin them",
    ).toEqual([]);
  });

  // react/react-dom are peers of every ADT package rather than named in any one
  // manifest's `dependencies`; adtAlias() pins them unconditionally regardless of
  // whether the loop above would have found them. Assert that separately, so a
  // future change dropping the hardcoded add would fail here even if some linked
  // manifest happened to also declare them elsewhere.
  it("always pins react and react-dom", () => {
    const pinned = new Set(adtAlias(PACKAGE_DIR).map((entry) => entry.name));
    expect(pinned.has("react")).toBe(true);
    expect(pinned.has("react-dom")).toBe(true);
  });
});
