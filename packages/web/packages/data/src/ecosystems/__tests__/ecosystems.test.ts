import { describe, expect, it, vi, beforeEach } from "vitest";

// Stub only the transport, so the body this client actually puts on the wire is
// what gets asserted (the create contract lives in that body, not in the mappers).
vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
}));

import { ecosystemsApi, toEcosystem } from "../ecosystems";
import { authedJson } from "../../http";

const mockedJson = vi.mocked(authedJson);

beforeEach(() => {
  mockedJson.mockReset();
});

/** A minimal server row, so `create`'s mapper has something to return. */
function row(id: string, slug: string) {
  return {
    id,
    name: "N",
    description: null,
    region: null,
    primaryDomain: null,
    createdAt: "c",
    updatedAt: "u",
    isDefault: false,
    slug,
  };
}

/** The last request the client put on the wire — throws rather than silently
 *  asserting nothing if `create` never called the transport at all. */
function lastCall(): [string, RequestInit] {
  const call = mockedJson.mock.calls.at(-1);
  if (!call) throw new Error("authedJson was never called");
  return [call[0], (call[1] ?? {}) as RequestInit];
}

function sentUrl(): string {
  return lastCall()[0];
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(String(lastCall()[1].body));
}

const draft = { identifier: "", name: "N", description: "", region: "", domain: "" };

describe("toEcosystem", () => {
  it("maps the rdid id to both id+identifier and primaryDomain→domain", () => {
    const e = toEcosystem({
      id: "com.acme",
      name: "Acme",
      description: "desc",
      region: "us-east",
      primaryDomain: "acme.com",
      createdAt: "c",
      updatedAt: "u",
      isDefault: false,
      slug: "acme",
    });
    expect(e.id).toBe("com.acme");
    expect(e.identifier).toBe("com.acme");
    expect(e.domain).toBe("acme.com");
  });
  it("defaults nullable text columns to empty strings", () => {
    const e = toEcosystem({
      id: "x",
      name: "X",
      description: null,
      region: null,
      primaryDomain: null,
      createdAt: "c",
      updatedAt: "u",
      isDefault: false,
      slug: "x",
    });
    expect(e.description).toBe("");
    expect(e.region).toBe("");
    expect(e.domain).toBe("");
  });
});

describe("ecosystemsApi.create", () => {
  // The server DERIVES the address from (parent chain, slug) and treats a supplied
  // `id` as an assertion whose LAST SEGMENT must equal `slug`. Sending the whole
  // dotted rdid as the slug therefore 400s every create — `id "ecosystem.fishlamp.adh"
  // does not match slug "ecosystem.fishlamp.adh"` — which is the bug these pin.
  it("sends the rdid's LAST SEGMENT as the slug, not the whole identifier", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh", "adh"));
    await ecosystemsApi.create({ ...draft, identifier: "ecosystem.fishlamp.adh" });
    expect(sentBody().id).toBe("ecosystem.fishlamp.adh");
    expect(sentBody().slug).toBe("adh");
  });

  it("sends the leaf for a two-segment identifier too", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.adh", "adh"));
    await ecosystemsApi.create({ ...draft, identifier: "ecosystem.adh" });
    expect(sentBody().slug).toBe("adh");
  });

  it("passes a non-rdid identifier through untouched, so the SERVER names the problem", async () => {
    mockedJson.mockResolvedValueOnce(row("nope", "nope"));
    await ecosystemsApi.create({ ...draft, identifier: "nope" });
    expect(sentBody().id).toBe("nope");
    expect(sentBody().slug).toBe("nope");
  });

  it("takes the same slug on the child-create (?parent=) path", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh.sub", "sub"));
    await ecosystemsApi.create(
      { ...draft, identifier: "ecosystem.fishlamp.adh.sub" },
      { parent: "ecosystem.fishlamp.adh" },
    );
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems?parent=ecosystem.fishlamp.adh");
    expect(sentBody().slug).toBe("sub");
  });

  it("scopes to a workspace with ?workspace=", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh", "adh"));
    await ecosystemsApi.create(
      { ...draft, identifier: "ecosystem.fishlamp.adh" },
      { workspace: "fishlamp" },
    );
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems?workspace=fishlamp");
  });
});

describe("ecosystemsApi.update", () => {
  // A rename is a SLUG change: the address derives from (parent chain, slug), so the stored slug
  // is the only thing that moves it, and this route cascades the new address onto the handle and
  // every descendant. Renaming the HANDLE instead (a registry.identifiers PATCH, what this client
  // used to do) is the non-structural rename — the slug column stays behind, the row goes on
  // deriving its old address, and the next ancestor cascade re-leafs the handle back.
  it("sends the new LEAF as `slug`, in the one PUT", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh2", "adh2"));
    await ecosystemsApi.update("ecosystem.fishlamp.adh", {
      identifier: "ecosystem.fishlamp.adh2",
      name: "N",
    });
    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems/ecosystem.fishlamp.adh");
    expect(sentBody().slug).toBe("adh2");
    expect(sentBody().name).toBe("N");
  });

  it("omits `slug` entirely when the identifier did not change", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh", "adh"));
    await ecosystemsApi.update("ecosystem.fishlamp.adh", {
      identifier: "ecosystem.fishlamp.adh",
      name: "N",
    });
    expect(sentBody()).not.toHaveProperty("slug");
  });

  it("omits `slug` when the caller edits fields without touching the identifier", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh", "adh"));
    await ecosystemsApi.update("ecosystem.fishlamp.adh", { name: "Renamed" });
    expect(sentBody()).not.toHaveProperty("slug");
    expect(sentBody().name).toBe("Renamed");
  });

  it("passes a non-rdid identifier through as the slug, so the SERVER names the problem", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh", "adh"));
    await ecosystemsApi.update("ecosystem.fishlamp.adh", { identifier: "not an rdid" });
    expect(sentBody().slug).toBe("not an rdid");
  });

  it("returns the address the SERVER derived, never the identifier the caller typed", async () => {
    mockedJson.mockResolvedValueOnce(row("ecosystem.fishlamp.adh2", "adh2"));
    const saved = await ecosystemsApi.update("ecosystem.fishlamp.adh", {
      identifier: "ecosystem.WRONG.adh2",
    });
    expect(saved.id).toBe("ecosystem.fishlamp.adh2");
    expect(saved.identifier).toBe("ecosystem.fishlamp.adh2");
  });
});

