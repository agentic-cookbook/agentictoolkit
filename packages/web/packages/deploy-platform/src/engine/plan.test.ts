import { describe, expect, it } from "vitest";
import { PLACEHOLDER_URL, planAddProject, type EndpointLite, type ProjectLite } from "./plan.js";

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

  it("groups the LEGACY prefix env spelling (`staging.adh`) onto its base project's site", () => {
    // The other name shape in this fleet: env as a `staging.` PREFIX rather than a
    // `-staging` suffix. `envFromProject` has always read both, so the base derivation must
    // too — otherwise this project matches nothing and step 4 names it `staging.adh`,
    // a SECOND site beside `adh`'s.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://adh-prod.vercel.app", platform: "vercel", deployProject: "adh" })];
    const plan = planAddProject({ platform: "vercel", projectName: "staging.adh", domain: "adh-stg.vercel.app", environment: "staging" }, eps);
    expect(plan).toEqual({
      kind: "add-endpoint",
      siteId: "s1",
      url: "https://adh-stg.vercel.app",
      environment: "staging",
      platform: "vercel",
      deployProject: "staging.adh",
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

  it("DOMAIN-LESS project joins its sibling's site instead of forking a second one", () => {
    // A Cloudflare Worker has no domain, so steps 1-2 can't apply — but step 3 still can,
    // and must: `api-staging` used to short-circuit straight to step 4 and ask for the slug
    // `api-production`'s site already holds, which 409s on every run, forever.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://api.example.com", platform: "cloudflare", deployProject: "api-production", environment: "production" })];
    const plan = planAddProject(proj("api-staging", null, "cloudflare"), eps);
    expect(plan).toEqual({
      kind: "add-endpoint",
      siteId: "s1",
      url: PLACEHOLDER_URL,
      environment: "staging",
      platform: "cloudflare",
      deployProject: "api-staging",
    });
  });

  it("domain-less project with NO sibling still gets its own site with the placeholder URL", () => {
    const plan = planAddProject(proj("worker-production", null, "cloudflare"), []);
    expect(plan).toEqual({
      kind: "new-site",
      siteName: "worker",
      siteSlug: "worker",
      url: PLACEHOLDER_URL,
      environment: "production",
      platform: "cloudflare",
      deployProject: "worker-production",
    });
  });

  it("a domain-less project must not 'own the apex' of an endpoint whose URL doesn't parse", () => {
    // Both hosts are "" — an unguarded host/apex comparison silently matched them and
    // grafted the Worker onto whatever site held the malformed endpoint.
    const eps = [ep({ id: "e1", siteId: "s1", url: "not a url", platform: "vercel", deployProject: "unrelated" })];
    const plan = planAddProject(proj("worker-production", null, "cloudflare"), eps);
    expect(plan).toMatchObject({ kind: "new-site", siteSlug: "worker" });
  });

  it("sibling site whose SAME env is backed by another project → env-conflict, not a duplicate monitor", () => {
    // `x` and `x-production` share the base `x` and both resolve to `production`. Adding
    // the second leaves one site with two `production` monitors pointing at different
    // deploy projects — a duplicate no display can untangle. Name it; the operator picks.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://x-a.vercel.app", platform: "vercel", deployProject: "x", environment: "production" })];
    const plan = planAddProject({ platform: "vercel", projectName: "x-production", domain: "x-b.vercel.app" }, eps);
    expect(plan).toEqual({ kind: "env-conflict", endpointId: "e1", siteId: "s1", environment: "production", existingProject: "x" });
  });

  it("sibling site whose OTHER envs are taken still accepts a new environment", () => {
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://x-a.vercel.app", platform: "vercel", deployProject: "x", environment: "production" })];
    const plan = planAddProject({ platform: "vercel", projectName: "x-staging", domain: "x-b.vercel.app", environment: "staging" }, eps);
    expect(plan).toMatchObject({ kind: "add-endpoint", siteId: "s1", environment: "staging" });
  });
});
