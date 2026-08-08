import { describe, expect, it } from "vitest";
import { PLACEHOLDER_URL, indexLiveProjects, planAddProject, type EndpointLite, type ProjectLite } from "./plan.js";

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
/** A Railway per-environment entry (carries an explicit environment + provider host). */
const projEnv = (projectName: string, domain: string | null, environment: string, platform = "railway"): ProjectLite => ({ platform, projectName, domain, environment });

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

  it("does not confuse a subdomain site with the apex site", () => {
    // App site owns the hub apex; admin must NOT match it.
    const eps = [ep({ id: "e1", siteId: "app", url: "https://agenticdeveloperhub.com" })];
    const plan = planAddProject(proj("hub-admin-production", "admin.agenticdeveloperhub.com"), eps);
    expect(plan.kind).toBe("new-site");
  });

  it("canonicalizes the platform (cloudflare-pages → cloudflare)", () => {
    const plan = planAddProject(proj("temporal-web", "temporal.today", "cloudflare-pages"), []);
    expect(plan.kind === "new-site" && plan.platform).toBe("cloudflare");
  });

  it("preserves an operator-set environment when wiring an existing endpoint", () => {
    // Apex host has no env prefix (hostEnv → 'production'), but the operator tagged
    // it 'testing'; wiring must keep 'testing', not overwrite to 'production'.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://agenticdeveloperhelp.com", environment: "testing" })];
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({ kind: "wire-endpoint", endpointId: "e1", siteId: "s1", platform: "vercel", deployProject: "help-production", environment: "testing" });
  });

  it("matches the exact host even when the endpoint URL carries a port", () => {
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://agenticdeveloperhelp.com:443/health" })];
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), eps);
    expect(plan.kind === "wire-endpoint" && plan.endpointId).toBe("e1");
  });

  it("does not wire a health probe sharing the exact host — adds a proper endpoint to its site", () => {
    // A health probe lives on the apex host; Add must NOT graft frontend wiring onto
    // it (step 1 skips non-deploy kinds), and instead add a deploy-backed endpoint.
    const eps = [ep({ id: "h", siteId: "s1", url: "https://agenticdeveloperhelp.com/health", kind: "health" })];
    const plan = planAddProject(proj("help-production", "agenticdeveloperhelp.com"), eps);
    expect(plan).toEqual({ kind: "add-endpoint", siteId: "s1", url: "https://agenticdeveloperhelp.com", environment: "production", platform: "vercel", deployProject: "help-production" });
  });

  it("prefers a deploy-backed apex owner over a health/backend endpoint", () => {
    const eps = [
      ep({ id: "h", siteId: "backend", url: "https://agenticdeveloperhelp.com", kind: "health" }),
      ep({ id: "f", siteId: "web", url: "https://agenticdeveloperhelp.com", kind: "frontend" }),
    ];
    const plan = planAddProject(proj("help-staging", "staging.agenticdeveloperhelp.com"), eps);
    expect(plan.kind === "add-endpoint" && plan.siteId).toBe("web");
  });

  it("prefers an explicit environment over host-parsing (Railway provider host has no env prefix)", () => {
    // hostEnv('adh-backend-testing.up.railway.app') can't read the env (no leading
    // 'testing.'), so it would default to production — the explicit env must win.
    const plan = planAddProject(projEnv("adh-backend", "adh-backend-testing.up.railway.app", "testing"), []);
    expect(plan).toEqual({
      kind: "new-site",
      siteName: "adh-backend",
      siteSlug: "adh-backend",
      url: "https://adh-backend-testing.up.railway.app",
      environment: "testing",
      platform: "railway",
      deployProject: "adh-backend",
    });
  });
});

