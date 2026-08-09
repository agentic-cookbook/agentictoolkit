// URL/method/short-circuit contract for the cross-board search client.
//
// Same arrangement as the other client tests: only the transport is mocked, so the query
// building and the mapper run for real. Three things are worth pinning, and each is a decision
// this module makes rather than a call it forwards:
//
//   1. a blank `q` never leaves the process. The server 400s on one, and an empty search box is
//      the ordinary state of a search box — a request would turn typing into an error;
//   2. the optional params are OMITTED when unset rather than sent empty, because `?workspace=`
//      is fail-closed on the server: an empty slug and no slug must not mean the same thing by
//      accident on the wire;
//   3. the page comes back in the SERVER's order. Nothing here re-sorts by rank — a client
//      holding one page cannot rank a result set it only partly has, and the keyed-hit-first
//      rule lives in SQL where the key is known.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
}));

import { projectSearchApi, toWorkItemSearchHit, EMPTY_WORK_ITEM_SEARCH } from "../search";
import type { WorkItemSearchHitRow, WorkItemSearchPageRow } from "../wire";
import { authedJson } from "../../http";

const mockedJson = vi.mocked(authedJson);

beforeEach(() => {
  mockedJson.mockReset();
});

const hitRow = (extra: Partial<WorkItemSearchHitRow> = {}): WorkItemSearchHitRow => ({
  id: "w1",
  projectId: "p1",
  projectName: "Alpha",
  itemKey: "ALP-1",
  title: "Tungsten filament rollout",
  statusId: "s1",
  updatedAt: "u",
  snippet: "the plan for the alpha board",
  rank: 0.6,
  ...extra,
});

const page = (rows: WorkItemSearchHitRow[], extra: Partial<WorkItemSearchPageRow> = {}) =>
  ({ results: rows, limit: 20, hasMore: false, ...extra }) satisfies WorkItemSearchPageRow;

describe("projectSearchApi.workItems", () => {
  it("sends only `q` when nothing else is asked for", async () => {
    mockedJson.mockResolvedValueOnce(page([hitRow()]));
    await projectSearchApi.workItems("tungsten");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/search/work-items?q=tungsten");
  });

  it("carries a workspace and a limit when given, in that order", async () => {
    mockedJson.mockResolvedValueOnce(page([]));
    await projectSearchApi.workItems("tungsten", { workspace: "acme", limit: 5 });
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/search/work-items?q=tungsten&workspace=acme&limit=5",
    );
  });

  it("encodes a phrase rather than pasting it into the URL", async () => {
    mockedJson.mockResolvedValueOnce(page([]));
    await projectSearchApi.workItems("two words & a symbol");
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/search/work-items?q=two%20words%20%26%20a%20symbol",
    );
  });

  it("never sends a blank query — an empty box is a state, not a 400", async () => {
    expect(await projectSearchApi.workItems("")).toBe(EMPTY_WORK_ITEM_SEARCH);
    expect(await projectSearchApi.workItems("   ")).toBe(EMPTY_WORK_ITEM_SEARCH);
    expect(mockedJson).not.toHaveBeenCalled();
  });

  it("trims what it does send, so a trailing space is not a different search", async () => {
    mockedJson.mockResolvedValueOnce(page([]));
    await projectSearchApi.workItems("  tungsten  ");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/search/work-items?q=tungsten");
  });

  it("keeps the server's order and reports the limit the server ACTUALLY applied", async () => {
    // The server clamps rather than refusing, so the echoed limit can differ from what was
    // asked. A client that displayed its own request would lie about how much it is showing.
    const weaker = hitRow({ id: "w2", itemKey: "ALP-2", title: "Order more tungsten", rank: 0.1 });
    mockedJson.mockResolvedValueOnce(page([weaker, hitRow()], { limit: 50, hasMore: true }));
    const result = await projectSearchApi.workItems("tungsten", { limit: 500 });
    expect(result.results.map((r) => r.id)).toEqual(["w2", "w1"]);
    expect(result.limit).toBe(50);
    expect(result.hasMore).toBe(true);
  });
});

describe("toWorkItemSearchHit", () => {
  it("carries the board's NAME through, which is the field a card row does not have", async () => {
    const hit = toWorkItemSearchHit(hitRow({ projectName: "Beta" }));
    expect(hit.projectName).toBe("Beta");
    expect(hit.itemKey).toBe("ALP-1");
  });

  it("defaults a missing snippet/rank rather than emitting undefined", () => {
    // A title-only hit's headline can come back empty; a renderer should get "" and show the
    // title alone, not `undefined` printed into the DOM.
    const bare = { ...hitRow(), snippet: undefined, rank: undefined } as unknown as
      WorkItemSearchHitRow;
    const hit = toWorkItemSearchHit(bare);
    expect(hit.snippet).toBe("");
    expect(hit.rank).toBe(0);
  });
});
