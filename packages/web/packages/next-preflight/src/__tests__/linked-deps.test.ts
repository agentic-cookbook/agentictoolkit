import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertLinkedDepsInstalled } from "../linked-deps.js";

let root: string;
let site: string;

/** Write a `package.json` into `dir`, creating it. */
function manifest(dir: string, body: Record<string, unknown>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(body));
}

/** Make `<dir>/node_modules/<name>` a resolvable package. */
function install(dir: string, name: string): void {
  manifest(join(dir, "node_modules", name), { name, version: "0.0.0" });
}

beforeEach(() => {
  // realpathSync'd for the same reason hoistable-deps.test.ts does it: `resolvesFrom`
  // resolves through realpath, and macOS's tmpdir sits behind /var -> /private/var.
  root = realpathSync(mkdtempSync(join(tmpdir(), "linked-deps-")));
  site = join(root, "sites", "registries");
  mkdirSync(site, { recursive: true });
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("assertLinkedDepsInstalled", () => {
  it("throws, naming the edge and the install command, when a linked package's dependency is absent", () => {
    const pkg = join(root, "toolkit", "adh");
    manifest(pkg, { name: "@agentic-toolkit/adh", dependencies: { "@agentic-toolkit/account": "workspace:*" } });
    manifest(site, { dependencies: { "@agentic-toolkit/adh": `link:${pkg}` } });

    // The failure this exists for: the toolkit package is checked out, declared and in
    // the lockfile — its workspace was simply never re-installed after it gained the
    // dep — and webpack reports it as `Can't resolve '@agentic-toolkit/account/...'`,
    // which reads as a broken toolkit. The message has to name the un-run install.
    expect(() => assertLinkedDepsInstalled(site)).toThrowError(
      /@agentic-toolkit\/adh -> @agentic-toolkit\/account/,
    );
    expect(() => assertLinkedDepsInstalled(site)).toThrowError(/build:shared/);
  });

  it("passes once the linked package's dependency is installed where it can see it", () => {
    const pkg = join(root, "toolkit", "adh");
    manifest(pkg, { name: "@agentic-toolkit/adh", dependencies: { "@agentic-toolkit/account": "workspace:*" } });
    install(pkg, "@agentic-toolkit/account");
    manifest(site, { dependencies: { "@agentic-toolkit/adh": `link:${pkg}` } });

    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });

  // The field the original loop did not read (design spec §2). Note what this does and
  // does not buy: a peer the symlink farm can see resolves here whether or not
  // `pnpm deploy` would carry it into the hoisted isolate — that discrimination is
  // `assertHoistableDeps`'s job, and a peers-inclusive version of THIS loop was green
  // on the fleet that was red on Vercel. What it catches is the stale-install case: a
  // package that gained a peer since the toolkit workspace was last installed.
  it("checks peerDependencies as well as dependencies", () => {
    const pkg = join(root, "toolkit", "registry");
    manifest(pkg, {
      name: "@agentic-toolkit/registry",
      peerDependencies: { "@agenticdevelopertoolkit/registry-types": "*" },
    });
    manifest(site, { dependencies: { "@agentic-toolkit/registry": `link:${pkg}` } });

    expect(() => assertLinkedDepsInstalled(site)).toThrowError(
      /@agentic-toolkit\/registry -> @agenticdevelopertoolkit\/registry-types/,
    );

    install(pkg, "@agenticdevelopertoolkit/registry-types");
    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });

  it("ignores a registry dependency — only link: specs name a workspace pnpm did not install", () => {
    const pkg = join(root, "toolkit", "adh");
    manifest(pkg, { name: "@agentic-toolkit/adh", dependencies: { nothing: "1.0.0" } });
    manifest(site, { dependencies: { "@agentic-toolkit/adh": "^1.2.3", next: "^16.2.9" } });

    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });

  it("ignores a link: pointing at nothing — that is pnpm's error to report, not this one's", () => {
    manifest(site, { dependencies: { "@agentic-toolkit/gone": `link:${join(root, "no-such-dir")}` } });

    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });

  it("does nothing on Vercel, where the layout is hoisted and the hazard cannot occur", () => {
    vi.stubEnv("VERCEL", "1");
    const pkg = join(root, "toolkit", "adh");
    manifest(pkg, { name: "@agentic-toolkit/adh", dependencies: { "@agentic-toolkit/account": "workspace:*" } });
    manifest(site, { dependencies: { "@agentic-toolkit/adh": `link:${pkg}` } });

    // Would throw off-Vercel (first test above, same fixture). A hosted build installs
    // from the lockfile every time and then flattens the closure with
    // `pnpm deploy --node-linker=hoisted`, so this check would be asking about a tree
    // that no longer exists.
    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });

  it("does nothing when the site has no manifest to read links out of", () => {
    expect(() => assertLinkedDepsInstalled(site)).not.toThrow();
  });
});
