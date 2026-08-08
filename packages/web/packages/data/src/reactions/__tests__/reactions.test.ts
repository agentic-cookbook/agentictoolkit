// URL/method/body contract tests for the reactions client, plus the two folds a rendering
// surface depends on. Only the transport (`authedJson`/`authedRequest`) is mocked, so the query
// building, the envelope unwrap and the mappers all run for real.
//
// The emphasis is on the three properties a caller would otherwise have to rediscover the hard
// way: the batch is chunked against the backend's cap (a long thread must not 400 the whole
// pane), an empty subject list costs no request at all, and un-reacting is addressed by the
// REACTION's id — which is the only reason `tally` returns an id where a boolean would look
// sufficient.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}));

import { byTarget, reactionsApi, tally, type Reaction } from "../reactions";
import type { ReactionRow } from "../wire";
import { authedJson, authedRequest } from "../../http";

const mockedJson = vi.mocked(authedJson);
const mockedRequest = vi.mocked(authedRequest);

beforeEach(() => {
  mockedJson.mockReset();
  mockedRequest.mockReset();
});

const row = (id: string, over: Partial<ReactionRow> = {}): ReactionRow => ({
  id,
  customerId: "cust-1",
  ecosystemId: "eco-1",
  targetKind: "project.comments",
  targetId: "c1",
  emoji: "👍",
  createdAt: `t-${id}`,
  ...over,
});

const reaction = (id: string, over: Partial<Reaction> = {}): Reaction => ({
  id,
  customerId: "cust-1",
  targetKind: "project.comments",
  targetId: "c1",
  emoji: "👍",
  createdAt: `t-${id}`,
  ...over,
});

describe("reactionsApi.list", () => {
  it("reads MANY subjects in one request and unwraps the items envelope", async () => {
    mockedJson.mockResolvedValueOnce({ items: [row("r1"), row("r2", { targetId: "c2" })] });
    const out = await reactionsApi.list("project.comments", ["c1", "c2"]);
    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/content/reactions?targetKind=project.comments&targetIds=c1%2Cc2",
    );
    expect(out.map((r) => r.targetId)).toEqual(["c1", "c2"]);
  });

  it("issues NO request for an empty subject list", async () => {
    // The backend requires at least one subject. A pane whose comments have not landed yet would
    // otherwise send a call it already knows is a 400, and paint the error it caused itself.
    expect(await reactionsApi.list("project.comments", [])).toEqual([]);
    expect(mockedJson).not.toHaveBeenCalled();
  });

  it("de-duplicates subjects before asking", async () => {
    mockedJson.mockResolvedValueOnce({ items: [] });
    await reactionsApi.list("project.comments", ["c1", "c1", "c2"]);
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/content/reactions?targetKind=project.comments&targetIds=c1%2Cc2",
    );
  });

  it("chunks past the backend's cap instead of 400ing the whole read", async () => {
    // 201 subjects is one over the cap. Passing them straight through would fail the entire
    // pane — including the 200 subjects that were fine — on a thread merely being long.
    const ids = Array.from({ length: 201 }, (_, i) => `c${i}`);
    mockedJson.mockResolvedValue({ items: [] });
    await reactionsApi.list("project.comments", ids);
    expect(mockedJson).toHaveBeenCalledTimes(2);
    const [first, second] = mockedJson.mock.calls.map((c) => String(c[0]));
    expect(first?.split("targetIds=")[1]?.split("%2C")).toHaveLength(200);
    expect(second?.split("targetIds=")[1]?.split("%2C")).toHaveLength(1);
  });

  it("merges every chunk's rows into one list", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `c${i}`);
    mockedJson
      .mockResolvedValueOnce({ items: [row("r1")] })
      .mockResolvedValueOnce({ items: [row("r2", { targetId: "c200" })] });
    const out = await reactionsApi.list("project.comments", ids);
    expect(out.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("reactionsApi writes", () => {
  it("add POSTs the whole subject, since the store is polymorphic", async () => {
    mockedJson.mockResolvedValueOnce(row("r1"));
    const out = await reactionsApi.add("project.comments", "c1", "👍");
    expect(mockedJson).toHaveBeenCalledWith("/api/content/reactions", {
      method: "POST",
      body: JSON.stringify({ targetKind: "project.comments", targetId: "c1", emoji: "👍" }),
    });
    expect(out.id).toBe("r1");
  });

  it("remove addresses the REACTION's id, not the subject it sits on", async () => {
    // A subject holds many reactions from many people; only the id says which one is yours.
    await reactionsApi.remove("r1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/content/reactions/r1", { method: "DELETE" });
  });
});

describe("tally", () => {
  it("counts per emoji and hands back the VIEWER's own reaction id", async () => {
    const out = tally(
      [
        reaction("r1", { emoji: "👍", customerId: "cust-1" }),
        reaction("r2", { emoji: "👍", customerId: "cust-2" }),
        reaction("r3", { emoji: "🎉", customerId: "cust-2" }),
      ],
      "cust-1",
    );
    expect(out).toEqual([
      { emoji: "👍", count: 2, mine: "r1" },
      { emoji: "🎉", count: 1, mine: null },
    ]);
  });

  it("claims nothing when the viewer is unknown", async () => {
    // Signed out, or server-side: the counts are still true, so they show — but the bar must not
    // assert that one of them is yours.
    const out = tally([reaction("r1"), reaction("r2", { emoji: "🎉" })], null);
    expect(out.every((t) => t.mine === null)).toBe(true);
  });

  it("orders by count, and a tie keeps the order the emoji first appeared", async () => {
    // Otherwise a bar reshuffles under the pointer as counts even up — the click lands on a
    // different emoji than the one that was under it.
    const out = tally(
      [
        reaction("r1", { emoji: "🎉" }),
        reaction("r2", { emoji: "👍" }),
        reaction("r3", { emoji: "👀" }),
        reaction("r4", { emoji: "👀" }),
      ],
      null,
    );
    expect(out.map((t) => t.emoji)).toEqual(["👀", "🎉", "👍"]);
  });
});

describe("byTarget", () => {
  it("unpacks a batched read back into one bucket per subject", async () => {
    const groups = byTarget([
      reaction("r1", { targetId: "c1" }),
      reaction("r2", { targetId: "c2" }),
      reaction("r3", { targetId: "c1" }),
    ]);
    expect([...groups.keys()]).toEqual(["c1", "c2"]);
    expect(groups.get("c1")?.map((r) => r.id)).toEqual(["r1", "r3"]);
    // A subject nobody reacted to is simply absent — the caller renders an empty bar for it.
    expect(groups.get("c9")).toBeUndefined();
  });
});
