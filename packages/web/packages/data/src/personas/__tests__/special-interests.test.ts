import { describe, expect, it, vi, beforeEach } from "vitest";
import { specialInterestsApi } from "../special-interests";
import { interestDocumentsApi } from "../interest-documents";

// These clients exist to get two things right that are easy to get silently wrong: the interest
// list must be FILTERED to one persona (an unfiltered list returns every interest in the tenant),
// and the documents plane must name the acting persona (`asType`/`asId`) or the backend 400s.

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
    text: async () => "[]",
  });
  vi.stubGlobal("fetch", fetchMock);
});

const urlOf = () => String(fetchMock.mock.calls[0][0]);
const initOf = () => fetchMock.mock.calls[0][1] ?? {};

describe("specialInterestsApi", () => {
  it("filters the list by persona", async () => {
    await specialInterestsApi.list("persona.acme.bitbag");
    expect(urlOf()).toContain("/api/persona/special-interests");
    expect(urlOf()).toContain("personaId=persona.acme.bitbag");
  });

  it("posts the persona id in the create body", async () => {
    await specialInterestsApi.create({
      personaId: "persona.acme.bitbag",
      slug: "battlestar-galactica",
      general: "Science Fiction",
      topical: "Space Opera",
      specific: "Battlestar Galactica",
      stances: "The Cylons are a libel.",
    });
    expect(initOf().method).toBe("POST");
    expect(JSON.parse(String(initOf().body)).personaId).toBe("persona.acme.bitbag");
  });

  it("never sends personaId or bucketId on an update", async () => {
    await specialInterestsApi.update("i1", {
      stances: "Revised.",
      personaId: "persona.other",
      bucketId: "b1",
    } as never);
    const body = JSON.parse(String(initOf().body));
    // The backend rejects a personaId change with a 400 and strips bucketId; sending either is a
    // client bug that surfaces as a confusing error, so the client drops them here.
    expect(body).not.toHaveProperty("personaId");
    expect(body).not.toHaveProperty("bucketId");
    expect(body.stances).toBe("Revised.");
  });
});

describe("interestDocumentsApi", () => {
  it("names the acting persona on every call", async () => {
    await interestDocumentsApi.list("b1", "t1", "p-uuid");
    expect(urlOf()).toContain("/api/bucket/buckets/b1/types/t1/rows");
    expect(urlOf()).toContain("asType=persona");
    expect(urlOf()).toContain("asId=p-uuid");
  });

  it("creates a document through the rows plane", async () => {
    await interestDocumentsApi.create("b1", "t1", "p-uuid", {
      title: "Cylon portrayal",
      content: "...",
    });
    expect(initOf().method).toBe("POST");
    expect(urlOf()).toContain("asId=p-uuid");
    expect(JSON.parse(String(initOf().body)).title).toBe("Cylon portrayal");
  });
});
