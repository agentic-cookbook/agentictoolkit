import { describe, expect, it } from "vitest";
import { planAddProject, type EndpointLite, type ProjectLite } from "./plan.js";

// Fixtures mirror the status app's add-project decision table — the planner moved
// here verbatim, so its discriminants + target ids must be byte-for-byte identical.
const ep = (o: Partial<EndpointLite> & { id: string; siteId: string; url: string }): EndpointLite => ({
  kind: "http",
  environment: null,
  platform: null,
  deployProject: null,
  ...o,
});
const proj = (projectName: string, domain: string | null, platform = "vercel"): ProjectLite => ({ platform, projectName, domain });

describe("planAddProject — decision table", () => {
  it("exact-host match on a deploy-backed endpoint → wire-endpoint (its id + site)", () => {
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://staging.agenticdeveloperhelp.com" })];
    const plan = planAddProject(proj("help-staging", "staging.agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({
      kind: "wire-endpoint",
      endpointId: "e1",
      siteId: "s1",
      platform: "vercel",
      deployProject: "help-staging",
      environment: "staging",
    });
  });

  it("apex owner on a different-env host → add-endpoint onto that site", () => {
    // The Help site has only its production endpoint; the staging project attaches a
    // staging endpoint to that same site (owns the apex minus the env prefix).
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://agenticdeveloperhelp.com", environment: "production" })];
    const plan = planAddProject(proj("help-staging", "staging.agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({
      kind: "add-endpoint",
      siteId: "s1",
      url: "https://staging.agenticdeveloperhelp.com",
      environment: "staging",
      platform: "vercel",
      deployProject: "help-staging",
    });
  });

  it("unknown project with a domain nobody owns → new-site named for the base", () => {
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), []);
    expect(plan).toEqual({
      kind: "new-site",
      siteName: "help",
      siteSlug: "help",
      url: "https://agenticdeveloperhelp.com",
      environment: "production",
      platform: "vercel",
      deployProject: "help-production",
    });
  });

  it("two projects claiming one already-wired host → conflict (existing wiring named, not clobbered)", () => {
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://agenticdeveloperhelp.com", platform: "vercel", deployProject: "other-project" })];
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "other-project" });
  });
});
