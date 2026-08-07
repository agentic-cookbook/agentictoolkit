// @vitest-environment jsdom
//
// Component test for WorkItemEditor's per-item activity + comment composer (T6),
// which renders only in edit mode. This package's vitest config is jsdom (see
// vitest.config.ts). Both api boundaries are mocked in the single domain barrel
// (@agentic-toolkit/data/projects) — the activity client for the feed + comment, the
// work-items client so the editor's save path stays inert — so the composer →
// addComment → refresh wiring is exercised, not the transport.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// The former @/api/{project-activity,project-work-items} hub modules now ship in ONE domain
// barrel, so their stubs merge into a single mock.
vi.mock("@agentic-toolkit/data/projects", () => ({
  projectActivityApi: {
    projectActivity: vi.fn(),
    workItemActivity: vi.fn(),
    addComment: vi.fn(),
  },
  projectWorkItemsApi: { create: vi.fn(), update: vi.fn() },
}));

import { WorkItemEditor } from "./WorkItemEditor";
import { projectActivityApi, type ProjectActivity } from "@agentic-toolkit/data/projects";
import {
  projectWorkItemsApi,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";

const workItemActivity = vi.mocked(projectActivityApi.workItemActivity);
const addComment = vi.mocked(projectActivityApi.addComment);
const update = vi.mocked(projectWorkItemsApi.update);

const ITEM: WorkItem = {
  id: "w1",
  projectId: "p1",
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
  position: 0,
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

const COMMENT: ProjectActivity = {
  id: "c1",
  projectId: "p1",
  workItemId: "w1",
  actorKind: "customer",
  actorId: "cust-1",
  actorLabel: "Ada",
  action: "comment.added",
  detail: { body: "Nice work" },
  createdAt: "2026-07-03T01:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  workItemActivity.mockResolvedValue({ rows: [], nextBefore: null });
  addComment.mockResolvedValue(structuredClone(COMMENT));
});

afterEach(cleanup);

function renderEditor(item: WorkItem = ITEM) {
  return render(
    <WorkItemEditor
      projectId="p1"
      item={item}
      statuses={[]}
      participants={[]}
      workItems={[ITEM]}
      labelOptions={[]}
      onSaved={() => {}}
      onCancel={() => {}}
    />,
  );
}

describe("WorkItemEditor activity + comment composer (edit mode)", () => {
  it("loads the item's activity and posts a trimmed comment, then refreshes the feed", async () => {
    renderEditor();

    // The feed loads the item's activity on mount.
    await waitFor(() =>
      expect(workItemActivity).toHaveBeenCalledWith("w1", { limit: 20, before: undefined }),
    );
    const loadsBefore = workItemActivity.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "  Nice work  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    // The composer posts the trimmed body to the work item…
    await waitFor(() => expect(addComment).toHaveBeenCalledWith("w1", "Nice work"));
    // …then the feed re-mounts and re-loads (a fresh workItemActivity call).
    await waitFor(() =>
      expect(workItemActivity.mock.calls.length).toBeGreaterThan(loadsBefore),
    );
  });

  it("disables the Comment button until the composer has text", async () => {
    renderEditor();

    const button = screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "hi" } });
    expect(button.disabled).toBe(false);
  });
});

describe("WorkItemEditor save gate", () => {
  it("starts disabled for an unmodified item and enables after an edit", () => {
    renderEditor();

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Design the landing page"), {
      target: { value: "Design the new landing page" },
    });
    expect(save).toBeEnabled();
  });

  // The gate disables Save before `save()`'s own `setError("Title is required.")` can ever run, so
  // without a rendered reason a cleared title produces a grey button and no explanation at all.
  it("says WHY Save is blocked when the title is cleared", () => {
    renderEditor();

    expect(screen.queryByText("Title is required.")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Design the landing page"), {
      target: { value: "  " },
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
  });

  // The other half: an item that arrives ALREADY invalid must not open with a complaint about a row
  // the user hasn't touched. Nothing-to-save is what the grey button already says.
  it("stays silent about an already-blank title the user hasn't touched", () => {
    renderEditor({ ...ITEM, title: "" });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByText("Title is required.")).toBeNull();
  });
});

