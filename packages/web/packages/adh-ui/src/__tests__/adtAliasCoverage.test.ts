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
type AliasEntry = {
  /** Bookkeeping only — vitest never reads it. Used here for failure messages. */
  name: string;
  /** The field vitest actually matches on. Every assertion below drives off THIS. */
  find: RegExp;
  customResolver: (this: unknown, source: string) => Promise<{ id: string }>;
};

/**
 * Whether the derived list pins `specifier`, asked the way vitest asks it.
 *
 * Driving this off `find` rather than off `name` is the whole point. `name` is
 * bookkeeping (vitest.adt.ts says so on the field itself), so a set built from it
 * reports "pinned" for an entry whose `find` matches nothing of the sort — every
 * assertion here would stay green while the anchors came off the pattern and
 * prefix matching quietly returned. `find` is what decides at runtime.
 */
function covers(entries: AliasEntry[], specifier: string): boolean {
  return entries.some((entry) => entry.find.test(specifier));
}

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
    const entries = adtAlias(PACKAGE_DIR);
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
        if (!covers(entries, dep)) missing.push(`${dep} (required by ${name})`);
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
    const entries = adtAlias(PACKAGE_DIR);
    expect(covers(entries, "react")).toBe(true);
    expect(covers(entries, "react-dom")).toBe(true);
  });

  /**
   * A pin must match the WHOLE specifier (and its `/` subpaths), not merely
   * contain it. Without the `^…$` anchors on `find`, `react` also matches
   * `preact` and `react-native-web`, and every other assertion in this file still
   * passes — the coverage question ("is `dep` pinned?") is answered yes either
   * way. Only the inverse question catches it, so ask it: drop an anchor from
   * `adtAlias`'s pattern and this is the test that goes red.
   */
  it("matches whole specifiers, not names that merely contain one", () => {
    const entries = adtAlias(PACKAGE_DIR);
    const pinned = entries.map((entry) => entry.name);
    expect(pinned.length).toBeGreaterThan(0);
    const overreach: string[] = [];
    for (const name of pinned) {
      // The real name and its subpaths are pinned...
      if (!covers(entries, name)) overreach.push(`${name} is not pinned by its own entry`);
      if (!covers(entries, `${name}/sub/path`)) overreach.push(`${name}/sub/path is not pinned`);
      // ...and nothing that merely contains it is. `zz-`/`-zz`/`.zz` cannot be a
      // real pinned name: every entry is built from a literal in the wanted set,
      // so a decoy matches only once the pattern has stopped being anchored.
      if (covers(entries, `zz-${name}`)) overreach.push(`zz-${name} must not be pinned`);
      if (covers(entries, `${name}-zz`)) overreach.push(`${name}-zz must not be pinned`);
      if (covers(entries, `${name}.zz`)) overreach.push(`${name}.zz must not be pinned`);
    }
    expect(overreach).toEqual([]);
  });

  /**
   * The pin's resolver has exactly one job — re-resolve the specifier from THIS
   * package — and exactly one forbidden answer: null. Vite's alias plugin passes a
   * null straight through to `vite:resolve`, which resolves from the importer,
   * i.e. from the toolkit's real path and its own node_modules. That is the second
   * copy this machinery exists to prevent, reached silently.
   *
   * The config-load precondition does not cover this. It proves the package NAME
   * resolves from the consumer, not that a given SUBPATH does. A consumer holding
   * 2.0.x of a dependency the toolkit wants at ^2.1 passes that check and misses
   * on the one subpath 2.1 added. So drive the resolver with a plugin context that
   * misses, and require a rejection naming the specifier.
   */
  it("throws when the consumer's copy cannot satisfy a pinned specifier", async () => {
    const entry = adtAlias(PACKAGE_DIR).find((candidate) => candidate.name === "react");
    expect(entry, "react is always pinned").toBeDefined();
    const missingSubpath = "react/a-subpath-this-version-does-not-publish";
    const context = { resolve: async () => null };
    await expect(entry?.customResolver.call(context, missingSubpath)).rejects.toThrow(
      missingSubpath,
    );
  });

  // ...and the same resolver hands back whatever the consumer's tree DID resolve,
  // untouched — without this the test above would also pass against a resolver
  // that threw unconditionally, which would pin nothing and break everything.
  it("returns the consumer's resolution when there is one", async () => {
    const entry = adtAlias(PACKAGE_DIR).find((candidate) => candidate.name === "react");
    const resolved = { id: "/consumer/node_modules/react/index.js" };
    const context = { resolve: async () => resolved };
    await expect(entry?.customResolver.call(context, "react")).resolves.toBe(resolved);
  });
});
