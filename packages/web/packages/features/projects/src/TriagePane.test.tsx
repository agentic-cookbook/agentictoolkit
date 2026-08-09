// @vitest-environment jsdom
//
// Component test for TriagePane — the inbox of cards nobody has accepted onto the board yet.
//
// Only the api-client boundary is mocked, so the pane runs on the real rail host and the real
// useResourceList. Five properties carry the weight, and every one of them is a claim about a
// DECISION rather than about pixels:
//
//   1. The queue is one board's, read whole and NOT re-sorted. The server orders it oldest first,
//      which is the end a queue is worked from; a client-side sort by anything else would quietly
//      re-prioritise someone's inbox.
//   2. The landing column defaults to the board's FIRST, not the column the card was filed into.
//      The filed column is an accident of whatever created the card, and presenting it as a
//      decision already made is precisely what the inbox exists to withhold.
//   3. Accepting sends only what was ANSWERED. The accept route patches through the ordinary
//      work-item writer, where an explicit null CLEARS a field — so an unset picker must be
//      omitted, never nulled, or accepting a card would erase what the intake filled in.
//   4. Declining is accepting into a `canceled` column, and the button is ABSENT — not greyed — on
//      a board that has none, because there is nowhere honest to put the card.
//   5. The selection is cleared BEFORE the refetch. The accepted card has left the queue, so a
//      pane that refetched first would spend a frame pointing at a row that no longer exists.
//
// The module-scope useResourceList cache is keyed by project id and by workspace and OUTLIVES
// cleanup(), so every test below gets a fresh project id AND a fresh slug.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectTriageApi: { listForProject: vi.fn(), accept: vi.fn() },
  projectsApi: {
    statuses: { list: vi.fn() },
    participants: { list: vi.fn() },
    // The board's own record, for ONE field: the units an estimate is in.
    get: vi.fn(),
  },
  projectMilestonesApi: { list: vi.fn() },
  projectIterationsApi: { list: vi.fn() },
}));