describe("ecosystemsApi.workspaceDefaultEcosystemId", () => {
  // WHOSE infrastructure row gets resolved is the whole question: with a slug it is the
  // WORKSPACE principal's, without one the CALLER's. The two calls mirror the two create
  // scopes exactly, which is what keeps a previewed address equal to the minted one.
  it("scopes to the workspace principal when given a slug", async () => {
    mockedJson.mockResolvedValueOnce([row("ecosystem.fishlamp", "fishlamp")]);
    const own = await ecosystemsApi.workspaceDefaultEcosystemId("fishlamp");
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems?workspace=fishlamp&infrastructure=true");
    expect(own).toEqual({ id: "ecosystem.fishlamp", canManage: true });
  });

  // The bare `infrastructure=true` form. It used to be silently INERT server-side — the flag
  // was read only inside the workspace branch — so a slug-less mount got back every manageable
  // ecosystem and could never resolve the parent its create hangs under.
  it("resolves the CALLER's own row when there is no slug", async () => {
    mockedJson.mockResolvedValueOnce([row("ecosystem.realm.mike", "mike")]);
    const own = await ecosystemsApi.workspaceDefaultEcosystemId();
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems?infrastructure=true");
    expect(own?.id).toBe("ecosystem.realm.mike");
  });

  // null, never undefined: react-query rejects undefined as query data.
  it("returns null when the principal has no infrastructure row", async () => {
    mockedJson.mockResolvedValueOnce([]);
    expect(await ecosystemsApi.workspaceDefaultEcosystemId("fishlamp")).toBeNull();
  });

  it("carries the server's canManage=false through", async () => {
    mockedJson.mockResolvedValueOnce([{ ...row("ecosystem.fishlamp", "fishlamp"), canManage: false }]);
    expect(await ecosystemsApi.workspaceDefaultEcosystemId("fishlamp")).toEqual({
      id: "ecosystem.fishlamp",
      canManage: false,
    });
  });
});

describe("ecosystemsApi.ecosystemIdForSlug", () => {
  /** A status-carrying HTTP error, the shape `isNotFound` duck-types on. */
  const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

  // Ownership first. A client-side `slug ===` scan is no longer unambiguous: slugs are unique
  // only WITHIN a parent, so once products hang under their owner, any product named <slug>
  // under any OTHER workspace matches just as well and list order decides the tenant.
  it("asks the server for the workspace's own row before scanning anything", async () => {
    mockedJson.mockResolvedValueOnce([row("ecosystem.fishlamp", "fishlamp")]);
    expect(await ecosystemsApi.ecosystemIdForSlug("fishlamp")).toBe("ecosystem.fishlamp");
    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(sentUrl()).toBe("/api/ecosystem/ecosystems?workspace=fishlamp&infrastructure=true");
  });

  // A 404 is "this slug names no workspace" — the one verdict that licenses the scan.
  it("falls back to the raw list when the slug names no workspace", async () => {
    mockedJson.mockRejectedValueOnce(httpError(404));
    mockedJson.mockResolvedValueOnce([row("ecosystem.other", "other"), row("ecosystem.zed", "zed")]);
    expect(await ecosystemsApi.ecosystemIdForSlug("zed")).toBe("ecosystem.zed");
  });

  // The resolver's own empty answer (a workspace with no infrastructure row) is not an error,
  // so it reaches the same fallback without a throw.
  it("falls back when the workspace resolves to no infrastructure row", async () => {
    mockedJson.mockResolvedValueOnce([]);
    mockedJson.mockResolvedValueOnce([{ ...row("ecosystem.d", "d"), isDefault: true }]);
    expect(await ecosystemsApi.ecosystemIdForSlug("fishlamp")).toBe("ecosystem.d");
  });

  // Anything OTHER than a 404 is a real failure. Papering over a 403/500 with an arbitrary row
  // is how a member of one org silently lands on another tenant's ecosystem.
  it("rethrows a non-404 instead of picking a row", async () => {
    mockedJson.mockRejectedValueOnce(httpError(403));
    await expect(ecosystemsApi.ecosystemIdForSlug("fishlamp")).rejects.toThrow("HTTP 403");
    expect(mockedJson).toHaveBeenCalledTimes(1);
  });

  it("returns null when nothing resolves at all", async () => {
    mockedJson.mockRejectedValueOnce(httpError(404));
    mockedJson.mockResolvedValueOnce([]);
    expect(await ecosystemsApi.ecosystemIdForSlug("nope")).toBeNull();
  });
});
