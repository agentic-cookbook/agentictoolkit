// @vitest-environment jsdom
//
// Component test for MilestonesPane — the PROJECT's own plan as a master/detail topic.
//
// Only the api-client boundary is mocked, so the pane runs on the REAL master/detail substrate
// (published rail level, URL-driven selection, ButtonBar, delete confirm) and the real
// useResourceList. Three properties carry the weight here, because each is a claim the pane makes
// that a screenshot cannot check:
//
//   1. The plan is the BOARD's. Every read is asserted to carry the projectId — the mirror image
//      of IterationsPane's workspace assertion, and the first thing a well-meaning "milestones are
//      just short iterations" change would break.
//   2. Progress comes from the SERVER's counts through `milestoneProgress`, never from the rows on
//      screen. The fixtures give a milestone counts that do NOT match its visible cards (a card
//      this caller cannot see), and the bar still quotes the server.
//   3. Canceled cards are outside the bar in both halves, and the sublabel's "overdue" is a claim
//      about UNFINISHED work rather than about the calendar alone.
//
// The module-scope useResourceList cache is keyed by projectId and OUTLIVES cleanup(), so each
// test below takes its own project id (`pid()`); the hook always refetches on mount, so a shared
// key would only ever affect a first paint, but the tests that assert on an empty or different
// list would be the ones to suffer it.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectMilestonesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  // The detail's card list and the column names it badges them with.
  projectWorkItemsApi: { listForProject: vi.fn() },
  projectsApi: { statuses: { list: vi.fn() } },
}));

import { MilestonesPane, milestoneSublabel } from "./MilestonesPane";
import {
  projectMilestonesApi,
  projectWorkItemsApi,
  projectsApi,
  type Milestone,
  type MilestoneCounts,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { RailHostBoundary, type TopicLeaf } from "@agentic-toolkit/resource";

const list = vi.mocked(projectMilestonesApi.list);
const create = vi.mocked(projectMilestonesApi.create);
const update = vi.mocked(projectMilestonesApi.update);
const remove = vi.mocked(projectMilestonesApi.remove);
const listForProject = vi.mocked(projectWorkItemsApi.listForProject);
const statusesList = vi.mocked(projectsApi.statuses.list);

/** A fresh project id per test, so no test seeds the next one's first paint. */
let pidCounter = 0;
const pid = () => `p-${++pidCounter}`;

function counts(over: Partial<MilestoneCounts> = {}): MilestoneCounts {
  return { backlog: 0, todo: 0, in_progress: 0, done: 0, canceled: 0, ...over };
}

function milestone(over: Partial<Milestone>): Milestone {
  return {
    id: "ms1",
    projectId: "p1",
    name: "Public beta",
    description: "",
    targetDate: "2026-09-01",
    counts: counts({ todo: 1, done: 1 }),
    ecosystemId: "eco-1",
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
    ...over,
  };
}

function card(over: Partial<WorkItem>): WorkItem {
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
    iterationId: null,
    milestoneId: "ms1",
    estimate: null,
    rank: "a0",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

/** The board's columns. Named nothing like their categories, the way IterationsPane's are, so a
 *  badge that pattern-matched on the label would show the wrong thing. */
const COLUMNS: ProjectStatus[] = [
  { id: "s1", projectId: "p1", key: "icebox", label: "Icebox", category: "backlog", position: 0, createdAt: "2026-07-03T00:00:00Z" },
  { id: "s2", projectId: "p1", key: "shipped", label: "Shipped", category: "done", position: 1, createdAt: "2026-07-03T00:00:00Z" },
];

const BETA = milestone({});
const GA = milestone({ id: "ms2", name: "GA", targetDate: "2026-12-01", counts: counts() });

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(BETA), structuredClone(GA)]);
  listForProject.mockResolvedValue([]);
  statusesList.mockResolvedValue(structuredClone(COLUMNS));
  create.mockImplementation((_projectId, input) =>
    Promise.resolve(milestone({ ...input, description: input.description ?? "", id: "ms9" })),
  );
  update.mockImplementation((_projectId, id, patch) =>
    Promise.resolve(milestone({ ...structuredClone(BETA), id, ...patch })),
  );
  remove.mockResolvedValue({ unassigned: 0 });
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

/** The pane's list is a published rail LEVEL, so the harness mounts a RailHostBoundary (with no
 *  host above it, that is the same standalone host a feature site gives the feature). A stateful
 *  leaf deep-links the open point the way ResourceExplorer's URL leaf would. */
