import { describe, expect, it, vi } from "vitest";
import { indexLiveProjects, type EndpointLite, type ProjectLite } from "./plan.js";
import {
  indexEndpointWiring,
  runAutoConfigure,
  summarizeAutoConfigure,
  uniqueSiteIdentity,
  wireMatchingEndpoints,
  type SiteLite,
  type StatusAddApi,
  type WireableProject,
} from "./run.js";

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
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://shared.com", kind: "http", environment: "production", platform: "vercel", deployProject: "shared-production", ignoreProjectWarning: false };
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
        ignoreProjectWarning: false,
      })),
    });

    const res = await runAutoConfigure([proj("dup", "one.example.com"), proj("dup", "two.other.com")], { api, create: { groupId: "g1" } });

    expect(res.created).toHaveLength(2);
    const slugs = (api.createSite as unknown as { mock: { calls: [{ slug: string }][] } }).mock.calls.map((c) => c[0].slug);
    expect(new Set(slugs).size).toBe(2);
  });

  it("never numbers an EMPTY base slug into a nonsense identity", () => {
    // A project named entirely in punctuation slugifies to "", and the placeholder-URL path
    // passes no host — so there is nothing to disambiguate WITH. Numbering it anyway would
    // create a site literally named " (2)" with slug "-2" and record that slug as taken.
    expect(uniqueSiteIdentity({ name: "***", slug: "" }, "", "g1", new Set())).toEqual({ name: "***", slug: "" });
  });
});

