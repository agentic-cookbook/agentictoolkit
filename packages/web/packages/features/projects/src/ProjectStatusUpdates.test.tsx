// @vitest-environment jsdom
//
// Component test for ProjectStatusUpdates — the signed check-ins a board's health is READ from.
//
// Only the api-client boundary is mocked, so the load → post → reload wiring runs for real. The
// section is modelled on WorkItemComments and this file is modelled on its test, but the property
// that matters here is one a comment does not have: every write MOVES A DASHBOARD. The backend
// derives `Project.health` from the newest live report and stores no column for it, so this
// section owns nothing — it refetches. Three things are therefore asserted that a screenshot
// cannot check:
//
//   1. `onChanged` fires after EVERY write, because each of the three changes what the project
//      says about itself. A post that reloaded only this list would leave the health badge on the
//      surrounding pane stating the previous claim.
//   2. Which row the health is read from is stated ON the row, and the retract confirmation says
//      which of the two things it is about to do — withdraw a claim, or ALSO roll the project's
//      health back to the previous report. That difference is the whole question.
//   3. Revise is offered on the viewer's OWN report only (knowable here — the row is signed),
//      while Retract is offered on every row (reach for it is computed server-side from roles the
//      client never sees).
//
// @agentic-toolkit/data is NOT wholesale-mocked: the section runs through the REAL useResourceList,
// whose module-scope cache is keyed `project:<id>:status-updates` and OUTLIVES cleanup(), so every
// test uses its own project id. The one thing overridden there is `readTokenSubject`, which decides
// who the viewer is — the fact the author-only Revise control turns on.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

const VIEWER = "cust-1";

vi.mock("@agentic-toolkit/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data")>()),
  readTokenSubject: () => VIEWER,
}));

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectStatusUpdatesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { ProjectStatusUpdates } from "./ProjectStatusUpdates";
import {
  projectStatusUpdatesApi,
  type ProjectParticipant,
  type ProjectStatusUpdate,
} from "@agentic-toolkit/data/projects";

const list = vi.mocked(projectStatusUpdatesApi.list);
const create = vi.mocked(projectStatusUpdatesApi.create);
const update = vi.mocked(projectStatusUpdatesApi.update);
const remove = vi.mocked(projectStatusUpdatesApi.remove);

/** A fresh project id per test, so no test seeds the next one's first paint. */
let pidCounter = 0;
const pid = () => `p-${++pidCounter}`;

function participant(id: string): ProjectParticipant {
  return {
    id: `pp-${id}`,
    projectId: "p1",
    participantKind: "customer",
    participantId: id,
    role: "member",
    addedBy: null,
    addedAt: "2026-07-03T00:00:00Z",
  };
}

/** The roster the section puts names to signatures with — the SAME phrasing the assignee picker
 *  uses, so one person is not named two different ways on one screen. */
const ROSTER: ProjectParticipant[] = [participant(VIEWER), participant("cust-2")];
const ME = `customer · ${VIEWER}`;
const THEM = "customer · cust-2";