// ---------------------------------------------------------------------------
// A project RENAMED on the platform (`mikefullerton-com` → `mikefullerton-production`)
// leaves the endpoint carrying the OLD name. The new name then reads "not monitored"
// (the wired correlation is by NAME) while its own domain sits monitored — and every
// Auto Configure run refused it as a `conflict`. That is an alert with NO action that
// can clear it, re-offered forever. These lock in the repair AND its limits.
// ---------------------------------------------------------------------------
describe("planAddProject — retired vs live existing wiring", () => {
  const wiredTo = (deployProject: string, platform = "vercel"): EndpointLite[] => [
    ep({ id: "e1", siteId: "s1", url: "https://mikefullerton.com", platform, deployProject, environment: "production" }),
  ];

  it("re-points an endpoint wired to a RETIRED project, naming what it replaced", () => {
    const live = indexLiveProjects([{ platform: "vercel", projectName: "mikefullerton-production" }], ["vercel"]);
    const plan = planAddProject(proj("mikefullerton-production", "mikefullerton.com"), wiredTo("mikefullerton-com"), { liveProjects: live });
    expect(plan).toEqual({
      kind: "wire-endpoint",
      endpointId: "e1",
      siteId: "s1",
      platform: "vercel",
      deployProject: "mikefullerton-production",
      environment: "production",
      replaces: "mikefullerton-com",
      replacesPlatform: "vercel",
    });
  });

  it("still refuses when the existing project is LIVE — two real projects on one domain stay ambiguous", () => {
    const live = indexLiveProjects(
      [
        { platform: "vercel", projectName: "mikefullerton-production" },
        { platform: "vercel", projectName: "mikefullerton-com" },
      ],
      ["vercel"],
    );
    const plan = planAddProject(proj("mikefullerton-production", "mikefullerton.com"), wiredTo("mikefullerton-com"), { liveProjects: live });
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "mikefullerton-com" });
  });

  it("refuses with NO live set — an un-enumerated caller must not have its wiring rewritten", () => {
    const plan = planAddProject(proj("mikefullerton-production", "mikefullerton.com"), wiredTo("mikefullerton-com"));
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "mikefullerton-com" });
  });

  it("refuses when the platform was enumerated but NOT verified — a fallback list proves no absence", () => {
    // The names are there, but nothing vouches for the listing (a Railway token that
    // can't enumerate degrades to the configured project list; an errored page walk
    // returns what it got). Absence from such a list is silence, not evidence.
    const live = indexLiveProjects([{ platform: "vercel", projectName: "mikefullerton-production" }], []);
    const plan = planAddProject(proj("mikefullerton-production", "mikefullerton.com"), wiredTo("mikefullerton-com"), { liveProjects: live });
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "mikefullerton-com" });
  });

  it("REPAIRS across platforms when the old platform WAS verified — a migration leaves a dead name behind", () => {
    // The site moved Vercel → Railway: the old Vercel project is gone, the new Railway
    // one serves the same host. Judging the wiring against the PROJECT's platform would
    // never look at Vercel at all, and this monitor would name a deleted project forever.
    const live = indexLiveProjects([{ platform: "railway", projectName: "adh-status" }], ["vercel", "railway"]);
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://lewis.example.com", platform: "vercel", deployProject: "adh-status-monitoring-site", environment: "production" })];
    const plan = planAddProject(proj("adh-status", "lewis.example.com", "railway"), eps, { liveProjects: live });
    expect(plan).toEqual({
      kind: "wire-endpoint",
      endpointId: "e1",
      siteId: "s1",
      platform: "railway",
      deployProject: "adh-status",
      environment: "production",
      replaces: "adh-status-monitoring-site",
      replacesPlatform: "vercel",
    });
  });

  it("refuses across platforms when the OTHER platform was not verified", () => {
    // Same shape as the migration above, minus the one fact that licensed it: nothing
    // enumerated railway this run, so `legacy` may well still exist.
    const live = indexLiveProjects([{ platform: "vercel", projectName: "mikefullerton-production" }], ["vercel"]);
    const plan = planAddProject(proj("mikefullerton-production", "mikefullerton.com"), wiredTo("legacy", "railway"), { liveProjects: live });
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "legacy" });
  });

  it("indexes cloudflare-pages and cloudflare as ONE platform", () => {
    // The two spellings meet HERE: the enumeration reports `cloudflare-pages`, while the
    // project being planned reports `cloudflare` — and the lookup keys off the latter.
    // Keyed literally neither the name set nor the verified set would match, so a live
    // Pages project would read retired and its still-correct wiring would be rewritten.
    const live = indexLiveProjects([{ platform: "cloudflare-pages", projectName: "w" }], ["cloudflare-pages"]);
    const plan = planAddProject(proj("w2", "w.example.com", "cloudflare"), [
      ep({ id: "e1", siteId: "s1", url: "https://w.example.com", platform: "cloudflare-pages", deployProject: "w" }),
    ], { liveProjects: live });
    expect(plan).toEqual({ kind: "conflict", endpointId: "e1", existingProject: "w" });
  });


  it("REPAIRS a cloudflare-pages wiring — the verified set is canonicalized as well as the keys", () => {
    // Both sets meet the same spelling problem: the enumeration says `cloudflare-pages`
    // while the project says `cloudflare`. Canonicalizing only the KEYS would leave the
    // verified set spelled `cloudflare-pages`, the platform would never read as verified,
    // and a Pages project deleted upstream would hold its monitor hostage forever.
    const live = indexLiveProjects([{ platform: "cloudflare-pages", projectName: "w2" }], ["cloudflare-pages"]);
    const plan = planAddProject(proj("w2", "w.example.com", "cloudflare"), [
      ep({ id: "e1", siteId: "s1", url: "https://w.example.com", platform: "cloudflare-pages", deployProject: "gone", environment: "production" }),
    ], { liveProjects: live });
    expect(plan).toEqual({
      kind: "wire-endpoint",
      endpointId: "e1",
      siteId: "s1",
      platform: "cloudflare",
      deployProject: "w2",
      environment: "production",
      replaces: "gone",
      replacesPlatform: "cloudflare",
    });
  });

  it("does NOT relax the sibling env-conflict for a retired rival — there is nothing to re-point", () => {
    // The repair is only ever exact: step 1 rewrites a monitor of THIS project's own domain.
    // The rival here monitors a different host, so relaxing the guard would add a SECOND
    // production monitor beside the stale one — two claims on one environment, which is
    // what the rule exists to prevent — and the cycle's retire would not sweep the stale
    // one either, because it vetoes on a host that still answers.
    const eps = [ep({ id: "e1", siteId: "s1", url: "https://x-a.vercel.app", platform: "vercel", deployProject: "x", environment: "production" })];
    const live = indexLiveProjects([{ platform: "vercel", projectName: "x-production" }], ["vercel"]);
    const plan = planAddProject({ platform: "vercel", projectName: "x-production", domain: "x-b.vercel.app" }, eps, { liveProjects: live });
    expect(plan).toEqual({ kind: "env-conflict", endpointId: "e1", siteId: "s1", environment: "production", existingProject: "x" });
  });
});
