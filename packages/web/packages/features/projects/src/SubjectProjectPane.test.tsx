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
import { render, screen, cleanup } from "@testing-library/react";

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
import { projectsApi } from "@agentic-toolkit/data/projects";

const subjectProject = vi.mocked(projectsApi.subjectProject);

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
