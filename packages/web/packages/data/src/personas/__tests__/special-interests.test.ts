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

// `!` on the call tuple, not on its members: `noUncheckedIndexedAccess` types `calls[0]` as
// possibly-undefined, and a test that reaches here without a call should throw, not silently
// assert against `{}`.
const urlOf = () => String(fetchMock.mock.calls[0]![0]);
const initOf = () => fetchMock.mock.calls[0]![1] ?? {};

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

  it("preserves null topical and specific on general-only interests", async () => {
    const fetchMockForResponse = vi.fn();
    fetchMockForResponse.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "i2",
        personaId: "persona.acme.bitbag",
        slug: "philosophy",
        general: "Philosophy",
        topical: null,
        specific: null,
        stances: null,
      }),
      text: async () => "{}",
    });
    vi.stubGlobal("fetch", fetchMockForResponse);

    const result = await specialInterestsApi.create({
      personaId: "persona.acme.bitbag",
      slug: "philosophy",
      general: "Philosophy",
      topical: null,
      specific: null,
    });

    const body = JSON.parse(String(fetchMockForResponse.mock.calls[0]![1].body));
    expect(body.topical).toBe(null);
    expect(body.specific).toBe(null);
    expect(result.topical).toBe(null);
    expect(result.specific).toBe(null);
  });
});

describe("interestDocumentsApi", () => {
  /** ONE `content.markdown` row exactly as the rows plane emits it. The route does an untyped
   *  `tx.select().from(target.table)` (backend/src/adh/src/routes/bucketsData.ts) and JSON-encodes
   *  the whole Drizzle row, so every column of `markdownInContent` is on the wire — not the five
   *  fields the pane happens to read. Hand-written 5-field fixtures are exactly what made the
   *  wire shape look like something it isn't. */
  const WIRE_ROW = {
    id: "md-1",
    customerId: "cust-1",
    deletedAt: null,
    ecosystemId: "eco-1",
    ownerKind: "customer",
    ownerId: "cust-1",
    title: "Cylon portrayal",
    content: "# Cylon portrayal\n\nThe reimagined series…",
    frontmatter: { adh_source: "interest:battlestar-galactica" },
    visibility: "private",
    stage: "draft",
    publicRoute: null,
    contentHash: "a".repeat(64),
    sizeBytes: 42,
    currentVersion: 1,
    latestVersionId: null,
    createdAt: "2026-07-25T00:00:00Z",
    updatedAt: "2026-07-25T00:00:00Z",
    isDeleted: false,
    syncVersion: 0,
    syncStampedAt: null,
    syncTxid: 0,
  };

  /** Re-point the shared `fetch` stub at one specific body. Each verb of this plane answers with a
   *  DIFFERENT shape, so no single default fixture can be right for all of them. */
  const respondWith = (body: unknown) =>
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });

  it("names the acting persona on every call", async () => {
    respondWith({ rows: [] });
    await interestDocumentsApi.list("b1", "t1", "p-uuid");
    expect(urlOf()).toContain("/api/bucket/buckets/b1/types/t1/rows");
    expect(urlOf()).toContain("asType=persona");
    expect(urlOf()).toContain("asId=p-uuid");
  });

  // The list verb is the ONE on this plane that wraps: `return c.json({ rows })`
  // (routes/bucketsData.ts). A client typed as `InterestDocumentRow[]` compiles, and the caller
  // then does `docs.map(...)` on an object — a TypeError on every successful load, empty corpus
  // included. Nothing catches that unless a test crosses the real client against the real body,
  // so these two assert the RESOLVED VALUE, never just the URL.
  it("unwraps the { rows } envelope the rows plane answers a list with", async () => {
    respondWith({ rows: [WIRE_ROW] });
    const docs = await interestDocumentsApi.list("b1", "t1", "p-uuid");
    expect(Array.isArray(docs)).toBe(true);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.id).toBe("md-1");
    expect(docs[0]!.title).toBe("Cylon portrayal");
  });

  it("resolves an empty corpus to an empty ARRAY, not to the envelope", async () => {
    // The first load an author ever does. `{rows: []}` and `[]` are both falsy-length-free, so a
    // bare-array assumption survives every URL-only test and dies here.
    respondWith({ rows: [] });
    await expect(interestDocumentsApi.list("b1", "t1", "p-uuid")).resolves.toEqual([]);
  });

  it("creates a document through the rows plane", async () => {
    respondWith(WIRE_ROW);
    const created = await interestDocumentsApi.create("b1", "t1", "p-uuid", {
      title: "Cylon portrayal",
      content: "...",
    });
    expect(initOf().method).toBe("POST");
    expect(urlOf()).toContain("asId=p-uuid");
    expect(JSON.parse(String(initOf().body)).title).toBe("Cylon portrayal");
    // POST answers `c.json(row, 201)` — a BARE row, no envelope. The asymmetry with list is the
    // whole trap, so pin both ends of it: unwrapping here would be just as wrong.
    expect(created.id).toBe("md-1");
  });
});
