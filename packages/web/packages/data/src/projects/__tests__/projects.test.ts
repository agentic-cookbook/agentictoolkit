// URL/method/body contract tests for the three Projects clients. Only the
// transport (`authedJson`/`authedRequest`) is mocked — the mappers, `compact`,
// and query-building run for real, so these pin the wire contract that the later
// Projects UI is built on. Emphasis (per the task brief) on: a PATCH with a
// compacted body, a work-item update that CLEARS an assignee (explicit null must
// survive), the activity keyset query + `nextBefore`, and the participant DELETE
// carrying `?kind=`.
import { describe, expect, it, vi, beforeEach } from "vitest";

// Stub only the transport; client-helpers (compact/enc/sortByText) stay real.
vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}));

import { projectsApi } from "../projects";
import { projectWorkItemsApi } from "../work-items";
import { projectActivityApi } from "../activity";
import { projectArtifactsApi } from "../artifacts";
import { authedJson, authedRequest } from "../../http";

const mockedJson = vi.mocked(authedJson);
const mockedRequest = vi.mocked(authedRequest);

beforeEach(() => {
  mockedJson.mockReset();
  mockedRequest.mockReset();
});

/* ── projectsApi ──────────────────────────────────────────────────────── */

describe("projectsApi", () => {
  it("list GETs the base URL and sorts by name", async () => {
    mockedJson.mockResolvedValueOnce([
      { id: "2", name: "Beta", description: "", status: "active", color: "#000", ecosystemId: "o", createdAt: "c", updatedAt: "u" },
      { id: "1", name: "Alpha", description: "", status: "active", color: "#000", ecosystemId: "o", createdAt: "c", updatedAt: "u" },
    ]);
    const out = await projectsApi.list();
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects");
    expect(out.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });

  it("get encodes the id and returns null on a thrown 404", async () => {
    mockedJson.mockRejectedValueOnce(new Error("not found"));
    expect(await projectsApi.get("a/b")).toBeNull();
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/a%2Fb");
  });

  it("create POSTs a compacted body (undefined optionals dropped)", async () => {
    mockedJson.mockResolvedValueOnce({ id: "1", name: "P", description: "", status: "active", color: "#000", ecosystemId: "o", createdAt: "c", updatedAt: "u" });
    await projectsApi.create({ name: "P", color: "#fff" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects", {
      method: "POST",
      body: JSON.stringify({ name: "P", color: "#fff" }),
    });
  });

  it("update PATCHes a compacted body, dropping undefined but KEEPING explicit null (un-archive)", async () => {
    mockedJson.mockResolvedValueOnce({ id: "1", name: "P", description: "", status: "active", color: "#000", ecosystemId: "o", createdAt: "c", updatedAt: "u" });
    await projectsApi.update("1", { name: "Renamed", description: undefined, archivedAt: null });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed", archivedAt: null }),
    });
  });

  it("delete DELETEs via authedRequest", async () => {
    await projectsApi.delete("1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/project/projects/1", { method: "DELETE" });
  });
});

/* ── statuses sub-resource ────────────────────────────────────────────── */

describe("projectsApi.statuses", () => {
  it("create POSTs to the project's statuses collection", async () => {
    mockedJson.mockResolvedValueOnce({ id: "s1", projectId: "p1", key: "todo", label: "To do", category: "todo", position: 0, createdAt: "c" });
    await projectsApi.statuses.create("p1", { key: "todo", label: "To do", category: "todo" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/statuses", {
      method: "POST",
      body: JSON.stringify({ key: "todo", label: "To do", category: "todo" }),
    });
  });

  it("update PATCHes the status by id with a compacted body", async () => {
    mockedJson.mockResolvedValueOnce({ id: "s1", projectId: "p1", key: "todo", label: "Doing", category: "in_progress", position: 1, createdAt: "c" });
    await projectsApi.statuses.update("p1", "s1", { label: "Doing", category: "in_progress" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/statuses/s1", {
      method: "PATCH",
      body: JSON.stringify({ label: "Doing", category: "in_progress" }),
    });
  });

  it("remove DELETEs the status by id", async () => {
    await projectsApi.statuses.remove("p1", "s1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/project/projects/p1/statuses/s1", { method: "DELETE" });
  });
});

