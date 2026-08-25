// @vitest-environment node
// ^ Required, not a preference — see nextAliasCoverage.test.ts's identical header for
// why a real environment matters for this shape of test: jsdom's globals interfere with
// module tooling that assumes a plain Node process.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * `adtAlias()`'s own header (../../../../vitest.adt.ts) names its failure mode: a
 * dependency that slips out of the derived alias list resolves from a SECOND
 * node_modules tree instead of failing loudly, and the resulting error names React
 * (or whatever the dependency is) rather than the workspace boundary that caused it.
 * `adtAlias()` also swallows an unresolvable name silently (`catch { }`), on the
 * theory that "undeclared" should surface as the resolve error naming it — which
 * means the alias map can go quietly incomplete with no failure anywhere in the
 * normal run.
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

/** The @agenticdevelopertoolkit/* packages this package links via link:/file:. */
function linkedAdtPackages(): { name: string; manifestPath: string }[] {
  const manifest = readJson(join(PACKAGE_DIR, "package.json"));
  const declared = {
    ...((manifest.dependencies as Record<string, string>) ?? {}),
    ...((manifest.devDependencies as Record<string, string>) ?? {}),
    ...((manifest.peerDependencies as Record<string, string>) ?? {}),
  };
  const found: { name: string; manifestPath: string }[] = [];
  for (const [name, spec] of Object.entries(declared)) {
    if (!name.startsWith("@agenticdevelopertoolkit/")) continue;
    if (!spec.startsWith("link:") && !spec.startsWith("file:")) continue;
    const manifestPath = join(PACKAGE_DIR, spec.replace(/^(link|file):/, ""), "package.json");
    if (existsSync(manifestPath)) found.push({ name, manifestPath });
  }
  return found;
}

/**
 * Loaded at runtime rather than by a static `import { adtAlias } from '../../../../vitest.adt'`
 * because that static edge drags a file outside `rootDir: './src'` into tsc's program and
 * `pnpm run lint` fails with TS6059 — the same reason nextAliasCoverage.test.ts loads
 * vitest.config.ts this way rather than importing it directly.
 */
let adtAlias: (packageDir: string) => Record<string, string> = () => ({});

beforeAll(async () => {
  const loaded = (await import(new URL("../../../../vitest.adt.ts", import.meta.url).href)) as {
    adtAlias: (packageDir: string) => Record<string, string>;
  };
  adtAlias = loaded.adtAlias;
});

describe("adh-ui's ADT alias coverage", () => {
  // Without this, every assertion below is vacuous the moment the scan stops
  // finding the linked package — a broken scan and a clean workspace look
  // identical from the outside.
  it("finds the linked ADT package this scan is about", () => {
    const names = linkedAdtPackages().map((p) => p.name);
    expect(names).toContain("@agenticdevelopertoolkit/ui");
  });

  it("aliases every runtime dependency the linked ADT package declares", () => {
    const alias = adtAlias(PACKAGE_DIR);
    const missing: string[] = [];
    for (const { name, manifestPath } of linkedAdtPackages()) {
      const linked = readJson(manifestPath);
      const deps = Object.keys((linked.dependencies as Record<string, string>) ?? {});
      for (const dep of deps) {
        if (!(dep in alias)) missing.push(`${dep} (required by ${name})`);
      }
    }
    expect(
      missing,
      "declare these in adh-ui's own package.json so adtAlias() can see and pin them",
    ).toEqual([]);
  });

  // react/react-dom are peers of every ADT package rather than named in any one
  // manifest's `dependencies`; adtAlias() pins them unconditionally. Assert that
  // separately from the manifest-derived loop above, which would never catch it.
  it("always pins react and react-dom", () => {
    const alias = adtAlias(PACKAGE_DIR);
    expect(typeof alias.react).toBe("string");
    expect(typeof alias["react-dom"]).toBe("string");
  });

  it("points every alias at a directory that exists", () => {
    const alias = adtAlias(PACKAGE_DIR);
    const broken = Object.entries(alias).filter(([, target]) => !existsSync(target));
    expect(broken).toEqual([]);
  });
});
