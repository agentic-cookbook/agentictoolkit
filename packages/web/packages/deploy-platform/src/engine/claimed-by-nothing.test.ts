import { describe, expect, it } from "vitest";
import { endpointsClaimedByNothing, hostOmittedFromDomainLists, type ClaimEvidence, type WireableProject } from "./run.js";

/** A monitored endpoint as the removal rule sees it. Wired by default (the common case);
 *  pass `platform: null, deployProject: null` for an unwired one. */
const ep = (
  id: string,
  url: string,
  over: Partial<{ kind: string; platform: string | null; deployProject: string | null; ignoreProjectWarning: boolean }> = {},
) => ({
  id,
  url,
  kind: "frontend",
  platform: "vercel" as string | null,
  deployProject: "alpha" as string | null,
  ...over,
});

const project = (projectName: string, domains: string[], platform = "vercel"): WireableProject => ({ platform, projectName, domains });

/** Everything verified — the "both lists are up to date" happy path. */
const ALL_SEEN: ClaimEvidence = {
  configuredPlatforms: ["vercel"],
  verifiedPlatforms: ["vercel"],
  verifiedDomains: ["vercel"],
};

const ids = (r: { doomed: { id: string }[] }): string[] => r.doomed.map((e) => e.id);

describe("endpointsClaimedByNothing — the wired half (the project it names is gone)", () => {
  it("condemns a monitor whose project the enumeration no longer returns", () => {
    const endpoints = [ep("e1", "https://gone.example.com", { deployProject: "deleted" }), ep("e2", "https://live.example.com", { deployProject: "alpha" })];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual(["e1"]);
    expect(r.withheld).toEqual([]);
  });

  it("keeps a monitor whose project EXISTS but whose host the domain list doesn't report", () => {
    // Cloudflare enumerates ONE representative host per worker, so a second custom domain
    // is absent from the index while the project is perfectly alive. Judging a wired
    // endpoint on its host (rather than on its project) would delete this monitor.
    const endpoints = [ep("e1", "https://second.example.com", { platform: "cloudflare", deployProject: "worker-a" }), ep("e2", "https://live.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("worker-a", ["first.example.com"], "cloudflare"), project("alpha", ["live.example.com"])], {
      configuredPlatforms: ["vercel", "cloudflare"],
      verifiedPlatforms: ["vercel", "cloudflare"],
      verifiedDomains: ["vercel", "cloudflare"],
    });

    expect(ids(r)).toEqual([]);
  });

  it("judges each platform on ITS OWN project list — one platform's blindness spares only its own", () => {
    const endpoints = [
      ep("e1", "https://v-gone.example.com", { deployProject: "v-deleted" }),
      ep("e2", "https://v-live.example.com", { deployProject: "alpha" }),
      ep("e3", "https://r-gone.example.com", { platform: "railway", deployProject: "r-deleted" }),
      ep("e4", "https://r-live.example.com", { platform: "railway", deployProject: "beta" }),
    ];
    const projects = [project("alpha", ["v-live.example.com"]), project("beta", ["r-live.example.com"], "railway")];
    const r = endpointsClaimedByNothing(endpoints, projects, {
      configuredPlatforms: ["vercel", "railway"],
      verifiedPlatforms: ["vercel"], // railway's listing failed this pass
      verifiedDomains: ["vercel", "railway"],
    });

    expect(ids(r)).toEqual(["e1"]);
    expect(r.withheld).toEqual(["railway: project list not complete this pass — 2 wired monitors not judged"]);
  });

  it("deletes NONE of a platform's monitors when ALL of them read vanished", () => {
    // What a re-scoped/swapped token looks like: a successful list of somebody else's
    // projects. Mass deletion is never a real deletion.
    const endpoints = [ep("e1", "https://a.example.com", { deployProject: "a" }), ep("e2", "https://b.example.com", { deployProject: "b" })];
    // A railway monitor keeps the fleets overlapping, so this tests the per-platform
    // guard and not the "claims nothing at all" one.
    endpoints.push(ep("e3", "https://r.example.com", { platform: "railway", deployProject: "beta" }));
    const projects = [project("somebody-elses", ["x.example.com"]), project("beta", ["r.example.com"], "railway")];

    const r = endpointsClaimedByNothing(endpoints, projects, {
      configuredPlatforms: ["vercel", "railway"],
      verifiedPlatforms: ["vercel", "railway"],
      verifiedDomains: ["vercel", "railway"],
    });

    expect(ids(r)).toEqual([]);
    expect(r.withheld[0]).toContain("vercel: ALL 2 wired monitors name a project the enumeration didn't return");
  });
});

