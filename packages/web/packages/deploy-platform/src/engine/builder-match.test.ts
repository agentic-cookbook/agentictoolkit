import { describe, expect, it } from "vitest";
import { planBuilderSite, type BuilderSiteLite, type EnumeratedProjectLike } from "./builder-match.js";

const project = (over: Partial<EnumeratedProjectLike> = {}): EnumeratedProjectLike => ({
  platform: "vercel",
  projectName: "p",
  environment: null,
  domain: null,
  domains: [],
  gitRepo: null,
  rootDirectory: null,
  ...over,
});

const site = (over: Partial<BuilderSiteLite> & { id: string }): BuilderSiteLite => ({
  slug: "",
  name: "",
  repoDir: "",
  platform: "vercel",
  prodUrl: null,
  ...over,
});

describe("planBuilderSite", () => {
  it("matched by rootDirectory == repoDir with null prodUrl → fill-prod-url (production domain)", () => {
    const p = project({ projectName: "docs", domain: "docs.example.com", domains: ["docs.example.com"], rootDirectory: "apps/docs" });
    const sites = [site({ id: "s1", slug: "docs", repoDir: "apps/docs", prodUrl: null })];
    expect(planBuilderSite(p, sites)).toEqual({ kind: "fill-prod-url", siteId: "s1", prodUrl: "https://docs.example.com" });
  });

  it("unmatched with a rootDirectory → new-site (repoDir from rootDirectory, platform canonicalized)", () => {
    const p = project({
      platform: "cloudflare-pages",
      projectName: "marketing",
      domain: "marketing.example.com",
      domains: ["marketing.example.com"],
      gitRepo: "git@github.com:acme/marketing-site.git",
      rootDirectory: "apps/marketing",
    });
    const sites = [site({ id: "other", slug: "other", repoDir: "apps/other", prodUrl: "https://other.example.com" })];
    expect(planBuilderSite(p, sites)).toEqual({
      kind: "new-site",
      site: { name: "marketing", slug: "marketing", repoDir: "apps/marketing", platform: "cloudflare", prodUrl: "https://marketing.example.com" },
    });
  });

  it("matched by projectBaseName == slug but prodUrl already set → skip (no plan, already configured)", () => {
    // domain host doesn't equal the site's prodUrl host, so the match falls through to slug.
    const p = project({ projectName: "blog-production", domain: "blog.other.com", domains: ["blog.other.com"] });
    const sites = [site({ id: "s3", slug: "blog", prodUrl: "https://blog.example.com" })];
    expect(planBuilderSite(p, sites)).toEqual({ kind: "skip", reason: "already configured" });
  });

  it("no rootDirectory, no domain, no gitRepo → skip (\"no identity\")", () => {
    const p = project({ projectName: "mystery" });
    expect(planBuilderSite(p, [])).toEqual({ kind: "skip", reason: "no identity" });
  });

  it("matched with null prodUrl but only a non-production (staging) domain → skip (nothing to fill)", () => {
    // A staging entry must NOT stamp its non-prod domain onto the site's prodUrl.
    const p = project({ projectName: "app", environment: "staging", domain: "staging.app.com", domains: ["staging.app.com"], rootDirectory: "apps/app" });
    const sites = [site({ id: "s5", slug: "app", repoDir: "apps/app", prodUrl: null })];
    expect(planBuilderSite(p, sites)).toEqual({ kind: "skip", reason: "no production domain to fill" });
  });
});
