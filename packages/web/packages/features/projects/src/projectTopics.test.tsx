// @vitest-environment jsdom
//
// The shared topic declaration — what a project is made of, independent of the rail showing it.
//
// This exists because the list used to be written twice (ProjectsFeature's `ResourceTopic[]` and
// SubjectProjectPane's `GroupTopicItem[]`), and the two could silently disagree: a topic added to
// one door into a project and not the other is invisible until someone walks through the other
// door. Both surfaces now map THIS list, so agreement is structural — which leaves this file two
// jobs. Pin the list itself (order, ids, and the Access gating, which is the one conditional), and
// pin the context→props wiring, because that is the part a shape-free render can get wrong without
// tsc noticing: every pane's props still have to be reachable from the ONE context object.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// The panes are stubs: what is under test is which topics exist and what each one is HANDED,
// not what any pane renders (each has its own test file).
vi.mock("./ProjectOverviewPane", () => ({
  ProjectOverviewPane: ({
    projectId,
    title,
    workspaceSlug,
    renderTransferOwnership,
  }: {
    projectId: string;
    title: string;
    workspaceSlug?: string;
    renderTransferOwnership?: unknown;
  }) => (
    <div
      data-testid="overview"
      data-project={projectId}
      data-title={title}
      data-workspace={workspaceSlug ?? ""}
      data-transfer={renderTransferOwnership ? "given" : "absent"}
    />
  ),
}));
vi.mock("./WorkItemsSurface", () => ({
  WorkItemsSurface: ({
    projectId,
    title,
    leaf,
    workspaceSlug,
  }: {
    projectId: string;
    title: string;
    leaf: { leafId: string | null };
    workspaceSlug?: string;
  }) => (
    <div
      data-testid="work-items"
      data-project={projectId}
      data-title={title}
      data-leaf={leaf.leafId}
      data-workspace={workspaceSlug ?? ""}
    />
  ),
}));
vi.mock("./MilestonesPane", () => ({
  MilestonesPane: ({
    projectId,
    title,
    leaf,
  }: {
    projectId: string;
    title: string;
    leaf: { leafId: string | null };
  }) => (
    <div
      data-testid="milestones"
      data-project={projectId}
      data-title={title}
      data-leaf={leaf.leafId}
    />
  ),
}));
vi.mock("./ProgramsPane", () => ({
  ProgramsPane: ({
    title,
    leaf,
    workspaceSlug,
  }: {
    title: string;
    leaf: { leafId: string | null };
    workspaceSlug?: string;
  }) => (
    <div
      data-testid="programs"
      data-title={title}
      data-leaf={leaf.leafId}
      data-workspace={workspaceSlug ?? ""}
    />
  ),
}));
vi.mock("./IterationsPane", () => ({
  IterationsPane: ({
    title,
    leaf,
    workspaceSlug,
  }: {
    title: string;
    leaf: { leafId: string | null };
    workspaceSlug?: string;
  }) => (
    <div
      data-testid="iterations"
      data-title={title}
      data-leaf={leaf.leafId}
      data-workspace={workspaceSlug ?? ""}
    />
  ),
}));
vi.mock("./ProjectContentsPane", () => ({
  ProjectContentsPane: ({ projectId, title }: { projectId: string; title: string }) => (
    <div data-testid="contents" data-project={projectId} data-title={title} />
  ),
}));
vi.mock("./ProjectActivityPane", () => ({
  ProjectActivityPane: ({ projectId, title }: { projectId: string; title: string }) => (
    <div data-testid="activity" data-project={projectId} data-title={title} />
  ),
}));
vi.mock("@agentic-toolkit/teams", () => ({
  workspaceSubjectsDirectory: {},
  ItemAccessPanel: ({
    workspaceSlug,
    itemId,
    itemLabel,
    title,
  }: {
    workspaceSlug: string;
    itemId: string;
    itemLabel?: string;
    title: string;
  }) => (
    <div
      data-testid="access"
      data-workspace={workspaceSlug}
      data-item={itemId}
      data-label={itemLabel}
      data-title={title}
    />
  ),
}));

import { projectTopics, type ProjectTopicContext } from "./projectTopics";

afterEach(cleanup);

const CONTEXT: ProjectTopicContext = {
  projectId: "p1",
  title: "Given title",
  leaf: { leafId: "board", onSelect: () => {} },
  workspaceSlug: "acme",
  projectName: "Website relaunch",
  renderTransferOwnership: () => null,
};

