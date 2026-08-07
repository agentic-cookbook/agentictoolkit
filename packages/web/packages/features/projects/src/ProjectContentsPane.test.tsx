// @vitest-environment jsdom
//
// Component test for ProjectContentsPane — what a project HOLDS.
//
// Only the api-client boundary (@agentic-toolkit/data/projects) is mocked, so the load →
// pick → attach → reload and the detach wiring are exercised, not the transport. Two
// properties get the most attention here because they are the ones a screenshot cannot check:
//
//   1. The pane is KIND-AGNOSTIC. Every assertion below uses a kind the pane has never heard
//      of alongside the two that exist today; if anything in the pane ever branches on a kind,
//      the invented one stops rendering and these fail.
//   2. A pointer that no longer resolves still counts. The backend hands back `target: null`
//      for a deleted or unreachable target, and the row must survive it — dropping the row
//      would quietly shrink a project's history.
//
// @agentic-toolkit/data is deliberately NOT mocked: the attached list runs through the REAL
// useResourceList, including its module-scope cache. That cache is keyed `project:<id>:artifacts`
// and OUTLIVES cleanup(), so rows carry between tests that use the same project id. Harmless
// while they all stub the same four rows; a test that stubs a DIFFERENT list uses its own id, or
// it would seed the next one's first paint with rows that test never asked for.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", () => ({
  projectArtifactsApi: {
    list: vi.fn(),
    attachable: vi.fn(),
    link: vi.fn(),
    unlink: vi.fn(),
  },
}));

import { ProjectContentsPane } from "./ProjectContentsPane";
import {
  projectArtifactsApi,
  type ProjectArtifact,
  type TargetDescriptor,
} from "@agentic-toolkit/data/projects";

const list = vi.mocked(projectArtifactsApi.list);
const attachable = vi.mocked(projectArtifactsApi.attachable);
const link = vi.mocked(projectArtifactsApi.link);
const unlink = vi.mocked(projectArtifactsApi.unlink);

const DOC: ProjectArtifact = {
  id: "a1",
  projectId: "p1",
  direction: "ingested",
  targetKind: "content.markdown",
  targetId: "d1",
  target: {
    kind: "content.markdown",
    id: "d1",
    title: "Competitor teardown",
    subtitle: "Draft",
    url: null,
  },
  createdAt: "2026-08-01T00:00:00Z",
};

const SAVED_URL: ProjectArtifact = {
  id: "a2",
  projectId: "p1",
  direction: "produced",
  targetKind: "content.urls",
  targetId: "u1",
  target: {
    kind: "content.urls",
    id: "u1",
    title: "Launch announcement",
    subtitle: "example.com",
    url: "https://example.com/launch",
  },
  createdAt: "2026-08-02T00:00:00Z",
};

/** A kind invented for this file. It exists nowhere in the registry, which is the point: the
 *  pane must render it exactly like the two real ones. */
const UNKNOWN_KIND: ProjectArtifact = {
  id: "a3",
  projectId: "p1",
  direction: "ingested",
  targetKind: "warehouse.datasets",
  targetId: "w1",
  target: {
    kind: "warehouse.datasets",
    id: "w1",
    title: "Q3 telemetry",
    subtitle: null,
    url: null,
  },
  createdAt: "2026-08-03T00:00:00Z",
};

/** A link whose target has been deleted since — the backend resolves it to null. */
const DANGLING: ProjectArtifact = {
  id: "a4",
  projectId: "p1",
  direction: "produced",
  targetKind: "content.markdown",
  targetId: "gone",
  target: null,
  createdAt: "2026-08-04T00:00:00Z",
};

const CANDIDATES: TargetDescriptor[] = [
  { kind: "content.markdown", id: "d2", title: "Pricing research", subtitle: null, url: null },
  {
    kind: "content.urls",
    id: "u2",
    title: "Postmortem thread",
    subtitle: "news.example",
    url: "https://news.example/t/9",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue(
    [DOC, SAVED_URL, UNKNOWN_KIND, DANGLING].map((a) => structuredClone(a)),
  );
  attachable.mockResolvedValue(structuredClone(CANDIDATES));
  link.mockResolvedValue(structuredClone(DOC));
  unlink.mockResolvedValue(undefined);
});

afterEach(cleanup);

/** Open the candidate picker and return its listbox. */
function openPicker(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Content" }));
  return screen.getByRole("listbox", { name: "Content" });
}

