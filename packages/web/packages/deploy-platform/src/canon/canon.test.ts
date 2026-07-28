import { describe, expect, it } from "vitest";
import { domainFamily, hostEnv, projectBaseName, siteApex, stripEnvPrefix } from "./index.js";

describe("canon helpers", () => {
  it("hostEnv classifies common prefixes", () => {
    // `staging.`/`testing.` leading labels map to that env; anything without a known
    // env prefix (a plain apex, or `www.` which is NOT in the prefix set) is production.
    expect(hostEnv("staging.example.com")).toBe("staging");
    expect(hostEnv("testing.example.com")).toBe("testing");
    expect(hostEnv("www.example.com")).toBe("production");
    expect(hostEnv("example.com")).toBe("production");
    // `prod`/`production` normalize to "production"; `preview` collapses to "staging".
    expect(hostEnv("prod.example.com")).toBe("production");
    expect(hostEnv("preview.example.com")).toBe("staging");
  });

  it("stripEnvPrefix removes a leading env marker", () => {
    expect(stripEnvPrefix("staging.example.com")).toBe("example.com");
    expect(stripEnvPrefix("testing.example.com")).toBe("example.com");
    // Only a KNOWN env label is stripped — `www.` is left intact.
    expect(stripEnvPrefix("www.example.com")).toBe("www.example.com");
    expect(stripEnvPrefix("example.com")).toBe("example.com");
  });

  it("projectBaseName strips a trailing env suffix", () => {
    expect(projectBaseName("mysite-staging")).toBe("mysite");
    expect(projectBaseName("docs-testing")).toBe("docs");
    expect(projectBaseName("app-production")).toBe("app");
    // No recognized suffix → unchanged.
    expect(projectBaseName("mysite")).toBe("mysite");
  });

  it("siteApex collapses www AND env labels onto one apex", () => {
    // The whole point: a product served at `www.x` in production and `staging.x` in
    // staging must resolve to ONE site key. stripEnvPrefix alone leaves them different.
    expect(siteApex("www.agenticstenographer.app")).toBe("agenticstenographer.app");
    expect(siteApex("staging.agenticstenographer.app")).toBe("agenticstenographer.app");
    expect(siteApex("agenticstenographer.app")).toBe("agenticstenographer.app");
    // Either prefix may front the other.
    expect(siteApex("www.staging.example.com")).toBe("example.com");
    expect(siteApex("staging.www.example.com")).toBe("example.com");
    // A non-env, non-www label is a DIFFERENT site and stays whole.
    expect(siteApex("lewis.agenticdeveloperhub.com")).toBe("lewis.agenticdeveloperhub.com");
  });

  it("domainFamily is the registrable domain, and null where that would mean nothing", () => {
    expect(domainFamily("lewis.agenticdeveloperhub.com")).toBe("agenticdeveloperhub.com");
    expect(domainFamily("agenticdeveloperhub.com")).toBe("agenticdeveloperhub.com");
    expect(domainFamily("a.b.c.example.co.uk")).toBe("example.co.uk");
    // Provider-issued hosts share a suffix but NOT a product family — never group on them.
    expect(domainFamily("svc-production-1234.up.railway.app")).toBeNull();
    expect(domainFamily("my-app.vercel.app")).toBeNull();
    expect(domainFamily("docs.pages.dev")).toBeNull();
    // Nothing to derive.
    expect(domainFamily("localhost")).toBeNull();
    expect(domainFamily("")).toBeNull();
  });
});
