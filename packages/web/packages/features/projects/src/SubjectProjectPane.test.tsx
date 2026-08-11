// @vitest-environment jsdom
//
// Component test for SubjectProjectPane — the "Project" topic of a product or a persona.
//
// Only `subjectProject` is stubbed (through `importOriginal`, so the rest of the projects api
// module is the real one): what is under test is the RESOLUTION, which is the pane's whole job
// before it hands off to the shared project rail. Every case below therefore stops at one of the
// three pre-rail branches — error, loading, absent — which is also what keeps this file free of a
// rail host it would otherwise need to stand up.
//
// The resolution reads through the shared cache, whose teardown is the package's `vitest-setup`
// afterEach; each test starts from an empty one.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";

// The rail host's exit guard reaches for the App Router. Nothing here navigates; this is the
// context that hook needs to exist at all.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data/projects")>();
  return {
    ...actual,
    projectsApi: { ...actual.projectsApi, subjectProject: vi.fn() },
    // The board wake is a live subscription, not this pane's subject.
    useProjectLive: vi.fn(),
  };
});

import { SubjectProjectPane } from "./SubjectProjectPane";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";
import { getToolkitQueryClient } from "@agentic-toolkit/data/query";
import { RailHostBoundary } from "@agentic-toolkit/resource";

const subjectProject = vi.mocked(projectsApi.subjectProject);

/** A resolved project, for the one case below that gets past the pre-rail branches. */
const PROJECT: Project = {
  id: "proj-1",
  name: "Bitbag",
  description: "",
  status: "active",
  color: "#007AFF",
  keyPrefix: "BIT",
  ecosystemId: "eco-1",
  archivedAt: null,
  estimateScale: "none",
  priorityScale: "none",
  itemNoun: "work item",
  itemNounPlural: "work items",
  startDate: null,
  targetDate: null,
  leadKind: null,
  leadId: null,
  programId: null,
  health: null,
  healthUpdatedAt: null,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  subjectProject.mockResolvedValue(null);
});

afterEach(cleanup);

describe("SubjectProjectPane", () => {
  it("paints the resolution from cache on a remount, resolving it once", async () => {
    render(<SubjectProjectPane subjectKind="ecosystem" subjectId="eco-1" />);
    expect(await screen.findByText("No project yet")).not.toBeNull();
    expect(subjectProject).toHaveBeenCalledTimes(1);
    cleanup();

    // Synchronous, unlike the `findByText` above: re-entering the topic paints the answer it
    // already has instead of blanking to "Loading…" while it asks again.
    render(<SubjectProjectPane subjectKind="ecosystem" subjectId="eco-1" />);
    expect(screen.getByText("No project yet")).not.toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(subjectProject).toHaveBeenCalledTimes(1);
  });

  it("keys the resolution on the subject PAIR, since a persona and a product can share an id", async () => {
    render(<SubjectProjectPane subjectKind="ecosystem" subjectId="shared" />);
    expect(await screen.findByText("No project yet")).not.toBeNull();
    expect(subjectProject).toHaveBeenCalledTimes(1);
    cleanup();

    render(<SubjectProjectPane subjectKind="persona" subjectId="shared" />);
    expect(await screen.findByText("No project yet")).not.toBeNull();
    // A SECOND read. Were the id alone the key, the product's answer would have been served to
    // the persona — two different projects behind one cache entry.
    expect(subjectProject).toHaveBeenCalledTimes(2);
    expect(subjectProject).toHaveBeenLastCalledWith("persona", "shared");
  });

  it("distinguishes a subject with no project from one still being resolved", async () => {
    // `null` is a real ANSWER here, so it cannot also mean "not read yet" — which is why the
    // fetcher wraps it. Collapse the two and an unprovisioned subject loads forever.
    render(<SubjectProjectPane subjectKind="persona" subjectId="p-1" />);
    expect(screen.getByText("Loading…")).not.toBeNull();
    expect(await screen.findByText("No project yet")).not.toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("says what went wrong instead of loading forever", async () => {
    subjectProject.mockRejectedValue(new Error("Project service unavailable"));
    render(<SubjectProjectPane subjectKind="ecosystem" subjectId="eco-2" />);

    expect(await screen.findByText("Project service unavailable")).not.toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});

// The one case that has to go PAST the three pre-rail branches, and therefore the one case that
// needs a rail host. It is also the case the cache created: once a subject's project is remembered,
// the "Loading…" branch above stops appearing on re-entry, and if nothing else reports the re-read
// then the second visit is silent about the fact that what is on screen is unconfirmed.
describe("the subject's project rail says when it is being re-read", () => {
  const spinner = () =>
    within(screen.getByRole("complementary", { name: "Topic list" })).queryByRole("status", {
      name: "Loading",
    });

  it("spins in front of the project's name while the cached copy is revalidated", async () => {
    subjectProject.mockResolvedValue(PROJECT);
    render(
      <RailHostBoundary>
        <SubjectProjectPane subjectKind="persona" subjectId="p-2" />
      </RailHostBoundary>,
    );
    expect(await screen.findByText("Bitbag")).not.toBeNull();
    await waitFor(() => expect(spinner()).toBeNull());
    cleanup();

    // What five minutes' `staleTime` does on its own, done deliberately: the copy is still good
    // enough to paint, it is simply no longer trusted, so the next mount reads behind it.
    await getToolkitQueryClient().invalidateQueries();
    let land: (p: Project) => void = () => {
      throw new Error("the revalidation never ran");
    };
    subjectProject.mockImplementation(() => new Promise<Project>((r) => (land = r)));

    render(
      <RailHostBoundary>
        <SubjectProjectPane subjectKind="persona" subjectId="p-2" />
      </RailHostBoundary>,
    );
    // Instant and unconfirmed at the same time: the name is already there, with no "Loading…"
    // anywhere, and the spinner is the only thing saying a read is out.
    expect(screen.getByText("Bitbag")).not.toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(spinner()).not.toBeNull();

    land({ ...PROJECT, name: "Bitbag" });
    await waitFor(() => expect(spinner()).toBeNull());
  });
});
