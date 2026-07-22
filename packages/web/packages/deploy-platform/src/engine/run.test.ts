import { describe, expect, it, vi } from "vitest";
import { type EndpointLite, type ProjectLite } from "./plan.js";
import { runAutoConfigure, type StatusAddApi } from "./run.js";

const proj = (projectName: string, domain: string | null, platform = "vercel"): ProjectLite => ({ platform, projectName, domain });

/** A StatusAddApi with vi.fn defaults (no-op writes, empty fleet); override per test. */
function makeApi(over: Partial<StatusAddApi> = {}): StatusAddApi {
  return {
    listAllEndpoints: vi.fn(async () => [] as EndpointLite[]),
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