describe("ProjectContentsPane", () => {
  it("shows what the project ingested and what it produced, under their own headings", async () => {
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    expect(await screen.findByText("Competitor teardown")).not.toBeNull();
    expect(screen.getByText("Launch announcement")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Ingested" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Produced" })).not.toBeNull();
    await waitFor(() => expect(list).toHaveBeenCalledWith("p1"));
  });

  it("renders a kind it has never heard of, badged by its last segment", async () => {
    // The whole point of the target registry: a kind added on the backend shows up in a bundle
    // built before it existed. If this ever fails, something in the pane learned about kinds.
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    expect(await screen.findByText("Q3 telemetry")).not.toBeNull();
    expect(screen.getByText("datasets")).not.toBeNull();
    // Two of the four rows are markdown (one of them the dangling pointer), so the badge is
    // rendered from the LINK's kind rather than the resolution — it survives target: null.
    expect(screen.getAllByText("markdown")).toHaveLength(2);
    expect(screen.getByText("urls")).not.toBeNull();
  });

  it("links a target that lives outside the platform to its address", async () => {
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    const anchor = (await screen.findByText("Launch announcement")).closest("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/launch");
    // A document has no address to open — it must NOT become a link to nowhere.
    expect((await screen.findByText("Competitor teardown")).closest("a")).toBeNull();
  });

  it("keeps a row whose target no longer resolves, and says so", async () => {
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    expect(await screen.findByText("No longer available")).not.toBeNull();
    // Still detachable — an unresolvable link is precisely the one a user wants to clear.
    expect(screen.getByRole("button", { name: "Detach gone" })).not.toBeNull();
  });

  it("offers candidates by title and attaches the chosen one with the chosen direction", async () => {
    render(<ProjectContentsPane projectId="p1" title="Contents" />);
    await screen.findByText("Competitor teardown");
    await waitFor(() => expect(attachable).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "produced" } });
    openPicker();
    // Titles, not `(kind, id)` pointers — the pointer is the pane's business, not a reader's.
    fireEvent.click(screen.getByRole("option", { name: "Pricing research" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));

    await waitFor(() =>
      expect(link).toHaveBeenCalledWith("p1", {
        direction: "produced",
        targetKind: "content.markdown",
        targetId: "d2",
      }),
    );
    // The list is re-read rather than patched in place, so the row arrives RESOLVED.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("distinguishes two candidates that share an id but not a kind", async () => {
    // The picker commits ONE string, and neither half of a target's address identifies it
    // alone. Two kinds may legitimately use the same id; if the composite key ever collapses to
    // the id, this attaches the wrong thing while looking entirely correct.
    attachable.mockResolvedValue([
      { kind: "content.markdown", id: "same", title: "A document", subtitle: null, url: null },
      { kind: "content.urls", id: "same", title: "A saved link", subtitle: null, url: null },
    ]);
    render(<ProjectContentsPane projectId="p1" title="Contents" />);
    await waitFor(() => expect(attachable).toHaveBeenCalled());

    openPicker();
    fireEvent.click(screen.getByRole("option", { name: "A saved link" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));

    await waitFor(() =>
      expect(link).toHaveBeenCalledWith("p1", {
        direction: "ingested",
        targetKind: "content.urls",
        targetId: "same",
      }),
    );
  });

  it("detaches by the LINK's id, not the target's", async () => {
    // The same target can be linked twice (once ingested, once produced), so addressing a
    // detach by target id would remove an unpredictable one of them.
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    fireEvent.click(await screen.findByRole("button", { name: "Detach Competitor teardown" }));

    await waitFor(() => expect(unlink).toHaveBeenCalledWith("p1", "a1"));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("surfaces a failed attach inline instead of dropping it", async () => {
    link.mockRejectedValue(new Error("Target not found"));
    render(<ProjectContentsPane projectId="p1" title="Contents" />);
    await waitFor(() => expect(attachable).toHaveBeenCalled());

    openPicker();
    fireEvent.click(screen.getByRole("option", { name: "Pricing research" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));

    expect(await screen.findByText("Target not found")).not.toBeNull();
  });

  it("still reads when the picker cannot be filled", async () => {
    // A candidate search that fails is not a reason to hide a project's contents.
    attachable.mockRejectedValue(new Error("nope"));
    render(<ProjectContentsPane projectId="p1" title="Contents" />);

    expect(await screen.findByText("Competitor teardown")).not.toBeNull();
    expect(screen.queryByText("nope")).toBeNull();
  });

  // Its own project id: this is the one test that stubs a DIFFERENT list, and the shared cache
  // is keyed by project (see the docblock).
  it("says which side is empty rather than showing one empty box for both", async () => {
    list.mockResolvedValue([structuredClone(DOC)]);
    render(<ProjectContentsPane projectId="one-sided" title="Contents" />);

    expect(await screen.findByText("Competitor teardown")).not.toBeNull();
    await waitFor(() => expect(screen.getByText("Nothing produced yet.")).not.toBeNull());
    expect(screen.queryByText("Nothing ingested yet.")).toBeNull();
  });

  // A read that fails leaves the rows unknown, and "Loading…" would be a promise the pane is
  // not keeping — as would either empty state, each of which asserts a fact it does not have.
  it("says what went wrong instead of loading forever", async () => {
    list.mockRejectedValue(new Error("Contents unavailable"));
    render(<ProjectContentsPane projectId="unreadable" title="Contents" />);

    expect(await screen.findByText("Contents unavailable")).not.toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(screen.queryByText("Nothing ingested yet.")).toBeNull();
    expect(screen.queryByText("Nothing produced yet.")).toBeNull();
  });
});
