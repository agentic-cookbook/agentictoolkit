// @vitest-environment jsdom
//
// Component test for WorkItemRelations — how a card says it is linked to others.
//
// Only the api-client boundary (@agentic-toolkit/data/projects) is mocked, so load → pick →
// link → reload and the unlink wiring are exercised rather than the transport. The property
// worth the most attention is the one a screenshot cannot check: a relation is stored ONCE and
// read from both ends, so the SAME kind must read differently depending on which card you are
// standing on. Every "Blocked by"/"Blocks" assertion below is really that one claim.
//
// @agentic-toolkit/data is deliberately NOT mocked: the list runs through the REAL
// useResourceList, whose module-scope cache is keyed `work-item:<id>:relations` and OUTLIVES
// cleanup(). Each test therefore uses its own item id, or it would seed the next one's first
// paint with rows that test never stubbed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", () => ({
  projectWorkItemsApi: {
    relations: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
  },
  // Plain data, but `./vocabulary` imports them from this module — a whole-module mock that omits
  // them breaks the import chain, not just the value.
  DEFAULT_ITEM_NOUN: "work item",
  DEFAULT_ITEM_NOUN_PLURAL: "work items",
}));

import { WorkItemRelations } from "./WorkItemRelations";
import {
  projectWorkItemsApi,
  type ProjectStatus,
  type WorkItem,
  type WorkItemRelation,
} from "@agentic-toolkit/data/projects";

const list = vi.mocked(projectWorkItemsApi.relations.list);
const add = vi.mocked(projectWorkItemsApi.relations.add);
const remove = vi.mocked(projectWorkItemsApi.relations.remove);

const STATUSES: ProjectStatus[] = [
  {
    id: "s1",
    projectId: "p1",
    label: "In progress",
    category: "started",
    position: 1,
    isDefault: false,
    createdAt: "c",
    updatedAt: "u",
  },
  {
    id: "s2",
    projectId: "p1",
    label: "Done",
    category: "completed",
    position: 2,
    isDefault: false,
    createdAt: "c",
    updatedAt: "u",
  },
];

function workItem(id: string, itemKey: string, title: string): WorkItem {
  return {
    id,
    projectId: "p1",
    itemKey,
    title,
    description: "",
    statusId: "s1",
    assigneeKind: null,
    assigneeId: null,
    priority: 2,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    rank: "V1",
    createdAt: "c",
    updatedAt: "u",
  };
}

const SUBJECT = workItem("w1", "ADH-1", "Ship the redirect fix");
const OTHERS = [
  workItem("w2", "ADH-2", "Rotate the signing key"),
  workItem("w3", "ADH-3", "Write the migration"),
  workItem("w4", "ADH-4", "Delete the old route"),
];