import { TriagePane } from "./TriagePane";
import {
  projectIterationsApi,
  projectMilestonesApi,
  projectTriageApi,
  projectsApi,
  type Iteration,
  type Milestone,
  type Project,
  type ProjectParticipant,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { RailHostBoundary, type TopicLeaf } from "@agentic-toolkit/resource";

const listForProject = vi.mocked(projectTriageApi.listForProject);
const accept = vi.mocked(projectTriageApi.accept);
const statusesList = vi.mocked(projectsApi.statuses.list);
const participantsList = vi.mocked(projectsApi.participants.list);
const projectGet = vi.mocked(projectsApi.get);
const milestonesList = vi.mocked(projectMilestonesApi.list);
const iterationsList = vi.mocked(projectIterationsApi.list);

function status(over: Partial<ProjectStatus>): ProjectStatus {
  return {
    id: "s",
    projectId: "p1",
    key: "k",
    label: "L",
    category: "todo",
    position: 0,
    createdAt: "2026-08-01T00:00:00Z",
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
    milestoneId: null,
    estimate: null,
    rank: "V0",
    // What puts it in this pane at all: the queue IS the cards with no stamp.
    triagedAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

/** The board's columns in the server's own order (by position), because `statuses[0]` — the
 *  default landing column — only means "the board's first" if this list is that order. */
const TODO = status({ id: "s1", key: "todo", label: "To do", category: "todo", position: 0 });
const DOING = status({
  id: "s2",
  key: "doing",
  label: "In progress",
  category: "in_progress",
  position: 1,
});
const DONE = status({ id: "s3", key: "done", label: "Done", category: "done", position: 2 });
const CANCELED = status({
  id: "s4",
  key: "canceled",
  label: "Won't do",
  category: "canceled",
  position: 3,
});

const MILESTONE: Milestone = {
  id: "ms1",
  projectId: "p1",
  name: "Beta",
  description: "",
  targetDate: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, done: 0, canceled: 0 },
  ecosystemId: "eco-1",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const CYCLE: Iteration = {
  id: "it1",
  name: "Sprint 7",
  description: "",
  startDate: "2026-08-01",
  endDate: "2026-08-14",
  state: "active",
  ownerKind: "customer",
  ownerId: "cust-1",
  ecosystemId: "eco-1",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const PARTICIPANT: ProjectParticipant = {
  id: "pp1",
  projectId: "p1",
  participantKind: "customer",
  participantId: "cust-1",
  role: "member",
  addedBy: null,
  addedAt: "2026-08-01T00:00:00Z",
};

/** Ages are asserted through `relativeTime`, which reads the wall clock — so the fixtures are
 *  built RELATIVE to now rather than pinned to a date, which would drift into "2 years ago". */
const DAYS_AGO_3 = new Date(Date.now() - 3 * 86_400_000).toISOString();
const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();

/** A fresh project id AND workspace slug per test — see the cache note at the top. */
let n = 0;
let projectId = "";
let slug = "";
let ANCIENT: WorkItem;
let RECENT: WorkItem;

beforeEach(() => {
  vi.clearAllMocks();
  n += 1;
  projectId = `p-${n}`;
  slug = `acme-${n}`;
  ANCIENT = item({
    id: `w-${n}-1`,
    title: "Login is broken on Safari",
    description: "It just spins.",
    // Filed into the board's LAST column by whatever created it — the accident the pane refuses
    // to treat as a decision.
    statusId: DONE.id,
    labels: ["bug"],
    createdAt: DAYS_AGO_3,
  });
  RECENT = item({ id: `w-${n}-2`, title: "Add a dark mode", createdAt: HOUR_AGO });
  listForProject.mockResolvedValue([structuredClone(ANCIENT), structuredClone(RECENT)]);
  statusesList.mockResolvedValue([TODO, DOING, DONE, CANCELED].map((s) => structuredClone(s)));
  participantsList.mockResolvedValue([structuredClone(PARTICIPANT)]);
  milestonesList.mockResolvedValue([]);
  iterationsList.mockResolvedValue([]);
  projectGet.mockResolvedValue({ estimateScale: "none" } as Project);
  accept.mockImplementation((ref) =>
    Promise.resolve(item({ id: String(ref), triagedAt: new Date().toISOString() })),
  );
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

/** The queue is a published rail LEVEL, so the harness mounts a RailHostBoundary. A stateful leaf
 *  deep-links the open card the way ResourceExplorer's URL leaf would. */
function Harness({
  selected = null,
  onSelectSpy,
}: {
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
      <TriagePane projectId={projectId} title="Triage" leaf={leaf} workspaceSlug={slug} />
    </RailHostBoundary>
  );
}

describe("TriagePane", () => {
  it("publishes this board's inbox oldest first, aged, and does not re-sort it", async () => {
    render(<Harness />);

    const rail = await screen.findByRole("complementary", { name: "Topic list" });
    const rows = await within(rail).findAllByRole("button", { name: /Filed/ });

    // The order the server sent, held. A queue is worked from the end that has been waiting
    // longest, so any client-side re-sort — by priority, by title, by column — silently
    // re-prioritises someone else's inbox.
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Login is broken on Safari");
    expect(rows[1]!.textContent).toContain("Add a dark mode");

    // The AGE leads, because it is what decides which card to open; the column it was filed into
    // is context, and deliberately the smaller half of the line.
    expect(rows[0]!.textContent).toContain("Filed 3 days ago");
    expect(rows[0]!.textContent).toContain("Done");
    expect(rows[1]!.textContent).toContain("Filed 1 hour ago");

    // One board's inbox, addressed by that board. The cross-board queue is a different read.
    expect(listForProject).toHaveBeenCalledWith(projectId);
  });

  it("shows the card as evidence, read-only — there is nothing to edit yet", async () => {
    render(<Harness selected={ANCIENT.id} />);

    // By role, because the rail row beside it carries the same words — the heading is the card
    // itself, the row is the queue entry pointing at it.
    expect(
      await screen.findByRole("heading", { name: "Login is broken on Safari" }),
    ).not.toBeNull();
    expect(screen.getByText("It just spins.")).not.toBeNull();
    expect(screen.getByText("bug")).not.toBeNull();

    // The question on this screen is whether the card belongs here; its title and body are the
    // EVIDENCE for that, not the subject of it. An editable title would invite rewriting the
    // report before deciding whether to accept it.
    expect(screen.queryByDisplayValue("Login is broken on Safari")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("defaults the landing column to the board's FIRST, not the one it was filed into", async () => {
    render(<Harness selected={ANCIENT.id} />);

    // ANCIENT was filed into Done. Offering that back as the pre-selected answer would make the
    // inbox rubber-stamp whatever the intake guessed, which is the one thing it exists to stop.
    // Anchored, because a Field's accessible label is its caption PLUS its hint.
    const column = (await screen.findByLabelText(/^Column/)) as HTMLSelectElement;
    expect(column.value).toBe(TODO.id);
  });

  it("accepts with a body that OMITS every unanswered field", async () => {
    render(<Harness selected={ANCIENT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept onto the board" }));

    // Exactly the column, and nothing else. `toHaveBeenCalledWith` is exact, so an `assigneeId:
    // null` or `estimate: null` added "for completeness" fails here — and it would CLEAR whatever
    // the intake had filled in, because the accept route patches through the ordinary writer.
    await waitFor(() => expect(accept).toHaveBeenCalledWith(ANCIENT.id, { statusId: TODO.id }));
  });

  it("carries the placement decided in the same breath", async () => {
    milestonesList.mockResolvedValue([structuredClone(MILESTONE)]);
    iterationsList.mockResolvedValue([structuredClone(CYCLE)]);
    projectGet.mockResolvedValue({ estimateScale: "points" } as Project);
    render(<Harness selected={ANCIENT.id} />);

    fireEvent.change(await screen.findByLabelText(/^Column/), { target: { value: DOING.id } });
    fireEvent.change(screen.getByLabelText("Milestone"), { target: { value: MILESTONE.id } });
    fireEvent.change(screen.getByLabelText("Iteration"), { target: { value: CYCLE.id } });
    // The scale arrives from the board's own record, so the control appears only once it has.
    fireEvent.change(await screen.findByLabelText("Estimate"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept onto the board" }));

    // "This belongs here" and "and it goes there" are one thought, so they are one request —
    // and the estimate crosses as a NUMBER, decoded from the picker's string by the one codec.
    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(ANCIENT.id, {
        statusId: DOING.id,
        milestoneId: MILESTONE.id,
        iterationId: CYCLE.id,
        estimate: 5,
      }),
    );
  });

  it("declines by accepting into the board's canceled column", async () => {
    render(<Harness selected={ANCIENT.id} />);

    const decline = await screen.findByRole("button", { name: "Decline to Won't do" });
    // Asserted BEFORE the click: accepting clears the selection, so the decision unmounts and
    // every sentence on it goes with it.
    expect(
      screen.getByText("Declining keeps the card, in a canceled column — it never disappears."),
    ).not.toBeNull();
    fireEvent.click(decline);

    // There is no `decline` endpoint and no delete: a declined card stays findable and says what
    // happened to it, which a deletion answers neither. The verb is the same one, aimed elsewhere.
    await waitFor(() => expect(accept).toHaveBeenCalledWith(ANCIENT.id, { statusId: CANCELED.id }));
  });

  it("omits Decline entirely on a board with no canceled column, and says why", async () => {
    statusesList.mockResolvedValue([TODO, DOING, DONE].map((s) => structuredClone(s)));
    render(<Harness selected={ANCIENT.id} />);

    await screen.findByRole("button", { name: "Accept onto the board" });
    // Absent, not greyed. A disabled button implies a capability that exists and is momentarily
    // unavailable; here there is simply nowhere honest to file a decline, and the sentence beside
    // it is what a greyed control could never say.
    expect(screen.queryByRole("button", { name: /^Decline/ })).toBeNull();
    expect(
      screen.getByText("This board has no canceled column, so there is nowhere to file a decline."),
    ).not.toBeNull();
  });

  it("clears the selection BEFORE refetching, so the pane never points at a card that has left", async () => {
    const onSelectSpy = vi.fn();
    render(<Harness selected={ANCIENT.id} onSelectSpy={onSelectSpy} />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept onto the board" }));

    await waitFor(() => expect(onSelectSpy).toHaveBeenCalledWith(null));
    // And the queue is re-read, because the card has left it — the board's own list is not this
    // pane's cache key to invalidate, so nothing else here is refetched.
    await waitFor(() => expect(listForProject).toHaveBeenCalledTimes(2));
  });

  it("says the inbox is clear rather than leaving the pane blank", async () => {
    listForProject.mockResolvedValue([]);
    render(<Harness />);

    // The ordinary state for most boards: nothing lands in the queue unless a caller asks for it.
    // A blank pane there reads as a load that failed.
    expect(await screen.findByText("Nothing is waiting to be triaged.")).not.toBeNull();
  });

  it("reads the same statuses and participants the board does, and the WORKSPACE's cycles", async () => {
    render(<Harness selected={ANCIENT.id} />);

    await screen.findByRole("button", { name: "Accept onto the board" });
    // The board's vocabulary comes from the board — under the same cache keys the Work Items
    // surface fills, so a column renamed there is what this offers rather than a stale copy.
    expect(statusesList).toHaveBeenCalledWith(projectId);
    expect(participantsList).toHaveBeenCalledWith(projectId);
    expect(milestonesList).toHaveBeenCalledWith(projectId);
    // Cycles are the exception, and the reason is real: an iteration belongs to the WORKSPACE, so
    // scoping this read to the board would offer a card no cycle to join.
    expect(iterationsList).toHaveBeenCalledWith({ workspace: slug });
  });
});