describe("runAutoConfigure — new sites join their domain family's group", () => {
  it("files a new site with the group that already owns its registrable domain", async () => {
    // `lewis.agenticdeveloperhub.com` is a new site (no existing endpoint owns that host),
    // but the family already lives in g-adh — putting it in the fallback group would sit it
    // next to unrelated products while its siblings live elsewhere.
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://lewis.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "railway", deployProject: "adh-status", ignoreProjectWarning: false };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    await runAutoConfigure([proj("adh-status", "lewis.agenticdeveloperhub.com", "railway")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-adh" }));
  });

  it("falls back to the chosen group when the family is unknown, split, or provider-issued", async () => {
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://brandnew.example.org", kind: "http", environment: "production", platform: "vercel", deployProject: "brandnew", ignoreProjectWarning: false };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    await runAutoConfigure([proj("brandnew", "brandnew.example.org")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-other" }));
  });

  it("REPORTS the redirect — a site filed elsewhere than the chosen group comes back as a note", async () => {
    // Overriding the operator's pick silently reads as "it went where you said". It didn't.
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://lewis.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "railway", deployProject: "adh-status", ignoreProjectWarning: false };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    const res = await runAutoConfigure([proj("adh-status", "lewis.agenticdeveloperhub.com", "railway")], { api, create: { groupId: "g-other" } });

    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]!.note).toContain("agenticdeveloperhub.com");
  });

  it("says nothing when the site landed in the group the operator actually chose", async () => {
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://brandnew.example.org", kind: "http", environment: "production", platform: "vercel", deployProject: "brandnew", ignoreProjectWarning: false };
    const api = makeApi({ createEndpoint: vi.fn(async () => created) });

    const res = await runAutoConfigure([proj("brandnew", "brandnew.example.org")], { api, create: { groupId: "g-other" } });

    expect(res.created).toHaveLength(1);
    expect(res.notes).toHaveLength(0);
  });

  it("forceGroup makes the operator's pick AUTHORITATIVE — the domain-family rule is not consulted", async () => {
    // A board grouped by ENVIRONMENT, not product: the family rule would file a production
    // site under Testing because a testing endpoint happens to share its domain family.
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://lewis.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "railway", deployProject: "adh-status", ignoreProjectWarning: false };
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    const res = await runAutoConfigure([proj("adh-status", "lewis.agenticdeveloperhub.com", "railway")], { api, create: { groupId: "g-other", forceGroup: true } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-other" }));
    expect(res.notes).toHaveLength(0); // nothing was overridden, so there is nothing to report
  });

  it("a family SPLIT across two groups is ambiguous → the chosen group wins", async () => {
    // Two groups already hold sites in `agenticdeveloperhub.com`. Picking either half would
    // be a guess; the operator's selection is the only non-guess available.
    const created: EndpointLite = { id: "srv-1", siteId: "site-1", url: "https://lewis.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "railway", deployProject: "adh-status", ignoreProjectWarning: false };
    const api = makeApi({
      listSites: vi.fn(async () => [
        { id: "s-hub", slug: "hub", groupId: "g-adh" },
        { id: "s-two", slug: "two", groupId: "g-split" },
      ]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
        { id: "e2", siteId: "s-two", url: "https://two.agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "two", ignoreProjectWarning: false },
      ]),
      createEndpoint: vi.fn(async () => created),
    });

    const res = await runAutoConfigure([proj("adh-status", "lewis.agenticdeveloperhub.com", "railway")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-other" }));
    expect(res.notes).toHaveLength(0);
  });

  it("a rolled-back create leaves the family index intact for the next project", async () => {
    // A failed create must not disturb the family's ownership — the next project in the
    // batch still belongs with the group that already owns the family.
    const api = makeApi({
      listSites: vi.fn(async () => [{ id: "s-hub", slug: "hub", groupId: "g-adh" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s-hub", url: "https://agenticdeveloperhub.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "hub-production", ignoreProjectWarning: false },
      ]),
      createSite: vi.fn(async () => ({ id: "site-1" })),
      createEndpoint: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue({ id: "srv-2", siteId: "site-1", url: "https://two.agenticdeveloperhub.com", kind: "http", environment: "production", platform: "vercel", deployProject: "two", ignoreProjectWarning: false }),
    });

    // First create fails and rolls back; the second must still see g-adh owning the family.
    await runAutoConfigure([proj("one", "one.agenticdeveloperhub.com"), proj("two", "two.agenticdeveloperhub.com")], { api, create: { groupId: "g-other" } });

    expect(api.createSite).toHaveBeenNthCalledWith(2, expect.objectContaining({ groupId: "g-adh" }));
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
      ignoreProjectWarning: false,
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

describe("runAutoConfigure — a renamed deploy project", () => {
  /** One endpoint monitoring `mikefullerton.com`, still wired to the project's OLD name. */
  const api = () =>
    makeApi({
      listSites: vi.fn(async () => [{ id: "s1", slug: "mike", groupId: "g1" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s1", url: "https://mikefullerton.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "mikefullerton-com", ignoreProjectWarning: false },
      ]),
    });

  it("takes the monitor over and REPORTS what it replaced", async () => {
    // Without this the project is offered on every run and refused on every run — the
    // "N projects not monitored" banner becomes permanent, with no action that clears it.
    const a = api();
    const live = indexLiveProjects([{ platform: "vercel", projectName: "mikefullerton-production" }], ["vercel"]);

    const res = await runAutoConfigure([proj("mikefullerton-production", "mikefullerton.com")], { api: a, liveProjects: live });

    expect(a.updateEndpoint).toHaveBeenCalledWith("e1", expect.objectContaining({ deployProject: "mikefullerton-production" }));
    expect(res.added).toHaveLength(1);
    expect(res.skipped).toHaveLength(0);
    expect(res.notes[0]!.note).toContain("mikefullerton-com"); // the name it took over from
  });

  it("names the platform the RETIRED project was on, not the one taking over", async () => {
    // A migration re-points a VERCEL monitor onto a RAILWAY project. Reporting "which
    // railway no longer has" would be a false statement about a name railway never had —
    // and the note is the only place the operator learns their wiring was rewritten.
    const a = makeApi({
      listSites: vi.fn(async () => [{ id: "s1", slug: "lewis", groupId: "g1" }]),
      listAllEndpoints: vi.fn(async () => [
        { id: "e1", siteId: "s1", url: "https://lewis.example.com", kind: "frontend", environment: "production", platform: "vercel", deployProject: "adh-status-monitoring-site", ignoreProjectWarning: false },
      ]),
    });
    const live = indexLiveProjects([{ platform: "railway", projectName: "adh-status" }], ["vercel", "railway"]);

    const res = await runAutoConfigure([{ platform: "railway", projectName: "adh-status", domain: "lewis.example.com" }], { api: a, liveProjects: live });

    expect(res.added).toHaveLength(1);
    expect(res.notes[0]!.note).toBe("took over the monitor wired to adh-status-monitoring-site, which vercel no longer has");
  });

  it("leaves it alone when the old name is still a live project", async () => {
    const a = api();
    const live = indexLiveProjects(
      [
        { platform: "vercel", projectName: "mikefullerton-production" },
        { platform: "vercel", projectName: "mikefullerton-com" },
      ],
      ["vercel"],
    );

    const res = await runAutoConfigure([proj("mikefullerton-production", "mikefullerton.com")], { api: a, liveProjects: live });

    expect(a.updateEndpoint).not.toHaveBeenCalled();
    expect(res.skipped[0]!.reason).toContain("already wired to mikefullerton-com");
  });
});

// ---------------------------------------------------------------------------
// A mutable in-memory fleet, for the cases whose POINT is what the store looks like
// afterwards (nothing created; a later item still processed). The vi.fn `makeApi` above
// asserts on CALLS; these assert on STATE.
// ---------------------------------------------------------------------------
function makeStore(initial: EndpointLite[] = []): { api: StatusAddApi; endpoints: EndpointLite[]; sites: SiteLite[] } {
  const endpoints = [...initial];
  const sites: SiteLite[] = [];
  let n = 0;
  const api: StatusAddApi = {
    listAllEndpoints: async () => endpoints,
    listSites: async () => sites,
    updateEndpoint: async (id, b) => {
      const e = endpoints.find((x) => x.id === id);
      if (!e) throw new Error(`no endpoint ${id}`);
      Object.assign(e, b);
      return e;
    },
    createSite: async (body) => {
      n += 1;
      const site = { id: `s${n}`, slug: body.slug, groupId: body.groupId };
      sites.push(site);
      return { id: site.id };
    },
    createEndpoint: async (siteId, body) => {
      n += 1;
      const e = { id: `e${n}`, siteId, kind: "frontend", ...body } as EndpointLite;
      endpoints.push(e);
      return e;
    },
    deleteSite: async (id) => {
      const i = sites.findIndex((s) => s.id === id);
      if (i >= 0) sites.splice(i, 1);
    },
  };
  return { api, endpoints, sites };
}

describe("runAutoConfigure — match-only (no `create`)", () => {
  it("does NOT create a site/endpoint for a project no site monitors — it's left for the operator", async () => {
    // The per-platform "Match" buttons omit `create` for exactly this reason: a browser
    // can't answer which group a new site belongs to, and a phantom site is worse than a
    // leftover. Asserting the STORE, not just the result, is what pins it.
    const { api, endpoints, sites } = makeStore();

    const res = await runAutoConfigure([proj("help-production", "agenticdeveloperhelp.com")], { api });

    expect(res.added).toHaveLength(0);
    expect(res.created).toHaveLength(0);
    expect(endpoints).toHaveLength(0);
    expect(sites).toHaveLength(0);
    expect(res.skipped[0]!.reason).toContain("no site monitors this domain");
  });

  it("reports progress once per project", async () => {
    const { api } = makeStore();
    const seen: [number, number][] = [];

    await runAutoConfigure([proj("a-production", "a.com"), proj("b-production", "b.com")], {
      api,
      onProgress: (done, total) => seen.push([done, total]),
    });

    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("keeps going after one match errors and records the failure", async () => {
    // The batch is SEQUENTIAL, so an unhandled throw would abandon every project after the
    // failing one — silently, since the run still resolves.
    const { api } = makeStore([
      { id: "e1", siteId: "s1", url: "https://a.com", kind: "frontend", environment: null, platform: null, deployProject: null, ignoreProjectWarning: false },
      { id: "e2", siteId: "s2", url: "https://b.com", kind: "frontend", environment: null, platform: null, deployProject: null, ignoreProjectWarning: false },
    ]);
    const orig = api.updateEndpoint;
    let n = 0;
    api.updateEndpoint = async (id, b) => {
      n += 1;
      if (n === 1) throw new Error("boom");
      return orig(id, b);
    };

    const res = await runAutoConfigure([proj("a-production", "a.com"), proj("b-production", "b.com")], { api });

    expect(res.added).toHaveLength(1); // the SECOND project still ran
    expect(res.skipped.map((s) => s.reason)).toEqual(["boom"]);
  });
});

describe("wireMatchingEndpoints — endpoint-axis wiring by full domain list", () => {
  const wp = (projectName: string, domains: string[], platform = "vercel"): WireableProject => ({ platform, projectName, domains });
  const ep = (o: Partial<EndpointLite> & { id: string; url: string }): EndpointLite => ({
    siteId: "s1",
    kind: "frontend",
    environment: null,
    platform: null,
    deployProject: null,
    ignoreProjectWarning: false,
    ...o,
  });

  it("wires the apex endpoint to the project whose CANONICAL domain is a subdomain of it", async () => {
    // The project is ALREADY monitored via its canonical host; the apex (a redirect, also
    // one of its domains) is what the project axis can never reach — it matches on the
    // canonical domain alone, so the apex endpoint stays unconfigured forever.
    const { api, endpoints } = makeStore([
      ep({ id: "e-apex", url: "https://olylo.ai", environment: "production" }),
      ep({ id: "e-ia", siteId: "s2", url: "https://ia.olylo.ai", environment: "production", platform: "vercel", deployProject: "olylo.ai-production" }),
    ]);

    const res = await wireMatchingEndpoints([wp("olylo.ai-production", ["olylo.ai", "www.olylo.ai", "ia.olylo.ai"])], { api });

    expect(res.wired).toBe(1);
    expect(res.skipped).toEqual([]);
    const apex = endpoints.find((e) => e.id === "e-apex")!;
    expect(apex.platform).toBe("vercel");
    expect(apex.deployProject).toBe("olylo.ai-production");
    // The already-wired canonical endpoint is untouched.
    expect(endpoints.find((e) => e.id === "e-ia")!.deployProject).toBe("olylo.ai-production");
  });

  it("leaves an endpoint alone when its host matches no project domain", async () => {
    const { api } = makeStore([ep({ id: "e1", url: "https://unknown.example" })]);
    expect((await wireMatchingEndpoints([wp("p", ["other.com"])], { api })).wired).toBe(0);
  });

  it("respects the operator opt-out (does not wire an ignored endpoint)", async () => {
    const { api } = makeStore([ep({ id: "e1", url: "https://olylo.ai", ignoreProjectWarning: true })]);
    expect((await wireMatchingEndpoints([wp("olylo.ai-production", ["olylo.ai"])], { api })).wired).toBe(0);
  });

  it("indexEndpointWiring: a host claimed by two different projects is ambiguous (null)", () => {
    expect(indexEndpointWiring([wp("p1", ["shared.com"]), wp("p2", ["shared.com"])]).get("shared.com")).toBeNull();
  });

  it("indexEndpointWiring: platform is canonicalized (cloudflare-pages → cloudflare)", () => {
    expect(indexEndpointWiring([wp("worker", ["w.example"], "cloudflare-pages")]).get("w.example")).toEqual({
      platform: "cloudflare",
      deployProject: "worker",
    });
  });
});

describe("summarizeAutoConfigure", () => {
  it("matched many, some have no site yet", () => {
    const msg = summarizeAutoConfigure({ added: 100, wired: 0, noDomain: 21, skipped: 0 });
    expect(msg).toContain("Matched 100 projects to their sites");
    expect(msg).toContain("21 projects have no site yet");
    expect(msg).not.toContain("Nothing");
  });

  it("everything matched (plural)", () => {
    expect(summarizeAutoConfigure({ added: 5, wired: 0, noDomain: 0, skipped: 0 })).toBe("Matched 5 projects to their sites.");
  });

  it("singular uses 'its site'", () => {
    expect(summarizeAutoConfigure({ added: 1, wired: 0, noDomain: 0, skipped: 0 })).toBe("Matched 1 project to its site.");
  });

  it("reports wired sites (endpoint axis) alongside matched projects", () => {
    expect(summarizeAutoConfigure({ added: 2, wired: 3, noDomain: 0, skipped: 0 })).toBe("Matched 2 projects to their sites, wired 3 sites.");
  });

  it("reports created sites alongside matched + wired", () => {
    expect(summarizeAutoConfigure({ added: 2, created: 3, wired: 1, noDomain: 0, skipped: 0 })).toBe(
      "Matched 2 projects to their sites, created 3 sites, wired 1 site.",
    );
  });

  it("created only (singular)", () => {
    expect(summarizeAutoConfigure({ added: 0, created: 1, wired: 0, noDomain: 0, skipped: 0 })).toBe("Created 1 site.");
  });

  it("reports ONLY wired sites when no projects were matched", () => {
    expect(summarizeAutoConfigure({ added: 0, wired: 1, noDomain: 0, skipped: 0 })).toBe("Wired 1 site.");
  });

  it("nothing to do because every site is already wired", () => {
    expect(summarizeAutoConfigure({ added: 0, wired: 0, noDomain: 0, skipped: 0 })).toBe(
      "Nothing to match — every monitored site is already wired to its deploy project.",
    );
  });

  it("no matches but projects remain (no domain + conflict)", () => {
    const msg = summarizeAutoConfigure({ added: 0, wired: 0, noDomain: 3, skipped: 1 });
    expect(msg).toContain("No new matches");
    expect(msg).toContain("4 projects have no site yet");
    expect(msg).toContain("3 with no domain");
    expect(msg).toContain("1 unmatched");
  });

  it("matched some, some remain — the count matches the banner's residual", () => {
    const msg = summarizeAutoConfigure({ added: 116, wired: 0, noDomain: 5, skipped: 0 });
    expect(msg).toContain("Matched 116 projects to their sites");
    expect(msg).toContain("5 projects have no site yet");
  });

  it("singular verb for a single leftover", () => {
    expect(summarizeAutoConfigure({ added: 3, wired: 0, noDomain: 1, skipped: 0 })).toBe(
      "Matched 3 projects to their sites; 1 project has no site yet (1 with no domain).",
    );
  });
});
