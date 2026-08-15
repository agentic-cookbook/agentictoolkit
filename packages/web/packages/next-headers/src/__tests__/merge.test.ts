import { afterEach, describe, expect, it, vi } from "vitest";
import { FONT_CACHE_HEADERS, mergeHeaders, PRERENDER_HEADERS, SECURITY_HEADERS } from "../index.js";

// Every test in this file runs with VERCEL explicitly UNSET unless it says otherwise.
// The prerender rule is conditional on it (see prerender.ts), and a test that inherited
// an ambient VERCEL from its runner would silently assert the other branch — this file
// would then pass for a fleet that had stopped emitting the header entirely.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mergeHeaders", () => {
  it("returns the three baseline rules when the config defines no headers()", async () => {
    vi.stubEnv("VERCEL", "");
    const out = await mergeHeaders({})();
    expect(out).toEqual([
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: FONT_CACHE_HEADERS },
      { source: "/:path*", headers: PRERENDER_HEADERS },
    ]);
  });

  // THE precedence rule, and the only thing in this file worth a regression test:
  // Next applies matching header entries in array order and, for a duplicate key on
  // an overlapping path, the LAST one wins. So the app's own rules must come AFTER
  // the baseline — a site shipping a stricter Content-Security-Policy keeps it.
  // Reversing these two would still produce "both rules are present", which is why
  // this asserts the INDEX (out[3], and SECURITY_HEADERS at an index below the app
  // rule's), not just membership. A regression that reordered the spread — e.g.
  // `[...existing, baseline1, baseline2, baseline3]` — would still pass a
  // membership-only assertion and would still be a real bug: it flips who wins the
  // duplicate key.
  it("emits the app's own rules after the baseline, so the app wins a duplicate key", async () => {
    vi.stubEnv("VERCEL", "");
    const appRule = {
      source: "/(.*)",
      headers: [{ key: "Content-Security-Policy", value: "default-src 'none'" }],
    };
    const out = await mergeHeaders({ headers: async () => [appRule] })();

    expect(out).toHaveLength(4);
    expect(out[3]).toEqual(appRule);
    expect(out.findIndex((r) => r.headers === SECURITY_HEADERS)).toBeLessThan(3);
  });

  // Same precedence assertion on the hosted branch, where the baseline is one rule
  // SHORTER. Without this, dropping the prerender rule could silently shift the app's
  // own rule to an index nothing checks, and the test above would still pass because it
  // never runs with VERCEL set.
  it("still emits the app's own rules last on a hosted build, one rule earlier", async () => {
    vi.stubEnv("VERCEL", "1");
    const appRule = {
      source: "/(.*)",
      headers: [{ key: "Content-Security-Policy", value: "default-src 'none'" }],
    };
    const out = await mergeHeaders({ headers: async () => [appRule] })();

    expect(out).toHaveLength(3);
    expect(out[2]).toEqual(appRule);
  });

  it("treats a headers() that resolves to undefined as no rules", async () => {
    vi.stubEnv("VERCEL", "");
    const out = await mergeHeaders({ headers: async () => undefined })();
    expect(out).toHaveLength(3);
  });

  it("includes the credentialed-prerender header at /:path* off-Vercel", async () => {
    vi.stubEnv("VERCEL", "");
    const out = await mergeHeaders({})();
    expect(out).toContainEqual({ source: "/:path*", headers: PRERENDER_HEADERS });
  });

  // The half that matters for security rather than for speed. `Supports-Loading-Mode:
  // credentialed-prerender` grants any SAME-SITE origin permission to prerender this
  // site with the visitor's credentials, and the fleet is not one-site-per-registrable-
  // domain: `agenticdeveloperhub.com` also serves `admin.`, `status.`, `help.`, `mcp.`
  // and `builder.`, and every site's staging/testing tiers are subdomains of its own
  // apex. Nothing in a deployed environment ever asks for a prerender — the speculation
  // rules in `PrefetchSiblingSites` return early unless the hostname is local — so the
  // grant has no consumer there and is withheld. Asserting ABSENCE by key, not by
  // length, so the test names the thing it is about.
  it("withholds the credentialed-prerender opt-in on a hosted build", async () => {
    vi.stubEnv("VERCEL", "1");
    const out = await mergeHeaders({})();
    expect(out).toEqual([
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: FONT_CACHE_HEADERS },
    ]);
    expect(
      out.flatMap((r) => r.headers).some((h) => h.key === "Supports-Loading-Mode"),
    ).toBe(false);
  });
});
