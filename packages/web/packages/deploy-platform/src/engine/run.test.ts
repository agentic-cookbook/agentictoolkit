import { describe, expect, it, vi } from "vitest";
import { type EndpointLite, type ProjectLite } from "./plan.js";
import { runAutoConfigure, type SiteLite, type StatusAddApi } from "./run.js";

const proj = (projectName: string, domain: string | null, platform = "vercel"): ProjectLite => ({ platform, projectName, domain });

/** A StatusAddApi with vi.fn defaults (no-op writes, empty fleet); override per test. */
function makeApi(over: Partial<StatusAddApi> = {}): StatusAddApi {
  return {
    listAllEndpoints: vi.fn(async () => [] as EndpointLite[]),
    listSites: vi.fn(async () => [] as SiteLite[]),
    updateEndpoint: vi.fn(async () => ({})),
    createSite: vi.fn(async () => ({ id: "site-1" })),
    createEndpoint: vi.fn(async () => {
      throw new Error("createEndpoint unstubbed");
    }),
    deleteSite: vi.fn(async () => {}),
    ...over,
  };
}

describe("runAutoConfigure — new-site rollback", () => {
  it("rolls the just-created site back and rethrows when createEndpoint rejects", async () => {
    // proj with a domain nobody monitors → new-site plan; create opts arm the create path.
    const api = makeApi({
      createEndpoint: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const res = await runAutoConfigure([proj("alpha", "app.example.com")], { api, create: { groupId: "g1" } });

    expect(api.deleteSite).toHaveBeenCalledWith("site-1"); // best-effort rollback of the orphan site
    expect(res.created).toHaveLength(0); // NOT created — the throw propagated
    // The ORIGINAL createEndpoint error surfaces as the skip reason (proves the rethrow).
    expect(res.skipped.map((s) => s.reason)).toEqual(["boom"]);
  });

  it("still rethrows the original error when deleteSite itself rejects", async () => {
    const api = makeApi({
      createEndpoint: vi.fn(async () => {
        throw new Error("boom");
      }),
      deleteSite: vi.fn(async () => {
        throw new Error("delete failed");
      }),
    });

    const res = await runAutoConfigure([proj("alpha", "app.example.com")], { api, create: { groupId: "g1" } });

    expect(api.deleteSite).toHaveBeenCalledWith("site-1");
    // deleteSite's rejection is swallowed; the ORIGINAL create error is what surfaces.
    expect(res.skipped.map((s) => s.reason)).toEqual(["boom"]);
  });
});

describe("runAutoConfigure — a derived slug can never strand a project", () => {
  it("disambiguates a new site whose derived slug is already taken in the target group", async () => {
    // A Railway site already holds slug "shared" in g1. The Vercel project derives the SAME
    // base name — `(group, slug)` is UNIQUE, so creating it verbatim 409s, the project is
    // skipped, and it is skipped again on EVERY future run (nothing about it ever changes).
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://shared.com", kind: "http", environment: "production", platform: "vercel", deployProject: "shared-production" };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-old", slug: "shared", groupId: "g1" }]),
      createEndpoint: vi.fn(async () => created),
    });

    const res = await runAutoConfigure([proj("shared-production", "shared.com")], { api, create: { groupId: "g1" } });

    expect(res.created).toHaveLength(1);
    expect(res.skipped).toHaveLength(0);
    // Disambiguated by the thing that actually differs — the host.
    expect(api.createSite).toHaveBeenCalledWith({ name: "shared.com", slug: "shared-com", groupId: "g1" });
  });

  it("does not let two projects in ONE run claim the same slug", async () => {
    // Both derive base "dup" but their hosts share no apex, so neither matches the other's
    // site. Without tracking the slug claimed mid-run, the second create 409s.
    let n = 0;
    const api = makeApi({
      createSite: vi.fn(async () => ({ id: `site-${++n}` })),
      createEndpoint: vi.fn(async (siteId: string, body: Record<string, unknown>) => ({
        id: `srv-${n}`,
        siteId,
        url: String(body.url),
        kind: "http",
        environment: null,
        platform: "vercel",
        deployProject: null, // unwired, so it can't sibling-match the next project
      })),
    });

    const res = await runAutoConfigure([proj("dup", "one.example.com"), proj("dup", "two.other.com")], { api, create: { groupId: "g1" } });

    expect(res.created).toHaveLength(2);
    const slugs = (api.createSite as unknown as { mock: { calls: [{ slug: string }][] } }).mock.calls.map((c) => c[0].slug);
    expect(new Set(slugs).size).toBe(2);
  });
});

describe("runAutoConfigure — new sites join their domain family's group", () => {
  it("files a new site with the group that already owns its registrable domain", async () => {
    // `lewis.agenticdeveloperhub.com` is a new site (no existing endpoint owns that host),
    // but the family already lives in g-adh — putting it in the fallback group would sit it
    // next to unrelated products while its siblings live elsewhere.
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://lewis.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "railway", deployProject: "adh-status" };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production" },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    await runAutoConfigure([proj("adh-status", "lewis.agenticdeveloperhub.com", "railway")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-adh" }));
  });

  it("falls back to the chosen group when the family is unknown, split, or provider-issued", async () => {
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://brandnew.example.org", kind: "http", environment: "production", platform: "vercel", deployProject: "brandnew" };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production" },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    await runAutoConfigure([proj("brandnew", "brandnew.example.org")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-other" }));
  });
});

describe("runAutoConfigure — real-id intra-run chaining", () => {
  it("wires a later project against the created endpoint's REAL server id, not a synthesized one", async () => {
    // The server assigns "srv-1" — a value present nowhere in the first project's plan
    // (its site id is "site-1", its name/slug/url derive from "alpha"/"app.example.com").
    const created: EndpointLite = {
      id: "srv-1",
      siteId: "site-1",
      url: "https://app.example.com",
      kind: "frontend", // wireable, so a later exact-host project wires (not conflicts against) it
      environment: "production",
      platform: "vercel",
      deployProject: "alpha",
    };
    const api = makeApi({ createEndpoint: vi.fn(async () => created) });

    // Two entries for the same project/domain: the first (empty fleet) → new-site, creating
    // "srv-1"; the second now sees "srv-1" in the working snapshot and hits planAddProject's
    // exact-host wire path against it (same deployProject → wire, not conflict).
    const res = await runAutoConfigure([proj("alpha", "app.example.com"), proj("alpha", "app.example.com")], {
      api,
      create: { groupId: "g1" },
    });

    expect(api.createEndpoint).toHaveBeenCalledTimes(1); // only the first created; the second wired
    expect(api.updateEndpoint).toHaveBeenCalledWith("srv-1", expect.objectContaining({ platform: "vercel", deployProject: "alpha" }));
    expect(res.created).toHaveLength(1); // the new-site project
    expect(res.added).toHaveLength(1); // the wired project
  });
});
