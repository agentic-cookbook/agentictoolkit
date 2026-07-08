// @vitest-environment jsdom
//
// Component test for ActivityFeed — the reusable keyset-paginated feed (T6). The
// hub's vitest config is node-only, so this file opts into jsdom via the docblock.
// `load` is a plain mock (no api boundary): the test drives the mount-load → render
// → "Load older" → append cycle, the action phrasing, and the empty state.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import { ActivityFeed } from "./ActivityFeed";
import type { ActivityPage, ProjectActivity } from "@agentic-toolkit/data/projects";

// Build a ProjectActivity from the id + action (the only per-row varying bits).
function activity(
  partial: Partial<ProjectActivity> & Pick<ProjectActivity, "id" | "action">,
): ProjectActivity {
  return {
    projectId: "p1",
    workItemId: null,
    actorKind: null,
    actorId: null,
    actorLabel: null,
    detail: null,
    createdAt: "2026-07-03T00:00:00Z",
    ...partial,
  };
}

const PAGE1: ActivityPage = {
  rows: [
    activity({ id: "a1", action: "work_item.status_changed", actorLabel: "Ada" }),
    activity({
      id: "a2",
      action: "comment.added",
      actorLabel: "Bo",
      detail: { body: "Looks good to me" },
    }),
  ],
  nextBefore: "cursor-1",
};

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

describe("ActivityFeed", () => {
  it("renders rows with human action phrasing and the comment body", async () => {
    const load = vi.fn<(before?: string) => Promise<ActivityPage>>(async () => PAGE1);
    render(<ActivityFeed load={load} />);

    // status_changed → phrasing; comment.added → the body; actor label shows.
    expect(await screen.findByText("changed status")).not.toBeNull();
    expect(screen.getByText("commented")).not.toBeNull();
    expect(screen.getByText("Looks good to me")).not.toBeNull();
    expect(screen.getByText("Ada")).not.toBeNull();
    // The initial page loads with no cursor.
    await waitFor(() => expect(load).toHaveBeenCalledWith());
  });

  it("appends the next page on 'Load older' and hides the control at the tail", async () => {
    const page2: ActivityPage = {
      rows: [activity({ id: "a3", action: "project.created", actorLabel: "Cy" })],
      nextBefore: null,
    };
    const load = vi
      .fn<(before?: string) => Promise<ActivityPage>>()
      .mockResolvedValueOnce(PAGE1)
      .mockResolvedValueOnce(page2);

    render(<ActivityFeed load={load} />);
    await screen.findByText("changed status");

    fireEvent.click(screen.getByRole("button", { name: "Load older" }));

    // The older page appends below the first page (both remain visible)…
    expect(await screen.findByText("created the project")).not.toBeNull();
    expect(screen.getByText("changed status")).not.toBeNull();
    // …loaded with the first page's nextBefore as the cursor…
    await waitFor(() => expect(load).toHaveBeenNthCalledWith(2, "cursor-1"));
    // …and with nextBefore now null the control disappears.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load older" })).toBeNull(),
    );
  });

  it("omits 'Load older' when the first page already has no next cursor", async () => {
    const load = vi.fn<(before?: string) => Promise<ActivityPage>>(async () => ({
      rows: PAGE1.rows,
      nextBefore: null,
    }));
    render(<ActivityFeed load={load} />);

    await screen.findByText("changed status");
    expect(screen.queryByRole("button", { name: "Load older" })).toBeNull();
  });

  it("shows an empty state for an empty page", async () => {
    const load = vi.fn<(before?: string) => Promise<ActivityPage>>(async () => ({
      rows: [],
      nextBefore: null,
    }));
    render(<ActivityFeed load={load} />);

    expect(await screen.findByText("No activity yet.")).not.toBeNull();
  });
});
