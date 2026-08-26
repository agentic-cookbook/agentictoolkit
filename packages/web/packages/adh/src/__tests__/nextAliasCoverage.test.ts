// @vitest-environment node
// ^ Required, not a preference. This file imports the vitest config itself, which imports
// `vitest/config` -> esbuild, and esbuild refuses to load under jsdom: jsdom's TextEncoder
// produces a Uint8Array from a different realm, so esbuild's startup invariant
// (`new TextEncoder().encode("") instanceof Uint8Array`) is false and it throws "your
// JavaScript environment is broken".
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The `next/*` aliases in vitest.config.ts are a SINGLE-COPY pin, and this is what keeps
 * the list of them complete.
 *
 * This package's devDependency is next@16 while eight workspace siblings the settings
 * overlay renders through (account, auth, authentication, data, ecosystem-config, personas,
 * profile, resource) are pinned to next@15 — genuinely different installs. Vitest resolves
 * those siblings through their `development` export condition, i.e. their own `src`, so a
 * bare `next/<sub>` inside one of them Node-resolves to THEIR copy unless an alias here
 * redirects it. When that happens, `vi.mock('next/navigation', …)` in a test in this package
 * mocks a module the component under test never loaded: the real `useRouter()` runs, throws
 * "invariant expected app router to be mounted" (jsdom has no App Router) — or worse, the
 * mock silently no-ops and the assertion passes against unmocked behaviour, which is a green
 * test that proves nothing.
 *
 * The config states that invariant in prose ("add more here if a future panel pulls in
 * another next/* subpath the same way"). Prose does not fail. This derives the set from the
 * siblings' actual source and asserts the alias map covers it, so the next panel that
 * reaches for `next/headers` or `next/image` fails HERE, by name, instead of somewhere
 * downstream in a test whose subject looks unrelated.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url)); // src/__tests__/x -> package root
const OWN_NEXT = join(ROOT, "node_modules/next");
const SCOPE = join(ROOT, "node_modules/@agentic-toolkit");
const SPECIFIER = /["']next\/([^"'\s]+)["']/g;

/** Workspace siblings whose `next` is a DIFFERENT install from this package's. */
function siblingsWithTheirOwnNext(): { name: string; root: string }[] {
  const own = realpathSync(OWN_NEXT);
  const found: { name: string; root: string }[] = [];
  for (const name of readdirSync(SCOPE)) {
    let root: string;
    try {
      root = realpathSync(join(SCOPE, name));
    } catch {
      continue; // a dangling link is a broken install, not a next-copy question
    }
    const theirs = join(root, "node_modules/next");
    if (!existsSync(theirs) || realpathSync(theirs) === own) continue;
    found.push({ name, root });
  }
  return found;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // `dist` is never what vitest resolves here (the `development` condition serves src),
    // and a sibling's own `__tests__` do not run in this process.
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "__tests__", ".turbo"].includes(entry.name)) continue;
      out.push(...sourceFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function importedNextSubpaths(): Map<string, string[]> {
  const bySubpath = new Map<string, string[]>();
  for (const { name, root } of siblingsWithTheirOwnNext()) {
    const src = join(root, "src");
    if (!existsSync(src)) continue;
    for (const file of sourceFiles(src)) {
      for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
        const sub = match[1];
        if (!sub) continue;
        const list = bySubpath.get(sub) ?? [];
        if (!list.includes(name)) list.push(name);
        bySubpath.set(sub, list);
      }
    }
  }
  return bySubpath;
}

/**
 * The alias list vitest is actually using — the real array, not a text scrape.
 *
 * Loaded at runtime rather than by a static `import '../../vitest.config'` because that
 * static edge drags a file outside `rootDir: './src'` into tsc's program and `pnpm run lint`
 * fails with TS6059. Reading the config as text was the other option and it is strictly
 * worse: the comment above the aliases names `next/link` and `next/navigation` in prose, so
 * a scrape would keep "finding" a subpath whose alias line had been deleted — a guard that
 * passes on the exact edit it exists to catch.
 *
 * The config uses vitest's ARRAY alias form, not the object form, and it has to: the
 * `@agenticdevelopertoolkit/*` pins that `adtAlias()` contributes carry a `customResolver`
 * that RE-RESOLVES the specifier from this package instead of rewriting its prefix (an
 * object entry matches by prefix and would mangle exports-mapped subpaths like
 * `@shikijs/rehype/core`). Only an array entry can carry that resolver. So a pin here is
 * named one of two ways — a literal `find` for the hand-written `next/*` entries, or the
 * `name` field `adtAlias` stamps on the ones it derives — and `pinnedNames()` reads both.
 */
interface AliasEntry {
  /** Set by adtAlias() on the entries it derives; absent on hand-written ones. */
  name?: string;
  find: string | RegExp;
  replacement: string;
}

let alias: AliasEntry[] = [];

/** Every specifier the config pins, however the entry spells it. */
function pinnedNames(): Set<string> {
  const names = new Set<string>();
  for (const entry of alias) {
    if (typeof entry.name === "string") names.add(entry.name);
    if (typeof entry.find === "string") names.add(entry.find);
  }
  return names;
}

beforeAll(async () => {
  const loaded = (await import(new URL("../../vitest.config.ts", import.meta.url).href)) as {
    default?: { resolve?: { alias?: AliasEntry[] } };
  };
  alias = loaded.default?.resolve?.alias ?? [];
});

describe("vitest.config.ts next/* aliases", () => {
  // `alias` is read through optional chaining off a runtime import, so a config restructure
  // (aliases moved back to the object form, or behind a function) would silently yield [] and
  // make every assertion below trivially true. The react pin is a different invariant that
  // lives in the same list: if it is not visible from here, this file is reading the wrong
  // thing.
  it("can see the alias list at all", () => {
    expect(alias.length).toBeGreaterThan(0);
    expect(pinnedNames().has("react")).toBe(true);
  });

  // Without this, every assertion below is vacuous the moment the scan stops finding
  // anything — a broken scan and a clean workspace look identical from the outside.
  it("finds the next@15 siblings this scan is about", () => {
    const names = siblingsWithTheirOwnNext().map((s) => s.name);
    expect(names).toContain("account");
    expect(names).toContain("resource");
  });

  it("aliases every next/* subpath those siblings import", () => {
    const imported = importedNextSubpaths();
    expect(imported.size).toBeGreaterThan(0);
    const pinned = pinnedNames();
    const missing = [...imported.entries()]
      .filter(([sub]) => !pinned.has(`next/${sub}`))
      .map(([sub, pkgs]) => `next/${sub} (imported by ${pkgs.sort().join(", ")})`);
    expect(missing, "add these to resolve.alias in vitest.config.ts").toEqual([]);
  });

  it("points every alias at a file that exists", () => {
    // The aliases spell next's flat shim layout (`node_modules/next/<sub>.js`) by hand. A
    // subpath next serves from a directory instead has no such file, and an alias pointing
    // at a missing file fails as an unresolved import rather than as "the pin is wrong".
    const broken = alias
      .filter((entry) => typeof entry.find === "string" && entry.find.startsWith("next/"))
      .filter((entry) => !existsSync(entry.replacement))
      .map((entry) => [entry.find, entry.replacement]);
    expect(broken).toEqual([]);
  });
});
