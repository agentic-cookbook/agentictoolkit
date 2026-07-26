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
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";

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

function renderEditor() {
  return render(
    <WorkItemEditor
      projectId="p1"
      item={ITEM}
      statuses={[]}
      participants={[]}
      workItems={[ITEM]}
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
});

describe("WorkItemEditor save (edit mode)", () => {
  it("skips the no-op PATCH when nothing changed, saving the unchanged item", async () => {
    const onSaved = vi.fn();
    render(
      <WorkItemEditor
        projectId="p1"
        item={ITEM}
        statuses={[]}
        participants={[]}
        workItems={[ITEM]}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );

    // Save is dirty-gated, so an untouched form can't click Save at all — edit the title
    // with only trailing whitespace. That's a real (if trivial) edit as far as the raw
    // dirty check is concerned (Object.is sees a different string), but buildPatch()'s
    // .trim() normalization still produces an EMPTY patch against the baseline, so update
    // is still skipped — the no-op-PATCH behavior this test exists to cover is unchanged.
    fireEvent.change(screen.getByPlaceholderText("Design the landing page"), {
      target: { value: `${ITEM.title} ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ITEM));
    expect(update).not.toHaveBeenCalled();
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
