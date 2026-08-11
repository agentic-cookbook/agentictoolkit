// @vitest-environment jsdom
//
// Component test for IterationsPane — the workspace's time-boxes as a master/detail topic.
//
// Only the api-client boundary is mocked, so the pane runs on the REAL master/detail substrate
// (published rail level, URL-driven selection, ButtonBar, delete confirm) and the real
// useResourceList. Three properties get the attention here, because each is a claim the pane
// makes that a screenshot cannot check:
//
//   1. The boxes are the WORKSPACE's. Every read is asserted to carry the workspace, and the
//      cards list is asserted to show a board OTHER than the one the pane was reached through —
//      the whole point of the feature, and the first thing a well-meaning "filter to this
//      project" change would break.
//   2. Open vs done is read from the status CATEGORY, never a status name. The fixtures use a
//      board whose columns are named nothing like their categories, so any code that pattern-
//      matches on the label counts the wrong cards.
//   3. The rollover's button says how many cards it will move, and that number is the same one
//      the server reports back — the count under the button and the sweep cannot disagree.
//
// Each test takes its own workspace slug (`ws()`), which separates the per-workspace list keys.
// The CARDS list is keyed by iteration id alone and cannot be separated that way; what isolates it
// is the package's `vitest-setup` teardown, which empties the module-scope query cache between
// tests — without it a list seeded here is painted unchanged in the next test, since cached rows
// inside `staleTime` are served without a re-read.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectIterationsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    workItems: vi.fn(),
    rollover: vi.fn(),
  },
}));

import { IterationsPane } from "./IterationsPane";
import {
  projectIterationsApi,
  type Iteration,
  type IterationWorkItem,
} from "@agentic-toolkit/data/projects";
import { RailHostBoundary, type TopicLeaf } from "@agentic-toolkit/resource";

const list = vi.mocked(projectIterationsApi.list);
const create = vi.mocked(projectIterationsApi.create);
const update = vi.mocked(projectIterationsApi.update);
const remove = vi.mocked(projectIterationsApi.remove);
const workItems = vi.mocked(projectIterationsApi.workItems);
const rollover = vi.mocked(projectIterationsApi.rollover);

/** A fresh workspace slug per test, so no test seeds the next one's first paint. */
let wsCounter = 0;
const ws = () => `acme-${++wsCounter}`;

function iteration(over: Partial<Iteration>): Iteration {
  return {
    id: "it1",
    name: "Sprint 7",
    description: "",
    startDate: "2026-08-03",
    endDate: "2026-08-16",
    state: "active",
    ownerKind: "customer",
    ownerId: "cust-1",
    ecosystemId: "eco-1",
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
    ...over,
  };
}

/** A card in the box. The status LABELS are deliberately nothing like their categories: a board
 *  may call its terminal column "Shipped" and its first one "Icebox", and the pane's counts must
 *  still come out right. */
function card(over: Partial<IterationWorkItem>): IterationWorkItem {
  return {
    id: "w1",
    projectId: "p1",
    itemKey: "WEB-1",
    title: "Design the landing page",
    description: "",
    statusId: "s1",
    assigneeKind: null,
    assigneeId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    iterationId: "it1",
    estimate: null,
    rank: "a0",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    projectName: "Website",
    statusName: "Icebox",
    statusCategory: "backlog",
    // The board's own scale, which defaults to "does not estimate" for the same reason the
    // column does: a size rollup must stay silent until some board opts in.
    estimateScale: "none",
    // The board's RANKING setting, carried per row for the same reason the estimate scale is: a
    // box holds cards from several boards, and each row's rank means what ITS board says.
    priorityScale: "standard",
    ...over,
  };
}

const SPRINT_7 = iteration({});
const SPRINT_8 = iteration({
  id: "it2",
  name: "Sprint 8",
  startDate: "2026-08-17",
  endDate: "2026-08-30",
  state: "upcoming",
});

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(SPRINT_7), structuredClone(SPRINT_8)]);
  workItems.mockResolvedValue([]);
  create.mockImplementation((input) =>
    Promise.resolve(iteration({ ...input, description: input.description ?? "", id: "it9" })),
  );
  update.mockImplementation((id, patch) =>
    Promise.resolve(iteration({ ...structuredClone(SPRINT_7), id, ...patch })),
  );
  remove.mockResolvedValue({ unassigned: 0 });
  rollover.mockResolvedValue({ moved: 0, toIterationId: null });
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

