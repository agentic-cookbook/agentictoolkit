import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchProjectDomains } from "./vercel.js";

// `live` is the whole point of this function's shape. Every failure mode — a 403 from a
// token without project scope, a 5xx, a timeout — produces an EMPTY domain list, which is
// byte-identical to the answer for a project that genuinely serves no custom domain. A
// caller that DELETES a monitor for being unclaimed cannot tell those apart from the list,
// so it has to be told, and these pin that it always is.
//
// Every test uses its OWN project name: the domain list is memoized for an hour at module
// scope, so a shared name would let one test inherit another's answer.

let fetchMock: ReturnType<typeof vi.fn>;

const domainsResponse = (domains: { name: string; verified?: boolean }[]): Response =>
  new Response(JSON.stringify({ domains }), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock = vi.fn(async () => domainsResponse([{ name: "example.com", verified: true }]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchProjectDomains provenance", () => {
  it("reports live:false — not an empty answer — when the token can't read the project", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    expect(await fetchProjectDomains("tok", undefined, "p-403")).toEqual({ domains: [], live: false });
  });

  it("reports live:false when the request throws (timeout, DNS, socket)", async () => {
    fetchMock.mockRejectedValue(new Error("The operation was aborted"));

    expect(await fetchProjectDomains("tok", undefined, "p-throw")).toEqual({ domains: [], live: false });
  });

  it("reports live:true with an EMPTY list for a project that really serves no custom domain", async () => {
    // The answer that must stay distinguishable from both cases above: the read succeeded,
    // and nothing is served. Only THIS licenses a caller to act on the absence.
    fetchMock.mockResolvedValue(domainsResponse([{ name: "p-none.vercel.app", verified: true }]));

    expect(await fetchProjectDomains("tok", undefined, "p-none")).toEqual({ domains: [], live: true });
  });

  it("returns the verified custom domains, dropping unverified names and *.vercel.app", async () => {
    fetchMock.mockResolvedValue(
      domainsResponse([
        { name: "olylo.ai", verified: true },
        { name: "www.olylo.ai", verified: true },
        { name: "p-ok.vercel.app", verified: true },
        { name: "not-yet.olylo.ai", verified: false },
      ]),
    );

    expect(await fetchProjectDomains("tok", undefined, "p-ok")).toEqual({
      domains: ["olylo.ai", "www.olylo.ai"],
      live: true,
    });
  });

  it("serves a repeat read from the hour-long cache without another API call", async () => {
    // The enumeration re-runs on every snapshot build (≥ every 30s with viewers), once per
    // project — this cache is what keeps that from being hundreds of Vercel calls a minute.
    const first = await fetchProjectDomains("tok", undefined, "p-cached");
    const second = await fetchProjectDomains("tok", undefined, "p-cached");

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("labels a stale cached list live:false when the refresh after expiry fails", async () => {
    // The subtle one: the domains are RIGHT (they just came from a good read an hour ago),
    // so returning them is better than returning nothing — but they are no longer
    // CONFIRMED, and a removal decision must see that. Provenance never upgrades itself by
    // falling back.
    const base = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(base);
    fetchMock.mockResolvedValue(domainsResponse([{ name: "stale.example.com", verified: true }]));
    expect(await fetchProjectDomains("tok", undefined, "p-stale")).toEqual({
      domains: ["stale.example.com"],
      live: true,
    });

    now.mockReturnValue(base + 2 * 60 * 60 * 1000); // an hour past the TTL
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    expect(await fetchProjectDomains("tok", undefined, "p-stale")).toEqual({
      domains: ["stale.example.com"],
      live: false,
    });
  });
});
