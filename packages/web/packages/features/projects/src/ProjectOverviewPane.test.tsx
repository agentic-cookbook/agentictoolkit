// @vitest-environment jsdom
//
// Component test for ProjectOverviewPane — a project's front door: what it is, how the work
// stands, what material it holds, who is in it, and its own record behind a Disclosure. The hub's
// vitest config is node-only, so this file opts into jsdom via the docblock above and drives React
// with @testing-library/react. Only the api-client boundary (@agentic-toolkit/data/projects) is
// mocked, so the load → edit → save and the participant add/remove wiring are exercised, not the
// transport. @agentic-toolkit/data is deliberately NOT mocked: the summary lists run through the
// REAL useResourceList, including its module-scope cache.
//
// That cache is keyed by `project:<id>:<list>` at module scope and OUTLIVES cleanup(), so rows
// carry between tests that use the same project id. Harmless for the default (empty) lists, but a
// test that stubs non-empty rows uses its own id, or it would seed the next one's first paint.
//
// The pane renders its content inline (it does not publish a stack level), so a plain render is
// enough — no rail-host harness.
//
// The 409 case uses a real AuthHttpError(409) so the pane's real isConflict path
// (via @agentic-toolkit/data) turns it into a friendly inline message, not a raw throw.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act, within } from "@testing-library/react";
import { AuthHttpError } from "@agentic-toolkit/auth/client";

// The Overview summarises four lists it does not own, so their clients are stubbed alongside the
// two it does. Each defaults to empty in beforeEach — a test that cares about a figure says so.
// Only the CLIENTS are stubbed: `validateKeyPrefix` is a pure rule the module also exports, and
// the point of the field's inline error is that the real rule decides it.
vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  validateKeyPrefix: (await importOriginal<typeof import("@agentic-toolkit/data/projects")>())
    .validateKeyPrefix,
  projectsApi: {
    get: vi.fn(),
    update: vi.fn(),
    statuses: { list: vi.fn() },
    participants: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
  },
  projectWorkItemsApi: { listForProject: vi.fn() },
  projectArtifactsApi: { list: vi.fn() },
  projectActivityApi: { projectActivity: vi.fn() },
}));

import { ProjectOverviewPane } from "./ProjectOverviewPane";
import {
  projectsApi,
  projectWorkItemsApi,
  projectArtifactsApi,
  projectActivityApi,
  type Project,
  type ProjectActivity,
  type ProjectArtifact,
  type ProjectParticipant,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";

const get = vi.mocked(projectsApi.get);
const update = vi.mocked(projectsApi.update);
const statusesList = vi.mocked(projectsApi.statuses.list);
const participantsList = vi.mocked(projectsApi.participants.list);
const add = vi.mocked(projectsApi.participants.add);
const remove = vi.mocked(projectsApi.participants.remove);
const listForProject = vi.mocked(projectWorkItemsApi.listForProject);
const artifactsList = vi.mocked(projectArtifactsApi.list);
const projectActivity = vi.mocked(projectActivityApi.projectActivity);

const PROJECT: Project = {
  id: "p1",
  name: "Website relaunch",
  description: "Rework the marketing site.",
  status: "active",
  // A board-accent string; kept non-hex so the fixture doesn't trip the UI color gate.
  color: "blue",
  keyPrefix: "WEB",
  ecosystemId: "eco1",
  archivedAt: null,
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
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
    statusId: "s",
    priority: 0,
    parentId: null,
    assigneeKind: null,
    assigneeId: null,
    startDate: null,
    dueDate: null,
    estimate: null,
    labels: [],
    rank: "V0",
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

function artifact(over: Partial<ProjectArtifact>): ProjectArtifact {
  return {
    id: "a",
    projectId: "p1",
    direction: "ingested",
    targetKind: "content.markdown",
    targetId: "d1",
    target: { kind: "content.markdown", id: "d1", title: "A doc", subtitle: null, url: null },
    createdAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

function activity(over: Partial<ProjectActivity>): ProjectActivity {
  return {
    id: "ac",
    projectId: "p1",
    workItemId: null,
    actorKind: "customer",
    actorId: "cust-1",
    actorLabel: "Ada",
    action: "project.created",
    detail: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(structuredClone(PROJECT));
  participantsList.mockResolvedValue([structuredClone(PARTICIPANT)]);
  update.mockImplementation((id, patch) =>
    Promise.resolve({ ...structuredClone(PROJECT), ...patch }),
  );
  add.mockResolvedValue(structuredClone(PARTICIPANT));
  remove.mockResolvedValue(undefined);
  // The four summary reads default to "nothing here", so a test only stubs the list it is about.
  statusesList.mockResolvedValue([]);
  listForProject.mockResolvedValue([]);
  artifactsList.mockResolvedValue([]);
  projectActivity.mockResolvedValue({ rows: [], nextBefore: null });
});

/** Open the settings Disclosure — the pane starts with it CLOSED (a project's front door is not
 *  its rename form), so every settings assertion goes through here. */
async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: /Project settings/ }));
}