/* ── participants sub-resource ────────────────────────────────────────── */

describe("projectsApi.participants", () => {
  it("add POSTs the (kind, id) pair", async () => {
    mockedJson.mockResolvedValueOnce({ id: "pp1", projectId: "p1", participantKind: "customer", participantId: "cust1", role: "member", addedBy: null, addedAt: "a" });
    await projectsApi.participants.add("p1", { participantKind: "customer", participantId: "cust1" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/participants", {
      method: "POST",
      body: JSON.stringify({ participantKind: "customer", participantId: "cust1" }),
    });
  });

  it("remove addresses by actor id and REQUIRES the ?kind= query", async () => {
    await projectsApi.participants.remove("p1", "cust1", "customer");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/project/projects/p1/participants/cust1?kind=customer",
      { method: "DELETE" },
    );
  });
});

/* ── projectWorkItemsApi ──────────────────────────────────────────────── */

const WORK_ITEM = {
  id: "w1",
  ecosystemId: "o",
  projectId: "p1",
  title: "Task",
  description: "",
  statusId: "s1",
  assigneeKind: "customer" as const,
  assigneeId: "cust1",
  priority: 0,
  labels: [],
  position: 0,
  createdAt: "c",
  updatedAt: "u",
};

describe("projectWorkItemsApi", () => {
  it("listForProject GETs the per-project collection", async () => {
    mockedJson.mockResolvedValueOnce([WORK_ITEM]);
    const out = await projectWorkItemsApi.listForProject("p1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/work-items");
    expect(out[0]?.assigneeId).toBe("cust1");
  });

  it("create POSTs a compacted body under the project stem", async () => {
    mockedJson.mockResolvedValueOnce(WORK_ITEM);
    await projectWorkItemsApi.create("p1", { title: "Task", statusId: "s1" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/work-items", {
      method: "POST",
      body: JSON.stringify({ title: "Task", statusId: "s1" }),
    });
  });

  it("update clearing an assignee sends assigneeKind:null, assigneeId:null (NOT stripped)", async () => {
    mockedJson.mockResolvedValueOnce({ ...WORK_ITEM, assigneeKind: null, assigneeId: null });
    await projectWorkItemsApi.update("w1", {
      assigneeKind: null,
      assigneeId: null,
      dueDate: null,
      parentId: null,
      title: undefined, // an omitted field is still stripped
    });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1", {
      method: "PATCH",
      body: JSON.stringify({ assigneeKind: null, assigneeId: null, dueDate: null, parentId: null }),
    });
  });

  it("update setting values keeps only defined fields", async () => {
    mockedJson.mockResolvedValueOnce(WORK_ITEM);
    await projectWorkItemsApi.update("w1", { title: "New", priority: 3 });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1", {
      method: "PATCH",
      body: JSON.stringify({ title: "New", priority: 3 }),
    });
  });

  it("remove DELETEs the item by id", async () => {
    await projectWorkItemsApi.remove("w1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/project/work-items/w1", { method: "DELETE" });
  });

  it("children GETs the children collection", async () => {
    mockedJson.mockResolvedValueOnce([WORK_ITEM]);
    await projectWorkItemsApi.children("w1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/children");
  });

  it("getValues GETs the field form", async () => {
    mockedJson.mockResolvedValueOnce([{ fieldId: "f1", key: "sev", label: "Severity", type: "number", value: 3 }]);
    const out = await projectWorkItemsApi.getValues("w1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/fields");
    expect(out[0]?.value).toBe(3);
  });

  it("setValues PUTs the batch", async () => {
    mockedJson.mockResolvedValueOnce([]);
    await projectWorkItemsApi.setValues("w1", { values: [{ fieldId: "f1", value: null }] });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/fields", {
      method: "PUT",
      body: JSON.stringify({ values: [{ fieldId: "f1", value: null }] }),
    });
  });

  it("dependencies.add POSTs the dependsOnId edge", async () => {
    mockedJson.mockResolvedValueOnce({ id: "d1", ecosystemId: "o", workItemId: "w1", dependsOnId: "w2", createdAt: "c" });
    await projectWorkItemsApi.dependencies.add("w1", "w2");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/dependencies", {
      method: "POST",
      body: JSON.stringify({ dependsOnId: "w2" }),
    });
  });

  it("dependencies.remove DELETEs the edge", async () => {
    await projectWorkItemsApi.dependencies.remove("w1", "w2");
    expect(mockedRequest).toHaveBeenCalledWith("/api/project/work-items/w1/dependencies/w2", { method: "DELETE" });
  });
});