function Harness({
  projectId,
  selected = null,
  onSelectSpy,
}: {
  projectId: string;
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
      <MilestonesPane title="Milestones" leaf={leaf} projectId={projectId} />
    </RailHostBoundary>
  );
}

describe("MilestonesPane", () => {
  it("publishes the BOARD's plan as a rail level, dated and counted", async () => {
    const id = pid();
    render(<Harness projectId={id} />);

    const rail = await screen.findByRole("complementary", { name: "Topic list" });
    const row = await within(rail).findByRole("button", { name: /Public beta/ });
    expect(row.textContent).toContain("Sep 1, 2026");
    expect(row.textContent).toContain("1/2 done");

    // Pinned to the PROJECT, where the iterations pane pins to the workspace. That difference is
    // the feature: a plan belongs to one board, so there is no workspace-wide milestone list to
    // leak from.
    expect(list).toHaveBeenCalledWith(id);
  });

  it("opens the selected point in the editor, seeded from the record", async () => {
    render(<Harness projectId={pid()} selected="ms1" />);

    expect(await screen.findByDisplayValue("Public beta")).not.toBeNull();
    expect(screen.getByDisplayValue("2026-09-01")).not.toBeNull();
    // No start date: a milestone is a POINT, not a span. A second date control here would quietly
    // turn it into a second kind of iteration.
    expect(screen.queryByLabelText("Starts")).toBeNull();
    // …and no progress control: the counts are derived from the cards, so a field here would offer
    // to set something the next read overwrites.
    expect(screen.queryByLabelText("Progress")).toBeNull();
  });

  it("shows the cards counting toward the point, badged with their board's column name", async () => {
    listForProject.mockResolvedValue([
      card({ id: "w1", itemKey: "WEB-1", title: "Design the landing page", statusId: "s1" }),
      card({ id: "w2", itemKey: "WEB-2", title: "Ship the pricing page", statusId: "s2" }),
      // A card aimed at the OTHER point — the list is per-milestone, not the whole board.
      card({ id: "w3", itemKey: "WEB-3", title: "Localise the docs", milestoneId: "ms2" }),
    ]);
    render(<Harness projectId={pid()} selected="ms1" />);

    expect(await screen.findByText("Design the landing page")).not.toBeNull();
    expect(screen.getByText("Ship the pricing page")).not.toBeNull();
    expect(screen.queryByText("Localise the docs")).toBeNull();
    expect(screen.getByText("Icebox")).not.toBeNull();
    expect(screen.getByText("Shipped")).not.toBeNull();
  });

  it("quotes the SERVER's counts for the bar, not the rows it can show", async () => {
    // The server counts four cards; this caller can see one. That gap is a permissions fact, not a
    // miscount — so the total stays the plan's real size and the rows stay what may be opened.
    // Deriving the bar from `cards.length` would silently shrink the plan to the reader's reach.
    list.mockResolvedValue([milestone({ counts: counts({ todo: 3, done: 1 }) })]);
    listForProject.mockResolvedValue([card({ id: "w1", statusId: "s2" })]);
    render(<Harness projectId={pid()} selected="ms1" />);

    expect(await screen.findByText("1 of 4 done")).not.toBeNull();
    expect(
      screen.getByRole("progressbar", {
        name: "25% of the cards counting toward Public beta are done",
      }),
    ).not.toBeNull();
  });

  it("leaves canceled cards OUT of the bar and says how many there are", async () => {
    // Both halves, which is the committed answer in `milestoneProgress`: a card nobody is going to
    // do is not outstanding work, and counting it as unfinished makes a finished plan read as
    // stalled forever. The count is the server's own tally rather than `rows − total`, because
    // those two are scoped differently and subtracting them would label a permissions gap as a
    // cancellation.
    list.mockResolvedValue([milestone({ counts: counts({ done: 2, canceled: 3 }) })]);
    render(<Harness projectId={pid()} selected="ms1" />);

    expect(await screen.findByText("2 of 2 done")).not.toBeNull();
    expect(screen.getByText("3 canceled")).not.toBeNull();
  });

  it("shows an empty plan point as 0 %, rather than hiding the bar", async () => {
    // A fresh milestone with no cards has not been achieved, it has not been populated — and a
    // missing bar reads as a broken pane.
    list.mockResolvedValue([milestone({ counts: counts() })]);
    render(<Harness projectId={pid()} selected="ms1" />);

    expect(await screen.findByText("0 of 0 done")).not.toBeNull();
    expect(screen.getByText("Nothing counts toward this milestone yet.")).not.toBeNull();
  });

  it("saves an edit as a PATCH of the changed fields", async () => {
    const id = pid();
    render(<Harness projectId={id} selected="ms1" />);

    fireEvent.change(await screen.findByDisplayValue("Public beta"), {
      target: { value: "Public beta (dated)" },
    });
    fireEvent.change(screen.getByDisplayValue("2026-09-01"), { target: { value: "2026-09-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(id, "ms1", {
        name: "Public beta (dated)",
        description: "",
        targetDate: "2026-09-15",
      }),
    );
  });

  it("clears a target date as an explicit null", async () => {
    // "" is the form's undated; null is the wire's. An omitted field would leave the date it was
    // being cleared of.
    const id = pid();
    render(<Harness projectId={id} selected="ms1" />);

    fireEvent.change(await screen.findByDisplayValue("2026-09-01"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(id, "ms1", {
        name: "Public beta",
        description: "",
        targetDate: null,
      }),
    );
  });

  it("refuses a name another live point on THIS board already has", async () => {
    render(<Harness projectId={pid()} selected="ms1" />);

    fireEvent.change(await screen.findByDisplayValue("Public beta"), { target: { value: "ga" } });

    // Case-insensitively, which is stricter than the database's exact-match uniqueness: this can
    // only warn early, never permit something the server would refuse with a 409. Scoped to the
    // board, because the same name on another board is fine.
    expect(
      await screen.findByText('A milestone named "ga" already exists in this project.'),
    ).not.toBeNull();
  });

  it("says what deleting a point does to its cards", async () => {
    render(<Harness projectId={pid()} selected="ms1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    // The sentence that makes this delete safe, and the reason it never refuses the way deleting a
    // board COLUMN must: "counts toward no milestone" is an ordinary state for a card.
    expect(
      await screen.findByText(
        'Delete "Public beta"? Its cards are not deleted — they stop counting toward any milestone.',
      ),
    ).not.toBeNull();
  });

  it("creates through a MODAL and opens the new point", async () => {
    const id = pid();
    const onSelectSpy = vi.fn();
    render(<Harness projectId={id} onSelectSpy={onSelectSpy} />);

    // The level's own "+" affordance, not a button in the leaf: creating belongs to the LIST.
    await screen.findByRole("complementary", { name: "Topic list" });
    fireEvent.click(screen.getByRole("button", { name: "New milestone" }));

    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "RC1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // Undated, and that travels as an explicit null: a plan point that has not been scheduled is
    // an ordinary state, so the modal must not require a date to get past it.
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(id, {
        name: "RC1",
        description: "",
        targetDate: null,
      }),
    );
    await waitFor(() => expect(onSelectSpy).toHaveBeenCalledWith("ms9"));
  });
});

// The rail row's second line. A pure fold, so it is tested directly rather than through eight
// renders — what matters is which FACTS it commits to, and "overdue" is the one that could be
// wrong in a way nobody notices.
describe("milestoneSublabel", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("leads with the date, then the progress", () => {
    expect(milestoneSublabel(milestone({ counts: counts({ todo: 1, done: 1 }) }))).toBe(
      "Sep 1, 2026 · 1/2 done",
    );
  });

  it("says an undated point is undated rather than leaving the line to start with a number", () => {
    expect(milestoneSublabel(milestone({ targetDate: null }))).toBe("No date · 1/2 done");
  });

  it("says OVERDUE in words, not only by colour", () => {
    // A rail sublabel has no room for a badge, and "this date has passed" is exactly the fact a
    // reader must not have to infer from a colour.
    const past = milestoneSublabel(
      milestone({ targetDate: "2020-01-01", counts: counts({ todo: 1 }) }),
    );
    expect(past).toContain("overdue");
  });

  it("never calls a FINISHED point overdue — the plan was met, the calendar moved", () => {
    const past = milestoneSublabel(
      milestone({ targetDate: "2020-01-01", counts: counts({ done: 2 }) }),
    );
    expect(past).not.toContain("overdue");
    expect(past).toContain("2/2 done");
  });

  it("does not call today overdue", () => {
    expect(milestoneSublabel(milestone({ targetDate: today }))).not.toContain("overdue");
  });

  it("says nothing about progress for a row whose counts did not travel", () => {
    // `counts: null` is "not reported here" (a PATCH answers with the bare row), NOT "no cards" —
    // reading it as zeros would show a busy milestone as empty.
    expect(milestoneSublabel(milestone({ counts: null }))).toBe("Sep 1, 2026");
  });
});