describe("projectTopics", () => {
  it("publishes a project's topics in rail order", () => {
    // The order is a sentence about the project: what it is, what it is doing, what that work is
    // aimed at, when it is being done, what it rolls up into, what it holds, what happened, who
    // may look. Within the middle run the split is by SCOPE — the board's own plan (Milestones)
    // before the two topics that reach past it (Iterations, Programs).
    expect(projectTopics({ workspaceSlug: "acme" }).map((t) => t.id)).toEqual([
      "overview",
      "work-items",
      "milestones",
      "iterations",
      "programs",
      "contents",
      "activity",
      "access",
    ]);
  });

  it("omits Access when the host does not know the owning workspace", () => {
    // Not a cosmetic choice: ItemAccessPanel resolves subjects IN a workspace, so without one
    // the topic could only ever render an empty pane. A rail row that opens onto nothing reads
    // as a bug; leaving the topic out says the true thing.
    //
    // Iterations and Programs survive the same condition on purpose, and the difference is what
    // they can still show: without a workspace both lists fall back to the caller's own reach,
    // exactly as the project list does, so each pane has something true to render.
    expect(projectTopics({}).map((t) => t.id)).toEqual([
      "overview",
      "work-items",
      "milestones",
      "iterations",
      "programs",
      "contents",
      "activity",
    ]);
  });

  it("gives every topic a description, which is what earns both rails their overview cards", () => {
    // ResourceExplorer and StackGroupDetail each upgrade the no-selection leaf to the standard
    // TopicOverview only when descriptions are present — so a topic added without one silently
    // downgrades that landing for BOTH surfaces.
    for (const topic of projectTopics({ workspaceSlug: "acme" })) {
      expect(topic.description.length).toBeGreaterThan(0);
    }
  });

  it("hands each pane the context's title, project, and leaf", () => {
    for (const topic of projectTopics({ workspaceSlug: "acme" })) {
      render(<>{topic.render(CONTEXT)}</>);
    }
    expect(screen.getByTestId("overview").getAttribute("data-title")).toBe("Given title");
    expect(screen.getByTestId("overview").getAttribute("data-project")).toBe("p1");
    // The four topics with a deep-linkable inner selection: each surface's leaf has to reach it,
    // or the view switcher / the open iteration / the open milestone / the open program stops
    // round-tripping through the URL.
    expect(screen.getByTestId("work-items").getAttribute("data-leaf")).toBe("board");
    expect(screen.getByTestId("milestones").getAttribute("data-leaf")).toBe("board");
    expect(screen.getByTestId("iterations").getAttribute("data-leaf")).toBe("board");
    expect(screen.getByTestId("programs").getAttribute("data-leaf")).toBe("board");
    expect(screen.getByTestId("milestones").getAttribute("data-project")).toBe("p1");
    expect(screen.getByTestId("contents").getAttribute("data-project")).toBe("p1");
    expect(screen.getByTestId("activity").getAttribute("data-title")).toBe("Given title");
  });

  it("hands the owning workspace to every pane whose data is the WORKSPACE's, not the project's", () => {
    // An iteration and a program both belong to a workspace, so each pane that lists them — and
    // the two panes that let a record JOIN one (a card's cycle, a board's program) — must be told
    // which workspace. A topic wired without it reads from the caller's whole reach and silently
    // offers cycles, or programs, from somewhere else.
    //
    // Milestones is the deliberate absence from this list: it is the one plan topic scoped to the
    // board, so it takes a projectId and no workspace at all.
    for (const topic of projectTopics({ workspaceSlug: "acme" })) {
      render(<>{topic.render(CONTEXT)}</>);
    }
    expect(screen.getByTestId("iterations").getAttribute("data-workspace")).toBe("acme");
    expect(screen.getByTestId("programs").getAttribute("data-workspace")).toBe("acme");
    expect(screen.getByTestId("work-items").getAttribute("data-workspace")).toBe("acme");
    expect(screen.getByTestId("overview").getAttribute("data-workspace")).toBe("acme");
  });

  it("forwards the host's Transfer Ownership section to Overview, and nothing when there is none", () => {
    const overview = projectTopics({})[0]!;
    render(<>{overview.render(CONTEXT)}</>);
    expect(screen.getByTestId("overview").getAttribute("data-transfer")).toBe("given");
    cleanup();
    render(<>{overview.render({ ...CONTEXT, renderTransferOwnership: undefined })}</>);
    expect(screen.getByTestId("overview").getAttribute("data-transfer")).toBe("absent");
  });

  it("labels the Access panel with the project's name, not its id", () => {
    const access = projectTopics({ workspaceSlug: "acme" }).find((t) => t.id === "access")!;
    render(<>{access.render(CONTEXT)}</>);
    const panel = screen.getByTestId("access");
    expect(panel.getAttribute("data-workspace")).toBe("acme");
    expect(panel.getAttribute("data-item")).toBe("p1");
    expect(panel.getAttribute("data-label")).toBe("Website relaunch");
  });
});