/* ── projectActivityApi ───────────────────────────────────────────────── */

const activityRow = (id: string, createdAt: string) => ({
  id,
  ecosystemId: "o",
  projectId: "p1",
  workItemId: null,
  actorKind: null,
  actorId: null,
  actorLabel: null,
  action: "project.updated",
  detail: null,
  createdAt,
});

describe("projectActivityApi", () => {
  it("projectActivity threads limit+before into the query and derives nextBefore from a full page", async () => {
    mockedJson.mockResolvedValueOnce([activityRow("a1", "t1"), activityRow("a2", "t2")]);
    const page = await projectActivityApi.projectActivity("p1", {
      limit: 2,
      before: "2026-01-02T00:00:00.000Z",
    });
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/projects/p1/activity?limit=2&before=2026-01-02T00%3A00%3A00.000Z",
    );
    // Full page (rows === limit) → nextBefore is the last row's COMPOSITE cursor token
    // "<createdAt>|<id>" (the id tiebreaker that closes the millisecond-tie "load older" gap).
    expect(page.nextBefore).toBe("t2|a2");
    expect(page.rows).toHaveLength(2);
  });

  it("projectActivity splits a composite before token into before + beforeId query params", async () => {
    mockedJson.mockResolvedValueOnce([activityRow("a3", "t3")]);
    await projectActivityApi.projectActivity("p1", { limit: 2, before: "t2|a2" });
    // The opaque "<createdAt>|<id>" token → before=<createdAt>&beforeId=<id> for the keyset.
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/projects/p1/activity?limit=2&before=t2&beforeId=a2",
    );
  });

  it("projectActivity returns nextBefore=null on a short (last) page", async () => {
    mockedJson.mockResolvedValueOnce([activityRow("a1", "t1")]);
    const page = await projectActivityApi.projectActivity("p1", { limit: 2 });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/activity?limit=2");
    expect(page.nextBefore).toBeNull();
  });

  it("projectActivity with no options issues no query string and nextBefore=null", async () => {
    mockedJson.mockResolvedValueOnce([activityRow("a1", "t1"), activityRow("a2", "t2")]);
    const page = await projectActivityApi.projectActivity("p1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/activity");
    expect(page.nextBefore).toBeNull();
  });

  it("workItemActivity hits the work-item stem with the keyset query", async () => {
    mockedJson.mockResolvedValueOnce([activityRow("a1", "t1")]);
    await projectActivityApi.workItemActivity("w1", { limit: 1, before: "cur" });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/activity?limit=1&before=cur");
  });

  it("addComment POSTs the body and maps the returned activity row", async () => {
    mockedJson.mockResolvedValueOnce(activityRow("a1", "t1"));
    const out = await projectActivityApi.addComment("w1", "hello");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/work-items/w1/comments", {
      method: "POST",
      body: JSON.stringify({ body: "hello" }),
    });
    expect(out.action).toBe("project.updated");
  });
});

