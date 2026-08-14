import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDeclaredDeps, resolvesFrom } from "../declared-deps.js";

let root: string;

function pkg(dir: string, manifest: Record<string, unknown>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest, null, 2));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preflight-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("assertDeclaredDeps", () => {
  // This is the exact shape of the production failure: the site links a package
  // that declares a peer, the peer resolves from the LINK TARGET's own
  // node_modules (pnpm symlink farm), but the site never declared it. The
  // hoisted Vercel tree copies only the site's graph, so the peer vanishes.
  it("throws when a linked package's peerDependency is not declared by the site", () => {
    const site = join(root, "sites", "registries");
    const feature = join(root, "packages", "registry");
    const peer = join(root, "packages", "registry-types");

    pkg(site, {
      name: "registries",
      dependencies: { "@agentic-toolkit/registry": "link:../../packages/registry" },
    });
    pkg(feature, {
      name: "@agentic-toolkit/registry",
      peerDependencies: { "@agenticdevelopertoolkit/registry-types": "*" },
    });
    pkg(peer, { name: "@agenticdevelopertoolkit/registry-types" });

    // The symlink farm: the peer IS resolvable from the feature's own directory.
    mkdirSync(join(feature, "node_modules", "@agenticdevelopertoolkit"), { recursive: true });
    symlinkSync(peer, join(feature, "node_modules", "@agenticdevelopertoolkit", "registry-types"), "dir");

    // The site's link into the feature.
    mkdirSync(join(site, "node_modules", "@agentic-toolkit"), { recursive: true });
    symlinkSync(feature, join(site, "node_modules", "@agentic-toolkit", "registry"), "dir");

    // Guard: today's (wrong) predicate passes here. That is why it shipped.
    expect(resolvesFrom(feature, "@agenticdevelopertoolkit/registry-types")).toBe(true);

    expect(() => assertDeclaredDeps(site)).toThrowError(
      /@agenticdevelopertoolkit\/registry-types/,
    );
  });

  it("passes once the site declares the peer itself", () => {
    const site = join(root, "sites", "registries");
    const feature = join(root, "packages", "registry");
    const peer = join(root, "packages", "registry-types");

    pkg(site, {
      name: "registries",
      dependencies: {
        "@agentic-toolkit/registry": "link:../../packages/registry",
        "@agenticdevelopertoolkit/registry-types": "link:../../packages/registry-types",
      },
    });
    pkg(feature, {
      name: "@agentic-toolkit/registry",
      peerDependencies: { "@agenticdevelopertoolkit/registry-types": "*" },
    });
    pkg(peer, { name: "@agenticdevelopertoolkit/registry-types" });

    mkdirSync(join(site, "node_modules", "@agentic-toolkit"), { recursive: true });
    symlinkSync(feature, join(site, "node_modules", "@agentic-toolkit", "registry"), "dir");
    mkdirSync(join(site, "node_modules", "@agenticdevelopertoolkit"), { recursive: true });
    symlinkSync(peer, join(site, "node_modules", "@agenticdevelopertoolkit", "registry-types"), "dir");

    expect(() => assertDeclaredDeps(site)).not.toThrow();
  });

  it("walks the closure transitively, not one level", () => {
    const site = join(root, "sites", "a");
    const mid = join(root, "packages", "mid");
    const leaf = join(root, "packages", "leaf");

    pkg(site, { name: "a", dependencies: { mid: "link:../../packages/mid" } });
    pkg(mid, { name: "mid", dependencies: { leaf: "link:../leaf" } });
    pkg(leaf, { name: "leaf", peerDependencies: { "missing-pkg": "*" } });

    mkdirSync(join(site, "node_modules"), { recursive: true });
    symlinkSync(mid, join(site, "node_modules", "mid"), "dir");
    mkdirSync(join(mid, "node_modules"), { recursive: true });
    symlinkSync(leaf, join(mid, "node_modules", "leaf"), "dir");

    expect(() => assertDeclaredDeps(site)).toThrowError(/missing-pkg/);
  });

  it("names the site, the owning package, and the missing package in the message", () => {
    const site = join(root, "sites", "hub");
    const feature = join(root, "packages", "persona");
    pkg(site, { name: "hub", dependencies: { "@agentic-toolkit/persona": "link:../../packages/persona" } });
    pkg(feature, { name: "@agentic-toolkit/persona", peerDependencies: { "@agenticdevelopertoolkit/chat": "*" } });
    mkdirSync(join(site, "node_modules", "@agentic-toolkit"), { recursive: true });
    symlinkSync(feature, join(site, "node_modules", "@agentic-toolkit", "persona"), "dir");

    try {
      assertDeclaredDeps(site);
      throw new Error("expected assertDeclaredDeps to throw");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("hub");
      expect(msg).toContain("@agentic-toolkit/persona");
      expect(msg).toContain("@agenticdevelopertoolkit/chat");
      // The message must tell the reader what to DO.
      expect(msg).toMatch(/package\.json/);
    }
  });

  it("returns without throwing when siteDir does not exist", () => {
    const site = join(root, "sites", "does-not-exist");
    expect(() => assertDeclaredDeps(site)).not.toThrow();
  });

  it("warns but does not throw when a linked package's package.json is malformed", () => {
    const site = join(root, "sites", "b");
    const broken = join(root, "packages", "broken");

    pkg(site, { name: "b", dependencies: { broken: "link:../../packages/broken" } });
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, "package.json"), "{ not valid json");

    mkdirSync(join(site, "node_modules"), { recursive: true });
    symlinkSync(broken, join(site, "node_modules", "broken"), "dir");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() => assertDeclaredDeps(site)).not.toThrow();
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0]?.[0])).toContain("package.json");
    } finally {
      warn.mockRestore();
    }
  });
});
