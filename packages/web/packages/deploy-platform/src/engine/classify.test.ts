import { describe, expect, it } from "vitest";
import {
  computeConfigStatus,
  endpointConfigStatus,
  endpointNeedsWiring,
  endpointUnconfigured,
  partitionPending,
  projectStatus,
  projectUnconfigured,
  type EndpointLike,
} from "./classify.js";

const ep = (over: Partial<EndpointLike> = {}): EndpointLike => ({
  kind: "frontend",
  platform: null,
  deployProject: null,
  ignoreProjectWarning: false,
  ...over,
});

const proj = (over: Partial<{ platform: string; projectName: string; wired: boolean; ignored: boolean; domain: string | null }> = {}) => ({
  platform: "vercel",
  projectName: "p",
  wired: false,
  ignored: false,
  domain: "x.com" as string | null,
  ...over,
});

describe("endpointNeedsWiring", () => {
  it("deploy-backed kinds need wiring", () => {
    for (const k of ["http", "frontend", "admin"]) expect(endpointNeedsWiring(k)).toBe(true);
  });
  it("infra kinds do not", () => {
    for (const k of ["health", "custom", "dns"]) expect(endpointNeedsWiring(k)).toBe(false);
  });
});

describe("endpointUnconfigured", () => {
  it("flags a frontend with no platform/project", () => {
    expect(endpointUnconfigured(ep())).toBe(true);
  });
  it("is clear once BOTH platform and project are set", () => {
    expect(endpointUnconfigured(ep({ platform: "vercel", deployProject: "p" }))).toBe(false);
  });
  it("still flags when only one of platform/project is set", () => {
    expect(endpointUnconfigured(ep({ platform: "vercel" }))).toBe(true);
    expect(endpointUnconfigured(ep({ deployProject: "p" }))).toBe(true);
  });
  it("respects the operator opt-out", () => {
    expect(endpointUnconfigured(ep({ ignoreProjectWarning: true }))).toBe(false);
  });
  it("never flags an infra kind", () => {
    expect(endpointUnconfigured(ep({ kind: "health" }))).toBe(false);
  });
});

describe("endpointConfigStatus", () => {
  it("an infra kind is always configured (nothing to wire)", () => {
    for (const k of ["health", "custom", "dns"]) expect(endpointConfigStatus(ep({ kind: k }))).toBe("configured");
  });
  it("a deploy-backed endpoint with BOTH platform and project is configured", () => {
    expect(endpointConfigStatus(ep({ platform: "vercel", deployProject: "p" }))).toBe("configured");
  });
  it("a deploy-backed endpoint missing wiring is unconfigured", () => {
    expect(endpointConfigStatus(ep())).toBe("unconfigured");
    expect(endpointConfigStatus(ep({ platform: "vercel" }))).toBe("unconfigured");
    expect(endpointConfigStatus(ep({ deployProject: "p" }))).toBe("unconfigured");
  });
  it("the operator opt-out moves an unwired endpoint to ignored", () => {
    expect(endpointConfigStatus(ep({ ignoreProjectWarning: true }))).toBe("ignored");
  });
  it("a WIRED endpoint stays configured even with the opt-out set", () => {
    // The flag is read only in the unwired branch — a host that folds "paused" into it
    // (the status monitor does) must not thereby downgrade a healthy wired endpoint.
    expect(endpointConfigStatus(ep({ platform: "vercel", deployProject: "p", ignoreProjectWarning: true }))).toBe("configured");
  });
  it("agrees with endpointUnconfigured on exactly the unconfigured set", () => {
    const cases = [
      ep(),
      ep({ platform: "vercel", deployProject: "p" }),
      ep({ ignoreProjectWarning: true }),
      ep({ kind: "health" }),
      ep({ platform: "vercel", deployProject: "p", ignoreProjectWarning: true }),
    ];
    for (const c of cases) expect(endpointUnconfigured(c)).toBe(endpointConfigStatus(c) === "unconfigured");
  });
});

describe("projectStatus / projectUnconfigured", () => {
  it("classifies wired → monitored, ignored → ignored, else unmonitored", () => {
    expect(projectStatus({ wired: true, ignored: false })).toBe("monitored");
    expect(projectStatus({ wired: false, ignored: true })).toBe("ignored");
    expect(projectStatus({ wired: false, ignored: false })).toBe("unmonitored");
  });
  it("unconfigured ⇔ unmonitored", () => {
    expect(projectUnconfigured({ wired: false, ignored: false })).toBe(true);
    expect(projectUnconfigured({ wired: true, ignored: false })).toBe(false);
    expect(projectUnconfigured({ wired: false, ignored: true })).toBe(false);
  });
});

describe("partitionPending", () => {
  it("everything monitored or ignored → empty partition", () => {
    const r = partitionPending([proj({ wired: true, domain: "a.com" }), proj({ ignored: true })]);
    expect(r.pending).toHaveLength(0);
    expect(r.addable).toHaveLength(0);
    expect(r.noDomain).toBe(0);
  });

  it("splits a {wired, unwired-with-domain, domainless} fixture into pending/addable/noDomain", () => {
    const r = partitionPending([
      proj({ projectName: "already-wired", wired: true, domain: "a.com" }), // monitored → not pending
      proj({ projectName: "unwired", domain: "b.com" }), // pending + addable
      proj({ projectName: "no-domain", domain: null }), // pending, no domain
    ]);
    expect(r.pending.map((p) => p.projectName).sort()).toEqual(["no-domain", "unwired"]);
    expect(r.addable.map((p) => p.projectName)).toEqual(["unwired"]);
    expect(r.noDomain).toBe(1);
  });
});

describe("computeConfigStatus — counts", () => {
  it("counts the SITES and PROJECTS axes independently and sums them", () => {
    const status = computeConfigStatus(
      [
        ep(), // unconfigured frontend → a site gap
        ep({ platform: "vercel", deployProject: "wired" }), // fully wired → not counted
        ep({ kind: "health" }), // infra → never counted
      ],
      [
        proj({ platform: "vercel", domain: "a.com" }), // unmonitored → a project gap
        proj({ platform: "railway", wired: true }), // monitored → not counted
      ],
    );
    expect(status.counts.sites).toBe(1);
    expect(status.counts.projects).toBe(1);
    expect(status.counts.total).toBe(2);
    expect(status.addableProjects).toHaveLength(1);
    expect(status.unmonitoredByPlatform.get("vercel")).toBe(1);
  });

  it("is total 0 when everything is configured", () => {
    const status = computeConfigStatus(
      [ep({ platform: "vercel", deployProject: "p" }), ep({ kind: "dns" })],
      [proj({ wired: true }), proj({ ignored: true })],
    );
    expect(status.counts.total).toBe(0);
    expect(status.unconfiguredSites).toHaveLength(0);
    expect(status.unmonitoredProjects).toHaveLength(0);
  });
});