/* ── projectArtifactsApi ──────────────────────────────────────────────── */

// The artifacts client's whole job is addressing: a link is identified by ITS id while the
// thing it points at is identified by a (kind, id) pair, and the two are easy to confuse
// because both are called "id" one level up. These pin which one reaches which URL, plus the
// two envelope unwraps (`{ items }`) and the query the picker builds.
describe("projectArtifactsApi", () => {
  const descriptor = (id: string, kind = "content.markdown") => ({
    kind,
    id,
    title: `Doc ${id}`,
    subtitle: null,
    url: null,
  });

  const artifactRow = (id: string) => ({
    id,
    projectId: "p1",
    direction: "ingested" as const,
    targetKind: "content.markdown",
    targetId: "d1",
    target: descriptor("d1"),
    createdAt: "c",
  });

  it("list unwraps the items envelope and keeps the server's order", async () => {
    mockedJson.mockResolvedValueOnce({ items: [artifactRow("a2"), artifactRow("a1")] });
    const out = await projectArtifactsApi.list("p1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/artifacts");
    // Not re-sorted: the endpoint returns newest-first and a client re-sort would silently
    // disagree with the pagination the endpoint is built for.
    expect(out.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("list narrows to one direction when asked", async () => {
    mockedJson.mockResolvedValueOnce({ items: [] });
    await projectArtifactsApi.list("p1", { direction: "produced" });
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/projects/p1/artifacts?direction=produced",
    );
  });

  it("list keeps an unresolvable pointer as a row with a null target", async () => {
    mockedJson.mockResolvedValueOnce({
      items: [{ ...artifactRow("a1"), target: null }],
    });
    const [row] = await projectArtifactsApi.list("p1");
    expect(row?.target).toBeNull();
    // The pointer itself survives, so a renderer can still say WHAT is missing.
    expect(row?.targetKind).toBe("content.markdown");
    expect(row?.targetId).toBe("d1");
  });

  it("attachable builds the picker query and unwraps the envelope", async () => {
    mockedJson.mockResolvedValueOnce({ items: [descriptor("d1")] });
    const out = await projectArtifactsApi.attachable("p1", {
      kind: "content.urls",
      query: "road map",
      limit: 100,
    });
    expect(mockedJson).toHaveBeenCalledWith(
      "/api/project/projects/p1/attachable?kind=content.urls&q=road+map&limit=100",
    );
    expect(out[0]?.id).toBe("d1");
  });

  it("attachable sends no query string when nothing narrows it", async () => {
    mockedJson.mockResolvedValueOnce({ items: [] });
    await projectArtifactsApi.attachable("p1");
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/attachable");
  });

  it("attachable defaults `url`/`subtitle` to null rather than leaving them undefined", async () => {
    mockedJson.mockResolvedValueOnce({ items: [{ kind: "k", id: "i", title: "T" }] });
    const [d] = await projectArtifactsApi.attachable("p1");
    expect(d?.subtitle).toBeNull();
    expect(d?.url).toBeNull();
  });

  it("link POSTs the (direction, kind, id) triple and maps the created row", async () => {
    mockedJson.mockResolvedValueOnce(artifactRow("a1"));
    const out = await projectArtifactsApi.link("p1", {
      direction: "ingested",
      targetKind: "content.markdown",
      targetId: "d1",
    });
    expect(mockedJson).toHaveBeenCalledWith("/api/project/projects/p1/artifacts", {
      method: "POST",
      body: JSON.stringify({
        direction: "ingested",
        targetKind: "content.markdown",
        targetId: "d1",
      }),
    });
    expect(out.target?.title).toBe("Doc d1");
  });

  it("unlink addresses the LINK's id, not the target's, and encodes both segments", async () => {
    mockedRequest.mockResolvedValueOnce(undefined);
    await projectArtifactsApi.unlink("p/1", "a/1");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/project/projects/p%2F1/artifacts/a%2F1",
      { method: "DELETE" },
    );
  });
});
