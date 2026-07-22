import { describe, expect, it } from "vitest";
import { computeConfigStatus, partitionPending, type EndpointLike } from "./classify.js";

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

describe("partitionPending", () => {
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
