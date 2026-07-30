import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { enumerateDeployProjectsVerified } from "./index.js";
import { deployIntegrations, deployProjectMeta } from "../schema/index.js";
import type { DeployDb } from "../conn/index.js";

// `verifiedDomains` is what stands between "no project serves this host" and "we could not
// finish looking" — the read whose failure mode is an empty list. It is deliberately a
// SEPARATE fact from `verifiedPlatforms`: listing an account's projects and listing one
// project's domains are different calls with different scopes, and only the second fails
// PARTIALLY. One project's 403 in a fan-out of forty leaves a complete-looking index with a
// hole in it, and nothing downstream can know which host fell in.

/** A `deploy_project_meta` row, the Vercel half of the inventory (the sync mirrors the
 *  projects API into this table, so enumeration reads projects from here, not the API). */
const meta = (projectName: string, domain: string | null) => ({
  id: projectName,
  platform: "vercel",
  projectName,
  domain,
  gitRepo: null,
  gitBranch: null,
  rootDirectory: null,
  framework: null,
  updatedAt: new Date(),
});

/** The two `select().from()` reads this function makes, and nothing else — a real DB would
 *  add nothing to what these tests are about. `.where()` is the integrations builder's. */
function fakeDb(rows: { integrations: unknown[]; meta: unknown[] }): DeployDb {
  const result = (data: unknown[]) => {
    const p = Promise.resolve(data) as Promise<unknown[]> & { where: () => Promise<unknown[]> };
    p.where = () => Promise.resolve(data);
    return p;
  };
  return {
    select: () => ({
      from: (table: unknown) => result(table === deployIntegrations ? rows.integrations : rows.meta),
    }),
  } as unknown as DeployDb;
}

/** Vercel configured, its token in env; no other platform is wired up, so no other
 *  provider is called and none can appear in either verified set. */
const vercelOnly = (metas: unknown[]) =>
  fakeDb({
    integrations: [{ platform: "vercel", config: { teamId: "team_x" }, tokenEnvVar: "TEST_VERCEL_TOKEN", isActive: true }],
    meta: metas,
  });

/** Answer the per-project domain fan-out, 403ing the named projects. */
function serveDomains(forbidden: string[] = []): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(typeof input === "string" ? input : input.href);
      const project = decodeURIComponent(/\/v9\/projects\/([^/]+)\/domains/.exec(url.pathname)?.[1] ?? "");
      if (forbidden.includes(project)) return new Response("forbidden", { status: 403 });
      return new Response(JSON.stringify({ domains: [{ name: `${project}.example.com`, verified: true }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("TEST_VERCEL_TOKEN", "vercel-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enumerateDeployProjectsVerified — domain provenance", () => {
  it("verifies vercel's domains when every project's read succeeds", async () => {
    serveDomains();

    const r = await enumerateDeployProjectsVerified(vercelOnly([meta("vd-a", "vd-a.example.com"), meta("vd-b", null)]));

    expect(r.verifiedDomains).toEqual(["vercel"]);
    expect(r.projects.map((p) => p.domains)).toEqual([["vd-a.example.com"], ["vd-b.example.com"]]);
    // Never here: these projects came from the meta MIRROR, not from a call this function
    // made, so only the caller that refreshed that table knows the read behind it was
    // complete. It adds `vercel` itself when it was.
    expect(r.verifiedPlatforms).toEqual([]);
  });

  it("DISQUALIFIES the whole platform when ONE project's domain read 403s", async () => {
    // Not just that project: its domains are missing from the index and there is no way to
    // know which host that cost, so no host's absence from the index proves anything.
    serveDomains(["vd-403"]);

    const r = await enumerateDeployProjectsVerified(vercelOnly([meta("vd-ok", "vd-ok.example.com"), meta("vd-403", "vd-403.example.com")]));

    expect(r.verifiedDomains).toEqual([]);
    // The enumeration itself is unharmed — both projects still enumerate, the unreadable
    // one falling back to its meta domain. Only the PROVENANCE changes, which is exactly
    // the point: the list stays useful for everything except reading an absence.
    expect(r.projects.map((p) => p.projectName)).toEqual(["vd-403", "vd-ok"]);
    expect(r.projects.map((p) => p.domains)).toEqual([["vd-403.example.com"], ["vd-ok.example.com"]]);
  });

  it("does not verify domains for a platform that was never read at all", async () => {
    // No token: the fan-out never runs, so the index is empty for the emptiest possible
    // reason. `verifiedDomains: []` is also what a tokenless railway/cloudflare gets here —
    // an unconfigured platform is never verified into speaking for a host.
    vi.unstubAllEnvs();
    serveDomains();

    const r = await enumerateDeployProjectsVerified(vercelOnly([meta("vd-notok", "vd-notok.example.com")]));

    expect(r.verifiedDomains).toEqual([]);
    expect(r.verifiedPlatforms).toEqual([]);
    expect(r.projects).toHaveLength(1);
  });
});