function relation(
  over: Partial<WorkItemRelation> & Pick<WorkItemRelation, "id" | "kind" | "direction" | "relatedId">,
): WorkItemRelation {
  const far = OTHERS.find((w) => w.id === over.relatedId);
  return {
    relatedKey: far?.itemKey ?? "",
    title: far?.title ?? "",
    status: "s1",
    createdAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function renderFor(item: WorkItem): void {
  render(<WorkItemRelations item={item} statuses={STATUSES} workItems={[item, ...OTHERS]} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
  add.mockResolvedValue({
    id: "e9",
    workItemId: "w1",
    dependsOnId: "w2",
    kind: "depends_on",
    createdAt: "2026-08-05T00:00:00Z",
  });
  remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("WorkItemRelations", () => {
  it("phrases the SAME kind differently at each end of the edge", async () => {
    // One stored `depends_on` row read from the subject's side is "Blocked by"; another whose
    // subject is the far card is "Blocks". This is the whole reason `direction` is on the wire —
    // if the pane ever phrased from the stored edge instead, both would read the same way.
    list.mockResolvedValue([
      relation({ id: "r1", kind: "depends_on", direction: "outgoing", relatedId: "w2" }),
      relation({ id: "r2", kind: "depends_on", direction: "incoming", relatedId: "w3" }),
    ]);
    const item = { ...SUBJECT, id: "phrasing" };
    renderFor(item);

    expect(await screen.findByText("Blocked by")).not.toBeNull();
    expect(screen.getByText("Blocks")).not.toBeNull();
    await waitFor(() => expect(list).toHaveBeenCalledWith("phrasing"));
  });

  it("reads a symmetric link the same way from either end", async () => {
    // `relates_to` is stored once and true from both sides, so its two directions are NOT two
    // phrasings — a card that said "Related to" one way and something else the other would be
    // claiming an order the relationship does not have.
    list.mockResolvedValue([
      relation({ id: "r1", kind: "relates_to", direction: "outgoing", relatedId: "w2" }),
      relation({ id: "r2", kind: "relates_to", direction: "incoming", relatedId: "w3" }),
    ]);
    renderFor({ ...SUBJECT, id: "symmetric" });

    // Scoped to the rows: "Related to" is also one of the kind chooser's options, and a bare
    // text query would pass on that alone — before either row had even loaded.
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(within(row).getByText("Related to")).not.toBeNull();
  });

  it("names the far card by key and title, with the far card's status", async () => {
    list.mockResolvedValue([
      relation({
        id: "r1",
        kind: "duplicates",
        direction: "outgoing",
        relatedId: "w2",
        status: "s2",
      }),
    ]);
    renderFor({ ...SUBJECT, id: "naming" });

    expect(await screen.findByText("Duplicates")).not.toBeNull();
    expect(screen.getByText("ADH-2")).not.toBeNull();
    expect(screen.getByText("Rotate the signing key")).not.toBeNull();
    // The far card's status, not the subject's — the row describes the other end throughout.
    expect(screen.getByText("Done")).not.toBeNull();
  });

  it("groups by relationship rather than by when each link was made", async () => {
    // Made in the order duplicates → relates_to → depends_on; read in the order a person cares
    // about them, which puts what blocks this card first.
    list.mockResolvedValue([
      relation({ id: "r1", kind: "duplicates", direction: "outgoing", relatedId: "w2" }),
      relation({ id: "r2", kind: "relates_to", direction: "outgoing", relatedId: "w3" }),
      relation({ id: "r3", kind: "depends_on", direction: "outgoing", relatedId: "w4" }),
    ]);
    renderFor({ ...SUBJECT, id: "ordering" });

    await screen.findByText("Blocked by");
    const labels = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")
      .map((t) => t.split(/ADH-/)[0]?.trim());
    expect(labels).toEqual(["Blocked by", "Related to", "Duplicates"]);
  });

  it("links the chosen card with the chosen relationship, then reloads", async () => {
    const item = { ...SUBJECT, id: "linking" };
    renderFor(item);
    await screen.findByText("Not linked to anything yet.");

    fireEvent.change(screen.getByLabelText("Relationship"), {
      target: { value: "relates_to" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Work item" }));
    // Offered by key AND title — the same name a person would quote in a branch or a message.
    fireEvent.click(screen.getByRole("option", { name: "ADH-3 — Write the migration" }));
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() => expect(add).toHaveBeenCalledWith("linking", "w3", "relates_to"));
    // Two GETs: the mount's and the one after the write.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("does not offer the card itself, nor one already linked", async () => {
    list.mockResolvedValue([
      relation({ id: "r1", kind: "depends_on", direction: "outgoing", relatedId: "w2" }),
    ]);
    renderFor({ ...SUBJECT, id: "candidates" });
    await screen.findByText("Blocked by");

    fireEvent.click(screen.getByRole("button", { name: "Work item" }));
    // The chooser's own listbox, not every option on screen — the kind <select> has three of
    // its own, and they are not candidates.
    const listbox = screen.getByRole("listbox", { name: "Work item" });
    const options = within(listbox)
      .getAllByRole("option")
      .map((o) => o.textContent);
    // w2 is already linked and the subject cannot link to itself; both would be a 409 the
    // person could have been spared, and the existing link is on screen directly above.
    expect(options).toEqual(["ADH-3 — Write the migration", "ADH-4 — Delete the old route"]);
  });

  it("unlinks by the FAR CARD, not by the edge id", async () => {
    // A pair holds one relation, so naming the other card names the link — and the backend
    // accepts it from either end. Sending the edge id would work only for the end that filed it.
    list.mockResolvedValue([
      relation({ id: "r1", kind: "depends_on", direction: "incoming", relatedId: "w2" }),
    ]);
    const item = { ...SUBJECT, id: "unlinking" };
    renderFor(item);
    await screen.findByText("Blocks");

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink ADH-2 — Rotate the signing key" }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("unlinking", "w2"));
  });

  it("reports a refused link instead of leaving the pick sitting there", async () => {
    add.mockRejectedValue(new Error("those items are already linked (relates_to)"));
    renderFor({ ...SUBJECT, id: "refused" });
    await screen.findByText("Not linked to anything yet.");

    fireEvent.click(screen.getByRole("button", { name: "Work item" }));
    fireEvent.click(screen.getByRole("option", { name: "ADH-2 — Rotate the signing key" }));
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    // The backend's own words: it names which relationship is in the way, which is the fact
    // that tells the person what to remove.
    expect(
      await screen.findByText("those items are already linked (relates_to)"),
    ).not.toBeNull();
  });

  it("does not claim a card is unlinked while the read is still outstanding", async () => {
    // "Not linked to anything yet" is an assertion about the card. Before the list lands, the
    // pane does not know it — and an empty list drawn early would flash a wrong fact.
    let settle: (rows: WorkItemRelation[]) => void = () => {};
    list.mockReturnValue(
      new Promise<WorkItemRelation[]>((resolve) => {
        settle = resolve;
      }),
    );
    renderFor({ ...SUBJECT, id: "loading" });

    expect(screen.getByText("Loading…")).not.toBeNull();
    expect(screen.queryByText("Not linked to anything yet.")).toBeNull();

    settle([relation({ id: "r1", kind: "depends_on", direction: "outgoing", relatedId: "w2" })]);
    expect(await screen.findByText("Blocked by")).not.toBeNull();
  });
});