/** The pane's list is a published rail LEVEL, so the harness mounts a RailHostBoundary (with no
 *  host above it, that is the same standalone host a feature site gives the feature). A stateful
 *  leaf deep-links the open box the way ResourceExplorer's URL leaf would. */
function Harness({
  workspaceSlug,
  selected = null,
  onSelectSpy,
}: {
  workspaceSlug?: string;
  selected?: string | null;
  onSelectSpy?: (id: string | null) => void;
}) {
  const [leafId, setLeafId] = useState<string | null>(selected);
  const leaf: TopicLeaf = {
    leafId,
    onSelect: (id) => {
      onSelectSpy?.(id);
      setLeafId(id);
    },
  };
  return (
    <RailHostBoundary>
      <IterationsPane title="Iterations" leaf={leaf} workspaceSlug={workspaceSlug} />
    </RailHostBoundary>
  );
}

describe("IterationsPane", () => {
  it("publishes the WORKSPACE's boxes as a rail level, dated and stated", async () => {
    const slug = ws();
    render(<Harness workspaceSlug={slug} />);

    const rail = await screen.findByRole("complementary", { name: "Topic list" });
    const row = await within(rail).findByRole("button", { name: /Sprint 7/ });
    // The sublabel is the span first, then where the box sits relative to today — the span is what
    // tells two similarly-named cycles apart, and the state is DERIVED from it.
    expect(row.textContent).toContain("Aug 3 – Aug 16, 2026");
    expect(row.textContent).toContain("Active");
    expect(within(rail).getByRole("button", { name: /Sprint 8/ }).textContent).toContain(
      "Upcoming",
    );

    // Pinned to the workspace, exactly as the project list is. Without this the caller sees every
    // box their reach admits — cycles from a workspace they are merely a member of.
    expect(list).toHaveBeenCalledWith({ workspace: slug });
  });

  it("opens the selected box in the editor, seeded from the record", async () => {
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    expect(await screen.findByDisplayValue("Sprint 7")).not.toBeNull();
    expect(screen.getByDisplayValue("2026-08-03")).not.toBeNull();
    expect(screen.getByDisplayValue("2026-08-16")).not.toBeNull();
    // No state control anywhere: the server derives it from the dates, so a control here would
    // offer to set something the next read overwrites.
    expect(screen.queryByLabelText("State")).toBeNull();
  });

  it("shows the box's cards ACROSS boards, each labelled with the one it came from", async () => {
    workItems.mockResolvedValue([
      card({ id: "w1", itemKey: "WEB-1", title: "Design the landing page" }),
      card({
        id: "w2",
        itemKey: "API-9",
        title: "Rate-limit the ingest",
        projectId: "p2",
        projectName: "Platform API",
        statusName: "Shipped",
        statusCategory: "done",
      }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    // A card from a DIFFERENT board than the one this pane was reached through. This is the
    // feature, not a leak: an iteration belongs to the workspace.
    expect(await screen.findByText("Rate-limit the ingest")).not.toBeNull();
    expect(screen.getByText("Platform API")).not.toBeNull();
    expect(screen.getByText("API-9")).not.toBeNull();
    // The column, by name — the ids here come from as many status sets as there are boards.
    expect(screen.getByText("Shipped")).not.toBeNull();
    expect(screen.getByText("Icebox")).not.toBeNull();
  });

  it("counts open vs done by CATEGORY, not by what a board calls its columns", async () => {
    workItems.mockResolvedValue([
      // "Icebox" is a backlog card: not started is not finished, so it counts as open.
      card({ id: "w1", statusName: "Icebox", statusCategory: "backlog" }),
      card({ id: "w2", statusName: "Shipped", statusCategory: "done" }),
      // Canceled is out of play too — it is not "open work", it is work that stopped.
      card({ id: "w3", statusName: "Dropped", statusCategory: "canceled" }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    expect(await screen.findByText("3 cards")).not.toBeNull();
    expect(screen.getByText("2 done · 1 open")).not.toBeNull();
    // The button names the same number, so what it will do is legible before it is pressed.
    expect(screen.getByRole("button", { name: "Roll over 1 card" })).not.toBeNull();
  });

  it("sums sizes only when every board in the box uses ONE summable scale", async () => {
    workItems.mockResolvedValue([
      card({ id: "w1", estimate: 5, estimateScale: "fibonacci", statusCategory: "done" }),
      card({ id: "w2", estimate: 8, estimateScale: "fibonacci", statusCategory: "todo" }),
      // Unsized, and said so out loud: a total is only as good as how much of the box it covers.
      card({ id: "w3", estimate: null, estimateScale: "fibonacci", statusCategory: "todo" }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    expect(await screen.findByText("5 of 13 points done · 1 card unsized")).not.toBeNull();
  });

  it("refuses to add up sizes when the boards in the box disagree about the scale", async () => {
    workItems.mockResolvedValue([
      card({ id: "w1", estimate: 8, estimateScale: "fibonacci" }),
      card({ id: "w2", estimate: 3, estimateScale: "linear", projectName: "Platform API" }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    // 8 + 3 = 11 of nothing. The sentence names the scales rather than showing a number whose
    // unit does not exist.
    expect(
      await screen.findByText(
        "The boards in this iteration size on different scales (Fibonacci, Linear), so their sizes are not added up.",
      ),
    ).not.toBeNull();
    expect(screen.queryByText(/points done/)).toBeNull();
  });

  it("refuses to add up t-shirt sizes, which are ladder steps rather than amounts", async () => {
    workItems.mockResolvedValue([
      // XS is stored as 0, so a sum would report three small cards as no work at all.
      card({ id: "w1", estimate: 0, estimateScale: "tshirt" }),
      card({ id: "w2", estimate: 2, estimateScale: "tshirt" }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    expect(
      await screen.findByText(
        "T-shirt sizes are steps on a ladder rather than amounts, so they are not added up.",
      ),
    ).not.toBeNull();
  });

  it("says nothing about sizes when no board in the box estimates", async () => {
    workItems.mockResolvedValue([
      card({ id: "w1", statusCategory: "todo", statusName: "Next" }),
      card({ id: "w2", statusCategory: "done", statusName: "Shipped" }),
    ]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    // The card counts still stand — it is only the size line that stays silent, rather than a
    // "0 of 0 points" that reads like nobody finished anything.
    expect(await screen.findByText("1 done · 1 open")).not.toBeNull();
    expect(screen.queryByText(/points done/)).toBeNull();
    expect(screen.queryByText(/not added up/)).toBeNull();
  });

  it("rolls the unfinished cards into the chosen box and reports what moved", async () => {
    workItems.mockResolvedValue([
      card({ id: "w1", statusCategory: "in_progress", statusName: "Doing" }),
      card({ id: "w2", statusCategory: "todo", statusName: "Next" }),
    ]);
    rollover.mockResolvedValue({ moved: 2, toIterationId: "it2" });
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    const destination = (await screen.findByLabelText(
      "Move unfinished cards to",
    )) as HTMLSelectElement;
    // The current box is never its own destination, and the backlog is a real one rather than the
    // absence of a choice.
    expect(within(destination).getByRole("option", { name: "Backlog" })).not.toBeNull();
    expect(within(destination).getByRole("option", { name: "Sprint 8" })).not.toBeNull();
    expect(within(destination).queryByRole("option", { name: "Sprint 7" })).toBeNull();

    fireEvent.change(destination, { target: { value: "it2" } });
    fireEvent.click(screen.getByRole("button", { name: "Roll over 2 cards" }));

    await waitFor(() => expect(rollover).toHaveBeenCalledWith("it1", "it2"));
    // The server's own number, not the pane's optimistic guess: the cards left the list, so this
    // sentence is the only evidence the sweep happened.
    expect(await screen.findByText("Moved 2 cards to Sprint 8.")).not.toBeNull();
  });

  it("sends null — the backlog — when that is the destination", async () => {
    workItems.mockResolvedValue([card({ id: "w1", statusCategory: "todo", statusName: "Next" })]);
    rollover.mockResolvedValue({ moved: 1, toIterationId: null });
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Roll over 1 card" }));

    await waitFor(() => expect(rollover).toHaveBeenCalledWith("it1", null));
    expect(await screen.findByText("Moved 1 card to the backlog.")).not.toBeNull();
  });

  it("cannot roll over a box with nothing open, and says so on the button", async () => {
    workItems.mockResolvedValue([card({ id: "w1", statusCategory: "done", statusName: "Shipped" })]);
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    const button = await screen.findByRole("button", { name: "Nothing to roll over" });
    // Disabled rather than hidden: the control is part of what an iteration IS, and one that
    // disappears once the work is done reads as a feature that broke.
    expect(button).toHaveProperty("disabled", true);
  });

  it("saves an edit as a PATCH of the changed fields", async () => {
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    const name = await screen.findByDisplayValue("Sprint 7");
    fireEvent.change(name, { target: { value: "Sprint 7 (extended)" } });
    fireEvent.change(screen.getByDisplayValue("2026-08-16"), {
      target: { value: "2026-08-23" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("it1", {
        name: "Sprint 7 (extended)",
        description: "",
        startDate: "2026-08-03",
        endDate: "2026-08-23",
      }),
    );
  });

  it("refuses an inverted span before it reaches the server", async () => {
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    fireEvent.change(await screen.findByDisplayValue("2026-08-03"), {
      target: { value: "2026-09-01" },
    });

    // The reason rides next to the disabled Save (the substrate's `blockedReason`), so the user is
    // told WHY rather than left with a greyed-out button.
    expect(
      await screen.findByText("The end date cannot be before the start date."),
    ).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a name another live box already has", async () => {
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    fireEvent.change(await screen.findByDisplayValue("Sprint 7"), {
      target: { value: "sprint 8" },
    });

    // Case-insensitively, which is stricter than the database's exact-match uniqueness: this can
    // only warn early, never permit something the server would refuse with a 409.
    expect(
      await screen.findByText('An iteration named "sprint 8" already exists in this workspace.'),
    ).not.toBeNull();
  });

  it("says what deleting a box does to its cards", async () => {
    render(<Harness workspaceSlug={ws()} selected="it1" />);

    // Wait for the BOX, not for the button: the bar is on screen from the first paint with Delete
    // disabled, so a click issued before the list lands is dropped on a disabled control and the
    // confirm never opens. What makes Delete live is having a row to delete.
    await screen.findByDisplayValue("Sprint 7");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The sentence that makes this delete safe — and the reason it never refuses the way deleting
    // a board COLUMN must: "no iteration" is the backlog, an ordinary place for a card to be.
    expect(
      await screen.findByText(
        'Delete "Sprint 7"? Its cards are not deleted — they move back to the backlog.',
      ),
    ).not.toBeNull();
  });

  it("creates through a MODAL and opens the new box", async () => {
    const slug = ws();
    const onSelectSpy = vi.fn();
    render(<Harness workspaceSlug={slug} onSelectSpy={onSelectSpy} />);

    // The level's own "+" affordance, not a button in the leaf: creating belongs to the LIST.
    await screen.findByRole("complementary", { name: "Topic list" });
    fireEvent.click(screen.getByRole("button", { name: "New iteration" }));

    // Create is a MODAL over a real record, never a blank detail pane.
    const dialog = await screen.findByRole("dialog", { name: "New iteration" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Sprint 9" } });
    fireEvent.change(within(dialog).getByLabelText("Starts"), {
      target: { value: "2026-08-31" },
    });
    fireEvent.change(within(dialog).getByLabelText("Ends"), { target: { value: "2026-09-13" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        { name: "Sprint 9", description: "", startDate: "2026-08-31", endDate: "2026-09-13" },
        { workspace: slug },
      ),
    );
    // The record now exists, so it has a detail to show — the create modal only asked for what
    // places it.
    await waitFor(() => expect(onSelectSpy).toHaveBeenCalledWith("it9"));
  });
});
