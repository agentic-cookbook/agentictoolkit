// @vitest-environment jsdom
//
// Component test for WorkItemsSurface — the 4e work-items view switcher. The surface
// loads the shared query ONCE (items + statuses + participants) and owns the two
// shared concerns: the WorkItemEditor (opened from any view via onOpenItem / the New
// action) and the optimistic-with-revert status move (BoardView calls onMove). The
// hub's vitest config is node-only, so this file opts into jsdom via the docblock.
// The api-client boundaries are mocked, so the load-once + switch + editor + move
// wiring is exercised, not the transport. A stateful `leaf` harness makes the
// switcher deep-link the active view the way ResourceExplorer's URL leaf would.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";

// The three former hub modules (@/api/{projects,project-work-items,project-activity}) now ship in
// ONE domain barrel (@agentic-toolkit/data/projects), so their stubs merge into a single mock: the
// work-items + projects clients the surface reads, plus the two clients the edit-mode editor's
// lower sections load on mount — comments and the activity trail (empty replies keep them quiet
// without touching the network). The mock is PARTIAL (importOriginal-spread) because those panes
// also use pure folds from the same barrel — `threadOf` — which have nothing to stub.
vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectWorkItemsApi: {
    listForProject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
  projectsApi: {
    statuses: { list: vi.fn() },
    participants: { list: vi.fn() },
    labels: vi.fn(),
    // The surface reads the project's OWN record for one field — its estimate scale.
    get: vi.fn(),
  },
  // The workspace's time-boxes, which the editor's iteration picker offers.
  projectIterationsApi: { list: vi.fn() },
  projectActivityApi: {
    workItemActivity: vi.fn().mockResolvedValue({ rows: [], nextBefore: null }),
  },
  projectCommentsApi: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
  },
}));

// The comments pane batches its thread's reactions on the same mount.
vi.mock("@agentic-toolkit/data/reactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/reactions")>()),
  reactionsApi: { list: vi.fn().mockResolvedValue([]), add: vi.fn(), remove: vi.fn() },
}));