function report(over: Partial<ProjectStatusUpdate> & Pick<ProjectStatusUpdate, "id">): ProjectStatusUpdate {
  return {
    projectId: "p1",
    health: "on_track",
    body: `body ${over.id}`,
    createdBy: "cust-2",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
  create.mockResolvedValue(report({ id: "su-new" }));
  update.mockResolvedValue(report({ id: "su1", health: "off_track" }));
  remove.mockResolvedValue(undefined);
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

function renderSection(projectId: string) {
  const onChanged = vi.fn();
  render(
    <ProjectStatusUpdates
      projectId={projectId}
      participants={ROSTER}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

describe("ProjectStatusUpdates", () => {
  it("does not claim a board has no reported health while the read is outstanding", async () => {
    // "No updates yet — this project has no reported health" is an assertion ABOUT THE BOARD, and
    // it is the strongest sentence on the pane: it says the dashboard's colour is absent rather
    // than merely unloaded. Drawn early it would be a wrong fact, not a slow one.
    let settle: (rows: ProjectStatusUpdate[]) => void = () => {};
    list.mockReturnValue(
      new Promise<ProjectStatusUpdate[]>((resolve) => {
        settle = resolve;
      }),
    );
    renderSection(pid());

    expect(screen.getByText("Loading…")).not.toBeNull();
    expect(screen.queryByText(/no reported health/)).toBeNull();

    settle([report({ id: "su1", body: "Shipping on time" })]);
    expect(await screen.findByText("Shipping on time")).not.toBeNull();
  });

  it("starts the composer on the least alarming answer, offered worst-last", async () => {
    // A mis-click must not raise an alarm nobody meant to raise — and the list reads as a scale
    // rather than a bag, which is why the order is fixed rather than alphabetical.
    renderSection(pid());
    await screen.findByText(/no reported health/);

    const health = screen.getByLabelText("Health") as HTMLSelectElement;
    expect(health.value).toBe("on_track");
    expect(
      (within(health).getAllByRole("option") as HTMLOptionElement[]).map((o) => o.textContent),
    ).toEqual(["On track", "At risk", "Off track"]);
  });

  it("will not post a health with no explanation", async () => {
    // The backend's rule and a good one: a colour nobody can act on is worse than no report. The
    // health half always has a value, so the body is the only thing that can be missing — and the
    // control says so by staying disabled rather than by failing after the round trip.
    renderSection(pid());
    await screen.findByText(/no reported health/);

    const post = screen.getByRole("button", { name: "Post update" });
    expect(post).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Report how this project is going"), {
      target: { value: "   " },
    });
    expect(post).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Report how this project is going"), {
      target: { value: "Behind on the migration" },
    });
    expect(post).toHaveProperty("disabled", false);
  });

  it("posts both halves, then refetches the PROJECT whose health just moved", async () => {
    const id = pid();
    const onChanged = renderSection(id);
    await screen.findByText(/no reported health/);

    fireEvent.change(screen.getByLabelText("Health"), { target: { value: "at_risk" } });
    const box = screen.getByLabelText(
      "Report how this project is going",
    ) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "  Waiting on the vendor  " } });
    fireEvent.click(screen.getByRole("button", { name: "Post update" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(id, { health: "at_risk", body: "Waiting on the vendor" }),
    );
    // Two GETs: the mount's and the one after the write.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    // …and the project itself, which is where the health actually lives. Reloading only this list
    // would leave the surrounding pane's badge stating the previous claim.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(box.value).toBe(""));
  });

  it("submits on ⌘/Ctrl+Enter but leaves a bare Enter to make a paragraph", async () => {
    // The body is prose. A composer that posted on Enter would make a second paragraph
    // impossible to type — and this one posts a claim other people steer by.
    const id = pid();
    renderSection(id);
    await screen.findByText(/no reported health/);

    const box = screen.getByLabelText("Report how this project is going");
    fireEvent.change(box, { target: { value: "first line" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(create).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(id, { health: "on_track", body: "first line" }),
    );
  });

  it("says which row the project's health is read from", async () => {
    // The list is newest-first and that ordering IS the derivation, so leaving a reader to infer
    // it would leave them guessing why retracting the top row is consequential and retracting an
    // older one is not.
    list.mockResolvedValue([
      report({ id: "su1", health: "off_track", body: "Newest" }),
      report({ id: "su2", health: "on_track", body: "Older" }),
    ]);
    renderSection(pid());

    const newest = (await screen.findByText("Newest")).closest("li") as HTMLElement;
    const older = (screen.getByText("Older").closest("li")) as HTMLElement;
    expect(within(newest).getByText("· the project's health now")).not.toBeNull();
    expect(within(older).queryByText("· the project's health now")).toBeNull();
    // Each row wears the health IT claimed, not the project's — an older report keeps saying what
    // it said.
    expect(within(newest).getByText("Off track").getAttribute("data-slot")).toBe("badge");
    expect(within(older).getByText("On track").getAttribute("data-slot")).toBe("badge");
  });

  it("offers Revise on the viewer's OWN report only, and Retract on every row", async () => {
    // Rewriting someone else's report over their signature would be a forgery, and this one would
    // additionally move a number other people are steering by — so the control is simply absent
    // rather than offered and then refused. Retract is the other way round: reach for it is
    // computed server-side, and the common case is that a reader may act.
    list.mockResolvedValue([
      report({ id: "su1", createdBy: VIEWER, body: "Mine" }),
      report({ id: "su2", createdBy: "cust-2", body: "Theirs" }),
    ]);
    renderSection(pid());
    await screen.findByText("Mine");

    expect(screen.getByRole("button", { name: `Revise ${ME}'s update` })).not.toBeNull();
    expect(screen.queryByRole("button", { name: `Revise ${THEM}'s update` })).toBeNull();
    expect(screen.getByRole("button", { name: `Retract ${ME}'s update` })).not.toBeNull();
    expect(screen.getByRole("button", { name: `Retract ${THEM}'s update` })).not.toBeNull();
  });

  it("revises a report through the project AND the report's own id", async () => {
    const id = pid();
    list.mockResolvedValue([report({ id: "su1", createdBy: VIEWER, health: "on_track" })]);
    const onChanged = renderSection(id);
    await screen.findByText("body su1");

    fireEvent.click(screen.getByRole("button", { name: `Revise ${ME}'s update` }));
    const box = screen.getByRole("textbox", { name: `Revise ${ME}'s update` }) as HTMLTextAreaElement;
    // The box opens holding the current report — a revision starts from what was said, not blank.
    expect(box.value).toBe("body su1");
    // The health half is seeded too, so fixing a typo does not silently re-claim "on track".
    const healths = screen.getAllByLabelText("Health") as HTMLSelectElement[];
    expect(healths[1]!.value).toBe("on_track");

    fireEvent.change(healths[1]!, { target: { value: "off_track" } });
    fireEvent.change(box, { target: { value: "The vendor pulled out" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(id, "su1", {
        health: "off_track",
        body: "The vendor pulled out",
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("warns that retracting the NEWEST report rolls the project's health back", async () => {
    const id = pid();
    // The two are signed by DIFFERENT people, so the two Retract controls have different names and
    // the click below cannot land on the wrong row.
    list.mockResolvedValue([
      report({ id: "su1", health: "off_track", body: "Newest" }),
      report({ id: "su2", body: "Older", createdBy: VIEWER }),
    ]);
    const onChanged = renderSection(id);
    await screen.findByText("Newest");

    fireEvent.click(screen.getByRole("button", { name: `Retract ${THEM}'s update` }));
    expect(remove).not.toHaveBeenCalled();
    // The consequence, not the mechanic: withdrawing this claim un-says the project's current
    // health, and a modal that only said "this will be deleted" would hide that entirely.
    expect(
      await screen.findByText(/health goes back to whatever the previous update reported/),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retract" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(id, "su1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("says retracting an OLDER report leaves the project's health where it is", async () => {
    // The other half of the same sentence, and the reason it is worth writing at all: without it a
    // reader has to know the derivation rule to predict which of two identical-looking buttons
    // moves the dashboard.
    list.mockResolvedValue([
      report({ id: "su1", body: "Newest", createdBy: VIEWER }),
      report({ id: "su2", body: "Older" }),
    ]);
    renderSection(pid());
    await screen.findByText("Older");

    fireEvent.click(screen.getByRole("button", { name: `Retract ${THEM}'s update` }));
    expect(
      await screen.findByText(/health is read from the newest update, so it does not change/),
    ).not.toBeNull();
  });

  it("reports a refused write instead of leaving the draft looking sent", async () => {
    create.mockRejectedValue(new Error("you do not have permission to report here"));
    const onChanged = renderSection(pid());
    await screen.findByText(/no reported health/);

    fireEvent.change(screen.getByLabelText("Report how this project is going"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post update" }));

    // The backend's own words, the text still in the box to try again with — and no `onChanged`,
    // because nothing moved.
    expect(
      await screen.findByText("you do not have permission to report here"),
    ).not.toBeNull();
    expect(
      (screen.getByLabelText("Report how this project is going") as HTMLTextAreaElement).value,
    ).toBe("hello");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("echoes a reporter the roster no longer carries rather than anonymising them", async () => {
    // A reporter who has since left the project is still a specific person; replacing their id
    // with "Someone" would make an old claim unattributable — and a health report is a claim
    // whose author is half its meaning.
    list.mockResolvedValue([report({ id: "su1", createdBy: "cust-gone" })]);
    renderSection(pid());

    expect(await screen.findByText("cust-gone")).not.toBeNull();
    expect(screen.queryByText("Someone")).toBeNull();
  });
});