describe("endpointsClaimedByNothing — the unwired half (nothing serves its host)", () => {
  const unwired = (id: string, url: string, over = {}) => ep(id, url, { platform: null, deployProject: null, ...over });

  it("condemns an unwired monitor no project's domain list claims", () => {
    const endpoints = [unwired("e1", "https://orphan.example.com"), ep("e2", "https://live.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual(["e1"]);
  });

  it("keeps an unwired monitor whose host a project DOES serve (it wants wiring, not deletion)", () => {
    const endpoints = [unwired("e1", "https://alias.example.com"), ep("e2", "https://live.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com", "alias.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("keeps an unwired monitor whose host TWO projects claim (ambiguous is not absent)", () => {
    const endpoints = [unwired("e1", "https://shared.example.com"), ep("e2", "https://live.example.com")];
    const projects = [project("alpha", ["live.example.com", "shared.example.com"]), project("beta", ["shared.example.com"])];
    const r = endpointsClaimedByNothing(endpoints, projects, ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("judges NO unwired monitor while ANY configured platform's domain read is incomplete", () => {
    // Any platform could be the one serving the host, so a blind spot anywhere could be
    // hiding exactly the project that claims it.
    const endpoints = [unwired("e1", "https://orphan.example.com"), ep("e2", "https://live.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], {
      configuredPlatforms: ["vercel", "railway"],
      verifiedPlatforms: ["vercel", "railway"],
      verifiedDomains: ["vercel"], // railway's domain fan-out lost a project
    });

    expect(ids(r)).toEqual([]);
    expect(r.withheld).toEqual(["domain lists not complete for railway — 1 unwired monitor not judged"]);
  });

  it("still retires a wired monitor while the unwired half is withheld", () => {
    // The two halves have separate preconditions; a domain blind spot must not stall the
    // project-existence verdict (which is what the old Vercel rule already delivered).
    const endpoints = [ep("e1", "https://gone.example.com", { deployProject: "deleted" }), ep("e2", "https://live.example.com"), ep("e3", "https://orphan.example.com", { platform: null, deployProject: null })];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], {
      configuredPlatforms: ["vercel", "railway"],
      verifiedPlatforms: ["vercel"],
      verifiedDomains: ["vercel"],
    });

    expect(ids(r)).toEqual(["e1"]);
    expect(r.withheld).toContain("domain lists not complete for railway — 1 unwired monitor not judged");
  });
});

describe("endpointsClaimedByNothing — what it refuses to judge", () => {
  it("judges nothing when no platform is configured", () => {
    const r = endpointsClaimedByNothing([ep("e1", "https://orphan.example.com", { platform: null, deployProject: null })], [], {
      configuredPlatforms: [],
      verifiedPlatforms: [],
      verifiedDomains: [],
    });

    expect(ids(r)).toEqual([]);
    expect(r.withheld).toEqual(["no deploy platform is configured — the inventory cannot speak for any host"]);
  });

  it("judges nothing when the inventory claims NONE of the monitored hosts", () => {
    const endpoints = [ep("e1", "https://a.example.com", { platform: null, deployProject: null }), ep("e2", "https://b.example.com", { platform: null, deployProject: null })];
    const r = endpointsClaimedByNothing(endpoints, [project("somebody-elses", ["x.other.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
    expect(r.withheld[0]).toContain("claim none of the 2 monitored hosts");
  });

  it("exempts infra kinds — health / dns / custom are never deploy-backed", () => {
    const endpoints = [
      ep("e1", "https://probe.example.com", { kind: "health", platform: null, deployProject: null }),
      ep("e2", "https://ns.example.com", { kind: "dns", platform: null, deployProject: null }),
      ep("e3", "https://mcp.example.com", { kind: "custom", platform: null, deployProject: null }),
      ep("e4", "https://live.example.com"),
    ];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("exempts an endpoint the operator pressed Ignore on", () => {
    // The one escape hatch for a monitor that legitimately has no deploy project.
    const endpoints = [
      ep("e1", "https://third-party.example.com", { platform: null, deployProject: null, ignoreProjectWarning: true }),
      ep("e2", "https://live.example.com"),
    ];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("exempts provider-assigned hosts, whose absence from a domain list means nothing", () => {
    const endpoints = [
      ep("e1", "https://alpha-abc123.vercel.app", { platform: null, deployProject: null }),
      ep("e2", "https://api.workers.dev", { platform: null, deployProject: null }),
      ep("e3", "https://docs.pages.dev", { platform: null, deployProject: null }),
      ep("e4", "https://live.example.com"),
    ];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("DOES judge a railway provider host — railway reports those, so absence is evidence", () => {
    const endpoints = [ep("e1", "https://svc-production.up.railway.app", { platform: null, deployProject: null }), ep("e2", "https://live.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual(["e1"]);
  });

  it("ignores an endpoint whose URL isn't a URL, and the create path's placeholder", () => {
    // Unfinished config (a domain-less project's `https://` placeholder awaiting a URL) is
    // not config describing something deleted.
    const endpoints = [
      ep("e1", "not a url", { platform: null, deployProject: null }),
      ep("e2", "https://", { platform: null, deployProject: null }),
      ep("e3", "https://live.example.com"),
    ];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });

  it("matches a host case-insensitively and ignores its port", () => {
    const endpoints = [ep("e1", "https://LIVE.example.com:8443", { platform: null, deployProject: null }), ep("e2", "https://other.example.com")];
    const r = endpointsClaimedByNothing(endpoints, [project("alpha", ["live.example.com", "other.example.com"])], ALL_SEEN);

    expect(ids(r)).toEqual([]);
  });
});

describe("hostOmittedFromDomainLists", () => {
  it("names only the suffixes the provider reads leave out", () => {
    expect(hostOmittedFromDomainLists("x.vercel.app")).toBe(true);
    expect(hostOmittedFromDomainLists("x.workers.dev")).toBe(true);
    expect(hostOmittedFromDomainLists("x.pages.dev")).toBe(true);
    expect(hostOmittedFromDomainLists("x.up.railway.app")).toBe(false);
    expect(hostOmittedFromDomainLists("example.com")).toBe(false);
  });
});