// Explicit and redundant, deliberately: this package's vitest runs with `globals: true`
// (packages/web/packages/features/vitest.preset.ts:16), so RTL 16.3.2's own shipped
// `afterEach(cleanup)` DOES register (@testing-library/react/dist/index.js:23-30), and cleanup
// is idempotent. An earlier version of this comment asserted the opposite — no global afterEach,
// auto-cleanup never registers — and both halves were false. Keep the call if you like it as a
// local statement of intent; do not "fix" the config to match the claim that was here.
afterEach(cleanup);

describe("ProjectOverviewPane", () => {
  it("renders the project's name and lifecycle status", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    // The project's own sentence is what the pane LEADS with — its description and its
    // lifecycle status, read-only. Neither is a form field here.
    expect(await screen.findByText("Rework the marketing site.")).not.toBeNull();
    expect(screen.getByText("active")).not.toBeNull();
    await waitFor(() => expect(get).toHaveBeenCalledWith("p1"));
  });

  it("keeps the settings form closed until it is asked for", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByText("Rework the marketing site.");

    // Closed: the fields are not merely hidden, they are not rendered.
    expect(screen.queryByLabelText("Name")).toBeNull();

    await openSettings();
    // Name + Status populate free-text inputs; Status is the free-form lifecycle
    // varchar (a text input, NOT a select over the board columns).
    expect(screen.getByDisplayValue("Website relaunch")).not.toBeNull();
    const statusInput = screen.getByLabelText("Status") as HTMLInputElement;
    expect(statusInput.tagName).toBe("INPUT");
    expect(statusInput.value).toBe("active");
  });

  it("saves an edited name via projectsApi.update (only the changed field)", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await openSettings();

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("p1", { name: "Marketing revamp" }),
    );
  });

  it("saves an edited lifecycle status as the typed free-text string", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await openSettings();

    await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "on hold" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("p1", { status: "on hold" }),
    );
  });

  // The key prefix. It is the only field on this form whose value renames something OTHER
  // than the row it sits in — every one of the project's cards — and the only one whose
  // uniqueness is enforced across projects. Both of those are worth pinning.
  it("saves an edited key prefix, upper-cased on the way out", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await openSettings();

    await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(screen.getByLabelText(/^Key prefix/), { target: { value: "mkt" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    // `mkt` and `MKT` are the same claim; the backend stores only the upper form, so
    // sending the raw text would leave the field looking dirty after a successful save.
    await waitFor(() => expect(update).toHaveBeenCalledWith("p1", { keyPrefix: "MKT" }));
  });

  it("blocks the save and says why when the prefix cannot be a prefix", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await openSettings();

    await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(screen.getByLabelText(/^Key prefix/), { target: { value: "1AB" } });

    expect(screen.getByText(/a letter, then letters or digits/i)).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("names the prefix when the backend refuses it as already taken", async () => {
    update.mockRejectedValueOnce(
      new AuthHttpError(409, 'key prefix "MKT" is already used by another project'),
    );
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await openSettings();

    await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(screen.getByLabelText(/^Key prefix/), { target: { value: "MKT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    // Not "conflicts with an existing value" — that leaves the reader guessing which of
    // the five fields on this form they have to change.
    expect(await screen.findByText(/already uses the key prefix MKT/)).not.toBeNull();
  });

  it("adds a participant with the chosen kind + id", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByLabelText("Participant id");

    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "persona" } });
    fireEvent.change(screen.getByLabelText("Participant id"), {
      target: { value: "agent-9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("p1", {
        participantKind: "persona",
        participantId: "agent-9",
      }),
    );
  });

  it("removes a participant with its (participantId, kind)", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    const removeBtn = await screen.findByRole("button", { name: "Remove cust-1" });
    fireEvent.click(removeBtn);

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("p1", "cust-1", "customer"),
    );
  });

  // The guard itself now lives in the shared useResourceList (data/src/use-resource-list.ts) and
  // is unit-tested there; this keeps the PANE's version of the scenario, because the thing that
  // must not regress is what a user sees after two quick removes — not which module holds the
  // counter.
  it("does not let a stale participants reload clobber a newer one", async () => {
    const P2: ProjectParticipant = {
      ...structuredClone(PARTICIPANT),
      id: "pp2",
      participantId: "cust-2",
    };
    participantsList.mockResolvedValueOnce([structuredClone(PARTICIPANT), structuredClone(P2)]);

    // Two overlapping reloads (fired by the two removes below), resolved OUT OF ORDER — the
    // newer one (from removing cust-2) settles first, the stale one (from removing cust-1,
    // issued before cust-2 was even removed) settles last.
    let resolveReload1!: (rows: ProjectParticipant[]) => void;
    let resolveReload2!: (rows: ProjectParticipant[]) => void;
    let call = 0;
    participantsList.mockImplementation(
      () =>
        new Promise((res) => {
          call += 1;
          if (call === 1) resolveReload1 = res;
          else resolveReload2 = res;
        }),
    );

    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByText("cust-2");

    fireEvent.click(screen.getByRole("button", { name: "Remove cust-1" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1", "cust-1", "customer"));

    fireEvent.click(screen.getByRole("button", { name: "Remove cust-2" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1", "cust-2", "customer"));

    // The newer reload (from removing cust-2) resolves first, correctly showing empty…
    await act(async () => {
      resolveReload2([]);
    });
    expect(screen.getByText("No participants yet.")).not.toBeNull();

    // …then the STALE reload resolves late with a list that still includes cust-2 — this
    // must be a no-op, not clobber the newer, correct empty list.
    await act(async () => {
      resolveReload1([structuredClone(P2)]);
    });
    expect(screen.getByText("No participants yet.")).not.toBeNull();
    expect(screen.queryByText("cust-2")).toBeNull();
  });

  it("surfaces a friendly message when an add returns 409 (already a participant)", async () => {
    add.mockRejectedValueOnce(new AuthHttpError(409, "participant already exists"));
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByLabelText("Participant id");

    fireEvent.change(screen.getByLabelText("Participant id"), {
      target: { value: "cust-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // The 409 is caught and shown inline (no unhandled throw), naming the kind.
    expect(await screen.findByText(/already a participant/i)).not.toBeNull();
  });
});

/* ── The host-injected Transfer Ownership seam ────────────────────────────── */

// Echoes back what the seam was handed, so "called with the LOADED project" is directly
// assertable rather than inferred from the node merely existing. Same idiom as ecosystems'
// EcosystemSettingsPane.test.tsx.
const seam = (p: { id: string; name: string }) => (
  <div data-testid="transfer" data-id={p.id} data-name={p.name} />
);

describe("ProjectOverviewPane transfer seam", () => {
  it("renders the host's seam, handed the loaded project", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const node = await screen.findByTestId("transfer");
    expect(node.getAttribute("data-id")).toBe("p1");
    expect(node.getAttribute("data-name")).toBe("Website relaunch");
  });

  it("renders nothing where the host injects no seam", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    await screen.findByText("Rework the marketing site.");
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  it("renders nothing when the project does not load", async () => {
    get.mockResolvedValue(null);
    render(
      <ProjectOverviewPane projectId="gone" title="Overview" renderTransferOwnership={seam} />,
    );

    expect(await screen.findByText("Project not found.")).not.toBeNull();
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  // The pane hands over `project` (the loaded row), NOT the `name` draft above it. Swapping to
  // the draft would compile and pass every other test in this file, and would name the
  // confirmation dialog after a rename the server has never seen.
  it("keeps naming the SAVED project while a rename is unsaved", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );
    await openSettings();

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });

    // The field took the edit…
    expect(screen.getByDisplayValue("Marketing revamp")).not.toBeNull();
    // …and the seam still names the row the server knows.
    expect(screen.getByTestId("transfer").getAttribute("data-name")).toBe("Website relaunch");
  });

  it("adopts the new name once the rename is saved", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );
    await openSettings();

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByTestId("transfer").getAttribute("data-name")).toBe("Marketing revamp"),
    );
  });

  // Position, not mere presence: the seam is documented as the pane's LAST section, and both it
  // and the settings Disclosure render either way, so a presence assertion would pass with them
  // swapped. Anchored on settings rather than People because settings is the section it now has
  // to come after — the one a reordering would most plausibly put it before.
  it("places the seam AFTER the settings disclosure", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const transfer = await screen.findByTestId("transfer");
    const settings = screen.getByText("Project settings");
    expect(
      settings.compareDocumentPosition(transfer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

/* ── The summary panels ───────────────────────────────────────────────────── */

// Each figure is derived client-side from a list another topic owns, so these pin the DERIVATION
// — the part with no server to be wrong on its behalf.
describe("ProjectOverviewPane summary", () => {
  const STATUSES = [
    status({ id: "s-todo", key: "todo", label: "To do", category: "todo" }),
    status({ id: "s-doing", key: "doing", label: "Doing", category: "in_progress" }),
    status({ id: "s-done", key: "done", label: "Done", category: "done" }),
    status({ id: "s-cut", key: "cut", label: "Cut", category: "canceled" }),
  ];

  /** A day index → the "YYYY-MM-DD" the API would send, built on the LOCAL calendar to match
   *  how the pane reads a due date (see helpers.dayIndex). */
  function localDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }

  it("counts work by CATEGORY, so a renamed column still reports", async () => {
    statusesList.mockResolvedValue(STATUSES);
    listForProject.mockResolvedValue([
      item({ id: "w1", statusId: "s-todo" }),
      item({ id: "w2", statusId: "s-doing" }),
      item({ id: "w3", statusId: "s-doing" }),
      item({ id: "w4", statusId: "s-done" }),
      item({ id: "w5", statusId: "s-cut" }),
    ]);
    render(<ProjectOverviewPane projectId="sum-1" title="Overview" />);

    const card = (await screen.findByRole("region", { name: "Work" })) as HTMLElement;
    // Open = everything not done and not canceled: the todo + the two in progress. Awaited,
    // because the card renders (all zeros) as soon as the PROJECT loads — a bare assertion here
    // would be racing the two list reads that actually fill it.
    await waitFor(() =>
      expect(within(card).getByText("Open").nextElementSibling?.textContent).toBe("3"),
    );
    expect(within(card).getByText("In progress").nextElementSibling?.textContent).toBe("2");
    expect(within(card).getByText("Done").nextElementSibling?.textContent).toBe("1");
    expect(within(card).getByText("5 items · 20% done")).not.toBeNull();
  });

  // A stale statusId must not make an item disappear from the count — the parts sum to the whole
  // or the summary is lying about how much work there is.
  it("keeps an item whose status no longer exists in the total", async () => {
    statusesList.mockResolvedValue(STATUSES);
    listForProject.mockResolvedValue([
      item({ id: "w1", statusId: "s-done" }),
      item({ id: "w2", statusId: "s-deleted" }),
    ]);
    render(<ProjectOverviewPane projectId="sum-2" title="Overview" />);

    const card = (await screen.findByRole("region", { name: "Work" })) as HTMLElement;
    await waitFor(() => expect(within(card).getByText("2 items · 50% done")).not.toBeNull());
    // Not done and not canceled ⇒ it counts as open, which is the safe reading of "unknown".
    expect(within(card).getByText("Open").nextElementSibling?.textContent).toBe("1");
  });

  it("counts an overdue item, but not a finished one with a past due date", async () => {
    statusesList.mockResolvedValue(STATUSES);
    listForProject.mockResolvedValue([
      item({ id: "w1", statusId: "s-todo", dueDate: localDate(-1) }),
      item({ id: "w2", statusId: "s-done", dueDate: localDate(-30) }),
      item({ id: "w3", statusId: "s-cut", dueDate: localDate(-30) }),
      item({ id: "w4", statusId: "s-todo", dueDate: localDate(3) }),
    ]);
    render(<ProjectOverviewPane projectId="sum-3" title="Overview" />);

    const card = (await screen.findByRole("region", { name: "Work" })) as HTMLElement;
    await waitFor(() =>
      expect(within(card).getByText("Overdue").nextElementSibling?.textContent).toBe("1"),
    );
  });

  // A row that is always there is a row the eye learns to skip, and this is the one that must not
  // be skipped.
  it("shows no Overdue row when nothing is overdue", async () => {
    statusesList.mockResolvedValue(STATUSES);
    listForProject.mockResolvedValue([item({ id: "w1", statusId: "s-todo" })]);
    render(<ProjectOverviewPane projectId="sum-4" title="Overview" />);

    const card = (await screen.findByRole("region", { name: "Work" })) as HTMLElement;
    await waitFor(() => expect(within(card).getByText("1 item · 0% done")).not.toBeNull());
    expect(within(card).queryByText("Overdue")).toBeNull();
  });

  it("splits material by direction and flags the links that no longer resolve", async () => {
    artifactsList.mockResolvedValue([
      artifact({ id: "a1", direction: "ingested" }),
      artifact({ id: "a2", direction: "produced" }),
      artifact({ id: "a3", direction: "produced", target: null }),
    ]);
    render(<ProjectOverviewPane projectId="sum-5" title="Overview" />);

    const card = (await screen.findByRole("region", { name: "Material" })) as HTMLElement;
    await waitFor(() =>
      expect(within(card).getByText("Ingested").nextElementSibling?.textContent).toBe("1"),
    );
    expect(within(card).getByText("Produced").nextElementSibling?.textContent).toBe("2");
    expect(within(card).getByText("Unresolved").nextElementSibling?.textContent).toBe("1");
    expect(within(card).getByText("3 attachments")).not.toBeNull();
  });

  it("phrases recent activity, letting a comment speak in its own words", async () => {
    projectActivity.mockResolvedValue({
      rows: [
        activity({ id: "ac1", action: "work_item.status_changed" }),
        activity({
          id: "ac2",
          action: "comment.added",
          detail: { body: "Shipping this on Friday." },
        }),
      ],
      nextBefore: null,
    });
    render(<ProjectOverviewPane projectId="sum-6" title="Overview" />);

    expect(await screen.findByText("Ada changed status")).not.toBeNull();
    expect(screen.getByText("Ada Shipping this on Friday.")).not.toBeNull();
  });

  it("asks for only the head of the trail", async () => {
    render(<ProjectOverviewPane projectId="sum-7" title="Overview" />);
    await waitFor(() =>
      expect(projectActivity).toHaveBeenCalledWith("sum-7", { limit: 5 }),
    );
  });

  // Four background reads back a pane whose whole job is to say what this project is. One of them
  // failing must not take the answer down with it.
  it("still renders the project when a summary read fails", async () => {
    listForProject.mockRejectedValue(new Error("boom"));
    artifactsList.mockRejectedValue(new Error("boom"));
    projectActivity.mockRejectedValue(new Error("boom"));
    render(<ProjectOverviewPane projectId="sum-8" title="Overview" />);

    expect(await screen.findByText("Rework the marketing site.")).not.toBeNull();
    const card = (await screen.findByRole("region", { name: "Work" })) as HTMLElement;
    await waitFor(() => expect(within(card).getByText("no work items yet")).not.toBeNull());
    expect(screen.getByText("Nothing has happened yet.")).not.toBeNull();
  });

  it("says so plainly when the project has no description", async () => {
    get.mockResolvedValue({ ...structuredClone(PROJECT), id: "sum-9", description: null });
    render(<ProjectOverviewPane projectId="sum-9" title="Overview" />);

    expect(await screen.findByText(/No description yet/)).not.toBeNull();
  });
});
