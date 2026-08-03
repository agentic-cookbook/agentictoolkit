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
