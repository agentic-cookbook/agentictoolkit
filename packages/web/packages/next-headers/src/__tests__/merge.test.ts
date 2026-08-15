import { describe, expect, it } from "vitest";
import { FONT_CACHE_HEADERS, mergeHeaders, PRERENDER_HEADERS, SECURITY_HEADERS } from "../index.js";

describe("mergeHeaders", () => {
  it("returns the three baseline rules when the config defines no headers()", async () => {
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
    const appRule = {
      source: "/(.*)",
      headers: [{ key: "Content-Security-Policy", value: "default-src 'none'" }],
    };
    const out = await mergeHeaders({ headers: async () => [appRule] })();

    expect(out).toHaveLength(4);
    expect(out[3]).toEqual(appRule);
    expect(out.findIndex((r) => r.headers === SECURITY_HEADERS)).toBeLessThan(3);
  });

  it("treats a headers() that resolves to undefined as no rules", async () => {
    const out = await mergeHeaders({ headers: async () => undefined })();
    expect(out).toHaveLength(3);
  });

  it("includes the credentialed-prerender header at /:path*, promoted from marketing-only", async () => {
    const out = await mergeHeaders({})();
    expect(out).toContainEqual({ source: "/:path*", headers: PRERENDER_HEADERS });
  });
});
