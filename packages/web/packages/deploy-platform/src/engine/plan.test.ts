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

  it("apex owner behind `www.` → add-endpoint onto that site, NOT a duplicate new site", () => {
    // The production endpoint is `www.<apex>`; the staging project's host is `staging.<apex>`.
    // Matching only on the env prefix leaves those two hosts unrelated, so this planned a
    // NEW site named for the same project base the production project already used — a
    // (group, slug) collision that skipped the project on every run, forever.
    // Deliberately UNWIRED, so only the apex rule can match it — an operator-created site
    // never carries a deployProject for the sibling rule to fall back on.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://www.agenticstenographer.app", environment: "production" })];
    const plan = planAddProject(proj("agenticstenographer-staging", "staging.agenticstenographer.app"), eps);
    expect(plan).toEqual({
      kind: "add-endpoint",
      siteId: "s1",
      url: "https://staging.agenticstenographer.app",
      environment: "staging",
      platform: "vercel",
      deployProject: "agenticstenographer-staging",
    });
  });

  it("sibling project (same platform, same base name) on a host sharing no apex → add-endpoint there", () => {
    // Vercel names each env a SEPARATE project, and a provider host carries no apex to
    // match on — so only the shared project base (`hub`) can tie these together.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://hub-prod.vercel.app", platform: "vercel", deployProject: "hub-production" })];
    const plan = planAddProject({ platform: "vercel", projectName: "hub-testing", domain: "hub-test.vercel.app", environment: "testing" }, eps);
    expect(plan).toEqual({
      kind: "add-endpoint",
      siteId: "s1",
      url: "https://hub-test.vercel.app",
      environment: "testing",
      platform: "vercel",
      deployProject: "hub-testing",
    });
  });

  it("same base name on a DIFFERENT platform is not a sibling → new-site", () => {
    // `myagenticprojects` on Railway and Vercel are unrelated products that merely share a
    // name; grouping them would graft one product's monitor onto the other's site.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://svc.up.railway.app", platform: "railway", deployProject: "myagenticprojects" })];
    const plan = planAddProject(proj("myagenticprojects-production", "myagenticprojects.com"), eps);
    expect(plan).toMatchObject({ kind: "new-site", siteSlug: "myagenticprojects" });
  });

  it("two projects claiming one already-wired host → conflict (existing wiring named, not clobbered)", () => {
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://agenticdeveloperhelp.com", platform: "vercel", deployProject: "other-project" })];
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "other-project" });
  });
});