describe("WorkItemEditor save (edit mode)", () => {
  // The raw dirty check saw a different string and lit Save up; the PATCH it would have sent was
  // empty, because every field goes out trimmed. Save is gated on that PATCH now, so the no-op
  // write can't even be requested — which is stronger than skipping it after the click.
  it("a trailing space in the title is not a change — Save stays disabled and nothing is written", () => {
    const onSaved = vi.fn();
    render(
      <WorkItemEditor
        projectId="p1"
        item={ITEM}
        statuses={[]}
        participants={[]}
        workItems={[ITEM]}
        labelOptions={[]}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Design the landing page"), {
      target: { value: `${ITEM.title} ` },
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(update).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // The other side of the same comparison: a row STORED with stray whitespace used to be diffed
  // trimmed-draft-against-raw-baseline, so it read as changed the instant it loaded — Save was live
  // on a form nobody had touched, offering a write that only re-normalises what is already there.
  it("an item stored with untrimmed text loads with Save disabled", () => {
    renderEditor({ ...ITEM, title: "  Design the landing page  ", description: " notes " });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("diffs the second save against the saved row (baseline), not the stale item prop", async () => {
    update.mockResolvedValueOnce({ ...ITEM, title: "New Title" });
    renderEditor();

    const save = screen.getByRole("button", { name: "Save changes" });

    // First save: edit the title only.
    fireEvent.change(screen.getByPlaceholderText("Design the landing page"), {
      target: { value: "New Title" },
    });
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenNthCalledWith(1, "w1", { title: "New Title" });

    // Second save: edit ONLY the description — the draft's title still reads "New Title", the
    // exact value just saved. If buildPatch() diffed against the stale `item` PROP (title:
    // "Design the landing page", since props never change mid-test) instead of the hook's
    // committed BASELINE (title: "New Title" after the first save's commit()), it would wrongly
    // resend `title: "New Title"` a second time — a phantom re-send of a field the user didn't
    // touch this round. This is the whole justification for the `baseline` hook extension; without
    // it (or without the commit() call that advances it), this assertion fails.
    update.mockResolvedValueOnce({ ...ITEM, title: "New Title", description: "New description" });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "New description" },
    });
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenNthCalledWith(2, "w1", { description: "New description" });
  });
});

// Labels are the shared tagging system (content.keywords) reached through the shared
// `TagSetField` row, so what this file has to prove is the WIRING either side of that row:
// the draft carries a set, and `buildPatch` sends it only when it actually differs. The row's
// own affordances (autocomplete commit rule, the chooser's chips, minting a new label) are
// covered where they live, in ui's tagSetField/entityChooser tests.
describe("WorkItemEditor labels", () => {
  const VOCABULARY = ["bug", "chore", "design"];

  function renderWithLabels(item: WorkItem = ITEM) {
    return render(
      <WorkItemEditor
        projectId="p1"
        item={item}
        statuses={[]}
        participants={[]}
        workItems={[item]}
        labelOptions={VOCABULARY}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
  }

  it("adds a label from the vocabulary and PATCHes the whole set", async () => {
    update.mockResolvedValueOnce({ ...ITEM, labels: ["design"] });
    renderWithLabels();

    // Accepting a suggestion fires onValueChange with the WHOLE option string; TagSetField
    // treats an exact vocabulary match as the commit.
    fireEvent.change(screen.getByLabelText("Add a label"), { target: { value: "design" } });

    const save = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    // The endpoint REPLACES the set rather than merging, so the patch carries every label the
    // item should end up with — not just the one added.
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith("w1", { labels: ["design"] });
  });

  it("keeps Save disabled when the labels are untouched", () => {
    renderWithLabels({ ...ITEM, labels: ["bug", "chore"] });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  // Order is DATA here — the backend stores it as `sort_order` on the link rows and hands it
  // back in that order. A set-wise comparison would call a re-order "unchanged" and silently
  // drop it, so the diff is order-sensitive.
  it("treats a re-order as a change", async () => {
    const item = { ...ITEM, labels: ["bug", "chore"] };
    update.mockResolvedValueOnce({ ...item, labels: ["chore", "bug"] });
    renderWithLabels(item);

    // Removing the leading chip and re-adding it puts the same two labels back in the other order.
    fireEvent.click(screen.getByRole("button", { name: "Remove bug" }));
    fireEvent.change(screen.getByLabelText("Add a label"), { target: { value: "bug" } });

    const save = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith("w1", { labels: ["chore", "bug"] });
  });
});

// Every other test in this file renders with `statuses={[]}`, so the status field's real
// (populated) path was never exercised. An item with NO status used to load as `statuses[0].id`
// — the SAME invented value on both the draft and the baseline — so the field displayed a status
// the row didn't have, dirty stayed false, re-picking that status hit `set`'s sameValue
// short-circuit, and the item could never be given a status at all.
describe("WorkItemEditor status field with a statusless item", () => {
  const STATUSES: ProjectStatus[] = [
    { id: "s1", projectId: "p1", key: "todo", label: "To do", category: "todo", position: 0, createdAt: "2026-07-03T00:00:00Z" },
    { id: "s2", projectId: "p1", key: "doing", label: "Doing", category: "in_progress", position: 1, createdAt: "2026-07-03T00:00:00Z" },
  ];
  const NO_STATUS: WorkItem = { ...ITEM, statusId: null };

  function renderWithStatuses() {
    return render(
      <WorkItemEditor
        projectId="p1"
        item={NO_STATUS}
        statuses={STATUSES}
        participants={[]}
        workItems={[NO_STATUS]}
        labelOptions={[]}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
  }

  it("shows it has no status rather than the first one", () => {
    renderWithStatuses();
    const select = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "— No status" })).toBeDefined();
  });

  // Deliberately picks the FIRST status — the very value the old fallback pre-filled the draft
  // AND the baseline with. That is the case the bug swallowed whole: the field already read
  // "To do", so choosing "To do" was a no-op the dirty check never saw and Save stayed dead.
  it("lets the first status be picked and PATCHes it", async () => {
    update.mockResolvedValueOnce({ ...NO_STATUS, statusId: "s1" });
    renderWithStatuses();

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "s1" } });
    expect(save).toHaveProperty("disabled", false);

    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenNthCalledWith(1, "w1", { statusId: "s1" });
  });
});