import { WorkItemsSurface } from "./WorkItemsSurface";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import {
  projectIterationsApi,
  projectsApi,
  type Iteration,
  type Project,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { RailHostBoundary, type TopicLeaf } from "@agentic-toolkit/resource";

const listForProject = vi.mocked(projectWorkItemsApi.listForProject);
const create = vi.mocked(projectWorkItemsApi.create);
const update = vi.mocked(projectWorkItemsApi.update);
const get = vi.mocked(projectWorkItemsApi.get);
const statusesList = vi.mocked(projectsApi.statuses.list);
const participantsList = vi.mocked(projectsApi.participants.list);
const labelsList = vi.mocked(projectsApi.labels);
const projectGet = vi.mocked(projectsApi.get);
const iterationsList = vi.mocked(projectIterationsApi.list);

function status(over: Partial<ProjectStatus>): ProjectStatus {
  return {
    id: "s",
    projectId: "p1",
    key: "k",
    label: "L",
    category: "todo",
    position: 0,
    createdAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

function item(over: Partial<WorkItem>): WorkItem {
  return {
    id: "w",
    projectId: "p1",
    itemKey: "",
    title: "T",
    description: "",
    statusId: "s1",
    assigneeKind: null,
    assigneeId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    iterationId: null,
    estimate: null,
    rank: "V0",
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

const TODO_COL = status({ id: "s1", key: "todo", label: "To do", category: "todo", position: 0 });
const DOING = status({ id: "s2", key: "doing", label: "In progress", category: "in_progress", position: 1 });
const DONE = status({ id: "s3", key: "done", label: "Done", category: "done", position: 2 });

/** The project's own record. Only `estimateScale` is read here — the rest is what a Project is. */
const PROJECT: Project = {
  id: "p1",
  name: "Website",
  description: "",
  status: "active",
  color: "#007AFF",
  keyPrefix: "",
  ecosystemId: "eco-1",
  archivedAt: null,
  estimateScale: "none",
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

/** A workspace cycle. `state` is DERIVED by the backend from the dates, so a fixture states it. */
const CYCLE: Iteration = {
  id: "it1",
  name: "Sprint 7",
  description: "",
  startDate: "2026-07-01",
  endDate: "2026-07-14",
  state: "active",
  ownerKind: "customer",
  ownerId: "cust-1",
  ecosystemId: "eco-1",
  createdAt: "2026-06-30T00:00:00Z",
  updatedAt: "2026-06-30T00:00:00Z",
};

const PARTICIPANT: ProjectParticipant = {
  id: "pp1",
  projectId: "p1",
  participantKind: "customer",
  participantId: "cust-1",
  role: "member",
  addedBy: null,
  addedAt: "2026-07-03T00:00:00Z",
};

// w1 in To do (High, assigned to the participant), w2 in In progress.
const W1 = item({
  id: "w1",
  title: "Design the landing page",
  statusId: "s1",
  priority: 3,
  assigneeKind: "customer",
  assigneeId: "cust-1",
  dueDate: "2026-08-01",
});
const W2 = item({ id: "w2", title: "Write the copy", statusId: "s2", priority: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  listForProject.mockResolvedValue([structuredClone(W1), structuredClone(W2)]);
  statusesList.mockResolvedValue([DONE, TODO_COL, DOING].map((s) => structuredClone(s))); // unsorted
  participantsList.mockResolvedValue([structuredClone(PARTICIPANT)]);
  labelsList.mockResolvedValue([]);
  projectGet.mockResolvedValue(structuredClone(PROJECT));
  iterationsList.mockResolvedValue([]);
  create.mockImplementation((_projectId, input) =>
    Promise.resolve({ ...structuredClone(W1), ...input, id: "w3" } as WorkItem),
  );
  update.mockImplementation((id, patch) =>
    Promise.resolve({ ...structuredClone(W1), id, ...patch } as WorkItem),
  );
  // A failed move's catch reconciles against the server's authoritative row. Default: the
  // server never actually changed the item (no PATCH persisted), so `get` returns it unmoved —
  // the correct baseline for every failed-move test below unless a test overrides it.
  get.mockImplementation((id: string) =>
    Promise.resolve(
      id === W1.id ? structuredClone(W1) : id === W2.id ? structuredClone(W2) : null,
    ),
  );
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

/** The List view has loaded: its title cell is an INLINE EDITOR, so the title is an input value. */
const listLoaded = () => screen.findByDisplayValue("Design the landing page");

// The five views are a "Work Items" LEVEL published into the enclosing hierarchical stack, so the
// harness mounts a RailHostBoundary — which, with no host above it, becomes the same standalone host a
// feature site gives the feature — so the
// level renders as a real rail whose rows are the views. A stateful leaf deep-links the active view
// the way ResourceExplorer's URL leaf would; `onSelectSpy` records the chosen view id.
//
// `view` seeds that leaf. It defaults to "list" because most tests below are about the editor and
// the optimistic move and just need SOME view on screen — the stack itself never auto-selects one
// (the first test asserts exactly that).
function Harness({
  onSelectSpy,
  view = "list",
  workspaceSlug,
}: {
  onSelectSpy?: (leafId: string | null, opts?: { replace?: boolean }) => void;
  view?: string | null;
  /** The workspace whose ITERATIONS the surface offers; the hosts always supply one. */
  workspaceSlug?: string;
}) {
  const [leafId, setLeafId] = useState<string | null>(view);
  const leaf: TopicLeaf = {
    leafId,
    // The spy records the OPTIONS too: a real leaf routes, so whether the stack asked to replace
    // or to push is part of what this surface must forward, not an implementation detail.
    onSelect: (id, opts) => {
      onSelectSpy?.(id, opts);
      setLeafId(id);
    },
  };
  return (
    <RailHostBoundary>
      <WorkItemsSurface
        projectId="p1"
        title="Work Items"
        leaf={leaf}
        workspaceSlug={workspaceSlug}
      />
    </RailHostBoundary>
  );
}

describe("WorkItemsSurface", () => {
  it("publishes the five views as a topic list and lands on List", async () => {
    const onSelectSpy = vi.fn();
    render(<Harness view={null} onSelectSpy={onSelectSpy} />);

    // The views are rows of a published rail — a LEVEL of the one stack — not a tab bar in the leaf.
    const rail = await screen.findByRole("complementary", { name: "Topic list" });
    for (const label of ["List", "Board", "Table", "Timeline", "Calendar"]) {
      expect(within(rail).getByRole("button", { name: label })).not.toBeNull();
    }

    // The level names List as its `defaultSelectedId`, so opening Work Items lands there instead of
    // on a pane asking which view you want. It arrives as a NORMAL selection — the leaf is routed
    // through `leaf.onSelect`, exactly as if the row had been clicked — except that it asks to
    // REPLACE: the bare topic it supersedes was never a state the user chose or saw, so leaving a
    // Back stop on it would make one click cost two Back presses.
    expect(onSelectSpy).toHaveBeenCalledWith("list", { replace: true });
    expect(await screen.findByRole("grid", { name: "Work items" })).not.toBeNull();
    expect(screen.queryByText(/select a view/i)).toBeNull();
    expect(within(rail).getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("switches to the Board view from the rail row, calling leaf.onSelect('board')", async () => {
    const onSelectSpy = vi.fn();
    render(<Harness onSelectSpy={onSelectSpy} />);
    await listLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Board" }));

    // A CLICK carries no options — it is a state the user asked for, so it earns its own history
    // entry. Only the stack's own auto-applied default asks to replace.
    expect(onSelectSpy).toHaveBeenCalledWith("board", undefined);

    // The Board columns are now rendered (in position order), the List grid gone. Scoped to the
    // board: the rail's own rows are <li>s too, so an unscoped listitem query would sweep them in.
    const board = await screen.findByRole("list", { name: "Board columns" });
    const cols = within(board).getAllByRole("listitem");
    expect(cols.map((c) => c.getAttribute("aria-label"))).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);
    expect(screen.queryByRole("grid", { name: "Work items" })).toBeNull();
  });

  it("loads the shared query only ONCE across a view switch", async () => {
    render(<Harness />);
    await listLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    await screen.findByRole("listitem", { name: "To do" });

    // The items are owned by the surface and keyed on projectId, so switching the VIEW does not
    // re-fetch: exactly one listForProject across the switch.
    expect(listForProject).toHaveBeenCalledTimes(1);
    expect(listForProject).toHaveBeenCalledWith("p1");
  });

  // The two PLANNING values the surface loads for its views: the WORKSPACE's cycles (one list
  // answers every board its owner runs) and the PROJECT's estimate scale (what a size means here).
  it("asks for the WORKSPACE's iterations, not the project's", async () => {
    render(<Harness workspaceSlug="acme" />);
    await listLoaded();

    await waitFor(() => expect(iterationsList).toHaveBeenCalledWith({ workspace: "acme" }));
  });

  it("offers the workspace's cycles and the project's scale in the editor", async () => {
    iterationsList.mockResolvedValue([structuredClone(CYCLE)]);
    projectGet.mockResolvedValue({ ...structuredClone(PROJECT), estimateScale: "fibonacci" });

    render(<Harness view="table" workspaceSlug="acme" />);
    // Table opens the editor on a double-click (a single click selects).
    fireEvent.doubleClick(await screen.findByText("Design the landing page"));
    await screen.findByRole("button", { name: "Save changes" });

    const iteration = (await screen.findByLabelText("Iteration")) as HTMLSelectElement;
    expect(within(iteration).getByRole("option", { name: /Sprint 7/ })).not.toBeNull();
    // The card is uncommitted, so the picker sits on the backlog rather than inventing a cycle.
    expect(iteration.value).toBe("");

    // The scale came from the project's own record — a `none` project has no such field at all.
    expect(await screen.findByLabelText("Estimate")).not.toBeNull();
  });

  it("has no estimate field on a project that does not estimate", async () => {
    render(<Harness view="table" workspaceSlug="acme" />);
    fireEvent.doubleClick(await screen.findByText("Design the landing page"));
    await screen.findByRole("button", { name: "Save changes" });

    expect(screen.queryByLabelText("Estimate")).toBeNull();
  });

  it("creates via a MODAL from the list header's +, then opens the new item's detail", async () => {
    render(<Harness />);
    await listLoaded();

    // The `+` on the Work Items list header opens a modal — the stack's create metaphor. The leaf is
    // NOT swapped for a blank editor: a detail always shows a real, selected record.
    fireEvent.click(screen.getByRole("button", { name: /new work item/i }));
    const modal = await screen.findByRole("dialog", { name: "New work item" });

    // The List view is still behind the modal (the leaf was never replaced).
    expect(screen.getByRole("grid", { name: "Work items" })).not.toBeNull();

    // The modal asks only for what PLACES the record; the rest belongs to its detail.
    fireEvent.change(within(modal).getByLabelText("Title"), {
      target: { value: "Ship the beta" },
    });
    // The save reloads the list from the server, which now HAS the row (the create persisted it) —
    // that reload is what puts the new item in the views.
    listForProject.mockResolvedValue([
      structuredClone(W1),
      structuredClone(W2),
      item({ id: "w3", title: "Ship the beta", statusId: "s1" }),
    ]);
    fireEvent.click(within(modal).getByRole("button", { name: /^(Create|Save)$/ }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ title: "Ship the beta" }),
      ),
    );

    // The created record now HAS a detail, so it opens — the rest of the fields live there.
    expect(await screen.findByRole("button", { name: "Save changes" })).not.toBeNull();
  });

  it("clears the assignee IN PLACE from the List row, committing update(null, null)", async () => {
    // The List view is a list-with-details and edits rows in place — it no longer hands off to the
    // editor. Emptying the assignee must still send an EXPLICIT null pair (a clear), not omit it.
    render(<Harness />);
    await listLoaded();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Assignee — Design the landing page" }),
      { target: { value: "" } },
    );
    // The row went dirty, so its commit pair appeared; ✓ writes the patch.
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes work item Design the landing page" }),
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "w1",
        expect.objectContaining({ assigneeKind: null, assigneeId: null }),
      ),
    );
  });

  it("moves a card to another status (optimistic) and repaints it under the new column", async () => {
    render(<Harness view="board" />);
    await screen.findByRole("listitem", { name: "To do" });

    fireEvent.change(screen.getByRole("combobox", { name: "Move Design the landing page" }), {
      target: { value: "s2" },
    });

    await waitFor(() => expect(update).toHaveBeenCalledWith("w1", { statusId: "s2" }));

    // The shared items updated, so the card now sits under In progress…
    within(screen.getByRole("listitem", { name: "In progress" })).getByText(
      "Design the landing page",
    );
    // …and no longer under To do.
    expect(
      within(screen.getByRole("listitem", { name: "To do" })).queryByText(
        "Design the landing page",
      ),
    ).toBeNull();
  });

  it("reverts the card and shows an error when the move fails", async () => {
    update.mockRejectedValueOnce(new Error("boom"));
    render(<Harness view="board" />);
    await screen.findByRole("listitem", { name: "To do" });

    fireEvent.change(screen.getByRole("combobox", { name: "Move Design the landing page" }), {
      target: { value: "s2" },
    });

    await waitFor(() => expect(update).toHaveBeenCalledWith("w1", { statusId: "s2" }));

    // Reverted to the source column…
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "To do" })).getByText(
        "Design the landing page",
      ),
    );
    // …no longer under In progress…
    expect(
      within(screen.getByRole("listitem", { name: "In progress" })).queryByText(
        "Design the landing page",
      ),
    ).toBeNull();
    // …and the failure surfaces inline.
    await screen.findByText("boom");
  });

  it("a stale FAILED move never clobbers a newer move on the same card", async () => {
    // update #1 (the first move) will REJECT; update #2 (the newer move) will RESOLVE.
    let rejectMove1!: (e: Error) => void;
    let resolveMove2!: () => void;
    let calls = 0;
    update.mockImplementation((id, patch) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<WorkItem>((_res, rej) => {
          rejectMove1 = rej;
        });
      }
      return new Promise<WorkItem>((res) => {
        resolveMove2 = () => res({ ...structuredClone(W1), id, ...patch } as WorkItem);
      });
    });

    render(<Harness view="board" />);
    await screen.findByRole("listitem", { name: "To do" });

    const combo = () => screen.getByRole("combobox", { name: "Move Design the landing page" });

    // Move 1: To do → In progress (update #1 in flight).
    fireEvent.change(combo(), { target: { value: "s2" } });
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "In progress" })).getByText(
        "Design the landing page",
      ),
    );

    // Move 2: In progress → Done (update #2 in flight), BEFORE move 1 has settled.
    fireEvent.change(combo(), { target: { value: "s3" } });
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "Done" })).getByText(
        "Design the landing page",
      ),
    );

    // The STALE move 1 now fails. Its guarded revert must be a NO-OP — the card sits at
    // the newer target (Done), not move 1's target (In progress), so it is not reverted.
    await act(async () => {
      rejectMove1(new Error("stale boom"));
    });
    within(screen.getByRole("listitem", { name: "Done" })).getByText("Design the landing page");
    expect(
      within(screen.getByRole("listitem", { name: "To do" })).queryByText(
        "Design the landing page",
      ),
    ).toBeNull();

    // Move 2 then resolves and reconciles cleanly — the card stays under Done.
    await act(async () => {
      resolveMove2();
    });
    within(screen.getByRole("listitem", { name: "Done" })).getByText("Design the landing page");
  });

  it("a both-failed overlapping move reconciles to the server's true status, not the stale intermediate", async () => {
    // update #1 (move A→B) and update #2 (move B→C) BOTH reject.
    let rejectMove1!: (e: Error) => void;
    let rejectMove2!: (e: Error) => void;
    let calls = 0;
    update.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise<WorkItem>((_res, rej) => {
          rejectMove1 = rej;
        });
      }
      return new Promise<WorkItem>((_res, rej) => {
        rejectMove2 = rej;
      });
    });
    // The server's authoritative row for the card never actually moved (both PATCHes
    // failed) — get() keeps returning the original To-do row throughout.
    get.mockResolvedValue(structuredClone(W1));

    render(<Harness view="board" />);
    await screen.findByRole("listitem", { name: "To do" });

    const combo = () => screen.getByRole("combobox", { name: "Move Design the landing page" });

    // Move 1: To do → In progress (update #1 in flight).
    fireEvent.change(combo(), { target: { value: "s2" } });
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "In progress" })).getByText(
        "Design the landing page",
      ),
    );

    // Move 2: In progress → Done (update #2 in flight), BEFORE move 1 has settled.
    fireEvent.change(combo(), { target: { value: "s3" } });
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "Done" })).getByText(
        "Design the landing page",
      ),
    );

    // The STALE move 1 fails first. Its guarded reconcile is a no-op — the card no longer
    // sits at move 1's target ("In progress") — so it stays at Done for now.
    await act(async () => {
      rejectMove1(new Error("move1 failed"));
    });
    within(screen.getByRole("listitem", { name: "Done" })).getByText("Design the landing page");

    // Move 2 (the newer move) ALSO fails. Both PATCHes are now settled and BOTH failed, so
    // the card must land on the SERVER's true status (To do) — NOT move 1's stale
    // intermediate optimistic value ("In progress"), which the server never persisted.
    await act(async () => {
      rejectMove2(new Error("move2 failed"));
    });
    await waitFor(() =>
      within(screen.getByRole("listitem", { name: "To do" })).getByText(
        "Design the landing page",
      ),
    );
    expect(
      within(screen.getByRole("listitem", { name: "In progress" })).queryByText(
        "Design the landing page",
      ),
    ).toBeNull();
    expect(
      within(screen.getByRole("listitem", { name: "Done" })).queryByText(
        "Design the landing page",
      ),
    ).toBeNull();
  });
});
