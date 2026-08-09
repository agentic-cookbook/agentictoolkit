// @vitest-environment jsdom
//
// Component test for ProjectActivityPane — the project Activity topic (T6). The
// hub's vitest config is node-only, so this file opts into jsdom via the docblock.
// The api-client boundary (@agentic-toolkit/data/projects) is mocked, so the pane → feed
// wiring is exercised: the project-scoped `load` feeds projectActivity(projectId).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", () => ({
  projectActivityApi: {
    projectActivity: vi.fn(),
    workItemActivity: vi.fn(),
    addComment: vi.fn(),
  },
  // The default nouns are plain data, but `./vocabulary` imports them from this module — so a
  // whole-module mock that omits them breaks the import chain, not just the value.
  DEFAULT_ITEM_NOUN: "work item",
  DEFAULT_ITEM_NOUN_PLURAL: "work items",
}));

import { ProjectActivityPane } from "./ProjectActivityPane";
import { projectActivityApi, type ProjectActivity } from "@agentic-toolkit/data/projects";

const projectActivity = vi.mocked(projectActivityApi.projectActivity);

const ROW: ProjectActivity = {
  id: "a1",
  projectId: "p1",
  workItemId: null,
  actorKind: null,
  actorId: null,
  actorLabel: "Ada",
  action: "project.created",
  detail: null,
  createdAt: "2026-07-03T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  projectActivity.mockResolvedValue({ rows: [structuredClone(ROW)], nextBefore: null });
});

afterEach(cleanup);

describe("ProjectActivityPane", () => {
  it("feeds the project's activity trail (projectActivity) into the ActivityFeed", async () => {
    render(<ProjectActivityPane projectId="p1" title="Activity" />);

    expect(await screen.findByText("created the project")).not.toBeNull();
    await waitFor(() =>
      expect(projectActivity).toHaveBeenCalledWith("p1", { limit: 20, before: undefined }),
    );
  });
});
