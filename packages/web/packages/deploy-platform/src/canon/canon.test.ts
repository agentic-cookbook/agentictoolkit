import { describe, expect, it } from "vitest";
import { domainFamily, envFromProject, hostEnv, projectBaseName, siteApex } from "./index.js";

describe("canon helpers", () => {
  it("hostEnv classifies common prefixes", () => {
    // `staging.`/`testing.` leading labels map to that env; a plain apex is production.
    expect(hostEnv("staging.example.com")).toBe("staging");
    expect(hostEnv("testing.example.com")).toBe("testing");
    expect(hostEnv("www.example.com")).toBe("production");
    expect(hostEnv("example.com")).toBe("production");
    // `prod`/`production` normalize to "production"; `preview` collapses to "staging".
    expect(hostEnv("prod.example.com")).toBe("production");
    expect(hostEnv("preview.example.com")).toBe("staging");
    // A leading `www.` is skipped, not treated as "no env label" — siteApex folds it away,
    // so reading the env past it is what keeps the two answers about one host consistent.
    expect(hostEnv("www.staging.example.com")).toBe("staging");
  });

  it("projectBaseName strips the env marker in BOTH spellings envFromProject reads", () => {
    expect(projectBaseName("mysite-staging")).toBe("mysite");
    expect(projectBaseName("docs-testing")).toBe("docs");
    expect(projectBaseName("app-production")).toBe("app");
    // The legacy PREFIX form. Asymmetry here is the same defect as a missing suffix: the
    // project matches no sibling, then gets NAMED for the base that sibling's site holds.
    expect(projectBaseName("staging.adh")).toBe("adh");
    expect(projectBaseName("testing.admin.adh")).toBe("admin.adh");
    expect(envFromProject("staging.adh")).toBe("staging");
    // No recognized marker → unchanged.
    expect(projectBaseName("mysite")).toBe("mysite");
  });

  it("envFromProject reads BOTH name shapes this fleet uses, and defaults to production", () => {
    // The current shape: env as a `-staging` SUFFIX.
    expect(envFromProject("docs-staging")).toBe("staging");
    expect(envFromProject("docs-testing")).toBe("testing");
    expect(envFromProject("docs-production")).toBe("production");
    expect(envFromProject("hub-staging")).toBe("staging");
    // The legacy shape: env as a `staging.` PREFIX.
    expect(envFromProject("staging.adh")).toBe("staging");
    expect(envFromProject("testing.admin.adh")).toBe("testing");
    // No marker at all is production — the un-suffixed project IS the prod one in this
    // fleet, so reading it as anything else would leave every prod deploy unclassified.
    expect(envFromProject("adh")).toBe("production");
    expect(envFromProject("agenticcookbook")).toBe("production");
  });

  it("siteApex collapses www AND env labels onto one apex", () => {
    // The whole point: a product served at `www.x` in production and `staging.x` in
    // staging must resolve to ONE site key. Stripping env labels alone leaves them different.
    expect(siteApex("www.agenticstenographer.app")).toBe("agenticstenographer.app");
    expect(siteApex("staging.agenticstenographer.app")).toBe("agenticstenographer.app");
    expect(siteApex("agenticstenographer.app")).toBe("agenticstenographer.app");
    // Either prefix may front the other.
    expect(siteApex("www.staging.example.com")).toBe("example.com");
    expect(siteApex("staging.www.example.com")).toBe("example.com");
    // A non-env, non-www label is a DIFFERENT site and stays whole.
    expect(siteApex("lewis.agenticdeveloperhub.com")).toBe("lewis.agenticdeveloperhub.com");
    // NEVER below two labels: `staging.io` reducing to `io` would make every host under
    // that TLD share one "apex", and step 2 would graft new projects onto strangers' sites.
    expect(siteApex("staging.io")).toBe("staging.io");
    expect(siteApex("www.com")).toBe("www.com");
  });

  it("domainFamily is the registrable domain, and null where that would mean nothing", () => {
    expect(domainFamily("lewis.agenticdeveloperhub.com")).toBe("agenticdeveloperhub.com");
    expect(domainFamily("agenticdeveloperhub.com")).toBe("agenticdeveloperhub.com");
    expect(domainFamily("a.b.c.example.co.uk")).toBe("example.co.uk");
    // Provider-issued hosts share a suffix but NOT a product family — never group on them.
    expect(domainFamily("svc-production-1234.up.railway.app")).toBeNull();
    expect(domainFamily("my-app.vercel.app")).toBeNull();
    expect(domainFamily("docs.pages.dev")).toBeNull();
    // Same for the other common PaaS defaults — two products hosted by one of these share
    // their HOST provider, and filing the second into the first's group is a wrong answer.
    expect(domainFamily("myapp.web.app")).toBeNull();
    expect(domainFamily("myapp.firebaseapp.com")).toBeNull();
    expect(domainFamily("x.azurestaticapps.net")).toBeNull();
    expect(domainFamily("x.ondigitalocean.app")).toBeNull();
    // Nothing to derive.
    expect(domainFamily("localhost")).toBeNull();
    expect(domainFamily("")).toBeNull();
  });
});
