// @vitest-environment jsdom
//
// Component test for ProjectsCommandPalette — the ⌘K surface. The shared palette's own keyboard,
// grouping and empty/error rendering are covered in @agentic-toolkit/ui; what is Projects-specific,
// and what this file is for, is: which three groups exist, when the cross-board search is actually
// asked, and — the part with real consequences — how a chosen hit is OPENED. That last one has two
// answers (write the param when the board is already on screen, navigate otherwise) and getting it
// wrong is invisible in a screenshot: the wrong branch either remounts the whole pane or silently
// does nothing.
//
// Only the search client and Next's router are mocked; the palette's own debounce runs on fake
// timers, because "does not fire a request per keystroke" is a claim about timing.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

// PARTIAL (importOriginal-spread): only the one client this surface calls is stubbed — the topic
// declarations it imports pull in panes that read pure folds from the same barrel.
vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectSearchApi: { workItems: vi.fn() },
}));

import { ProjectsCommandPalette } from "./ProjectsCommandPalette";
import { WORK_ITEM_PARAM } from "./work-item-link";
import {
  projectSearchApi,
  type Project,
  type WorkItemSearchHit,
  type WorkItemSearchPage,
} from "@agentic-toolkit/data/projects";

const searchWorkItems = vi.mocked(projectSearchApi.workItems);

const project = (id: string, name: string): Project =>
  ({
    id,
    name,
    description: "",
    status: "active",
    color: "blue",
    keyPrefix: name.slice(0, 3).toUpperCase(),
    ecosystemId: "eco-1",
    archivedAt: null,
    estimateScale: "none",
    priorityScale: "standard",
    itemNoun: "work item",
    itemNounPlural: "work items",
    startDate: null,
    targetDate: null,
    leadKind: null,
    leadId: null,
    programId: null,
  }) as Project;

const PROJECTS = [project("p1", "Website relaunch"), project("p2", "Mobile app")];

const hit = (extra: Partial<WorkItemSearchHit> = {}): WorkItemSearchHit => ({
  id: "w1",
  projectId: "p1",
  projectName: "Website relaunch",
  itemKey: "WEB-42",
  title: "Design the landing page",
  statusId: "s1",
  updatedAt: "2026-08-01T00:00:00.000Z",
  snippet: "…the landing page…",
  rank: 0.9,
  ...extra,
});

const page = (results: WorkItemSearchHit[]): WorkItemSearchPage => ({
  results,
  limit: 8,
  hasMore: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  searchWorkItems.mockResolvedValue(page([]));
  window.history.replaceState(null, "", "/acme/projects");
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function mount(props: Partial<React.ComponentProps<typeof ProjectsCommandPalette>> = {}): void {
  render(
    <ProjectsCommandPalette
      basePath="/acme/projects"
      projects={PROJECTS}
      workspaceSlug="acme"
      {...props}
    />,
  );
}

/** ⌘K. jsdom reports no Apple platform, so the registry resolves `mod` to Ctrl. */
function pressModK(): void {
  act(() => {
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
  });
}

const field = (): HTMLInputElement =>
  screen.getByRole("combobox", { name: "Find a work item or project" }) as HTMLInputElement;

/** Type, then let the debounce elapse and the response settle. */
async function type(text: string, { settle = true } = {}): Promise<void> {
  fireEvent.change(field(), { target: { value: text } });
  if (!settle) return;
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
}

describe("ProjectsCommandPalette — opening", () => {
  it("opens on ⌘K and closes on a second press", () => {
    mount();
    expect(screen.queryByRole("combobox")).toBeNull();

    pressModK();
    expect(field()).toBeInTheDocument();

    pressModK();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("opens from inside a text field — which is the whole point of the chord", () => {
    render(
      <>
        <input aria-label="Title" />
        <ProjectsCommandPalette basePath="/acme/projects" projects={PROJECTS} />
      </>,
    );
    act(() => {
      fireEvent.keyDown(screen.getByLabelText("Title"), { key: "k", ctrlKey: true });
    });
    expect(field()).toBeInTheDocument();
  });

  it("reopens on a BLANK query rather than resuming a search the user moved on from", async () => {
    mount();
    pressModK();
    await type("landing");
    expect(field()).toHaveValue("landing");

    pressModK();
    pressModK();
    expect(field()).toHaveValue("");
  });

  it("shows the keyboard legend and the chord that opened it", () => {
    mount();
    pressModK();
    expect(screen.getByText("↑↓ to move · ↵ to open · Esc to close")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
  });
});

describe("ProjectsCommandPalette — the cross-board search", () => {
  it("asks nothing until the query is a question, and says so", async () => {
    mount();
    pressModK();
    // One character matching no project, so nothing local fills the pane and the hint is what
    // is left to render.
    await type("z");
    expect(searchWorkItems).not.toHaveBeenCalled();
    expect(
      screen.getByText("Type to search work items across every board you can see."),
    ).toBeInTheDocument();
  });

  it("asks ONCE for a burst of keystrokes, scoped to the workspace", async () => {
    mount();
    pressModK();
    await type("la", { settle: false });
    await type("lan", { settle: false });
    await type("land");
    expect(searchWorkItems).toHaveBeenCalledTimes(1);
    expect(searchWorkItems).toHaveBeenCalledWith("land", { workspace: "acme", limit: 8 });
  });

  it("searches the caller's whole reach when the host names no workspace", async () => {
    mount({ workspaceSlug: undefined });
    pressModK();
    await type("land");
    expect(searchWorkItems).toHaveBeenCalledWith("land", { workspace: undefined, limit: 8 });
  });

  it("renders a hit with its key and the board it lives on", async () => {
    searchWorkItems.mockResolvedValue(page([hit()]));
    mount();
    pressModK();
    await type("land");

    const row = screen.getByRole("option", { name: /Design the landing page/ });
    expect(row).toHaveTextContent("WEB-42");
    expect(row).toHaveTextContent("…the landing page…");
    // The board, on the row: this is the one group whose hits can come from a project the rail
    // never listed, and without it a cross-board result set is unreadable.
    expect(row).toHaveTextContent("Website relaunch");
  });

  it("drops a response that a newer keystroke has already superseded", async () => {
    let resolveFirst: (p: WorkItemSearchPage) => void = () => {};
    searchWorkItems.mockImplementationOnce(
      () => new Promise<WorkItemSearchPage>((resolve) => (resolveFirst = resolve)),
    );
    searchWorkItems.mockResolvedValueOnce(page([hit({ id: "w2", title: "Write the copy" })]));

    mount();
    pressModK();
    await type("land");
    await type("copy");

    // The first request answers LAST, with results for a query the user has moved past.
    await act(async () => {
      resolveFirst(page([hit({ id: "w1", title: "Design the landing page" })]));
    });
    expect(screen.queryByRole("option", { name: /Design the landing page/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Write the copy/ })).toBeInTheDocument();
  });

  it("shows the failure rather than an empty result set", async () => {
    searchWorkItems.mockRejectedValue(new Error("Search is unavailable."));
    mount();
    pressModK();
    await type("land");
    expect(screen.getByText("Search is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).toBeNull();
  });
});

describe("ProjectsCommandPalette — the local groups", () => {
  it("offers the rail's projects, narrowed locally and with no request", async () => {
    mount();
    pressModK();
    await type("mob");
    expect(screen.getByRole("option", { name: /Mobile app/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Website relaunch/ })).toBeNull();
  });

  it("navigates to a chosen project's overview", async () => {
    mount();
    pressModK();
    await type("mob");
    fireEvent.click(screen.getByRole("option", { name: /Mobile app/ }));
    expect(push).toHaveBeenCalledWith("/acme/projects/p2/overview");
  });

  it("has no Go-to group until a project is open", () => {
    mount();
    pressModK();
    expect(screen.queryByRole("group", { name: "Go to" })).toBeNull();
  });

  it("offers the OPEN project's topics, and routes to one", async () => {
    mount({ activeProjectId: "p1", activeTopic: "overview" });
    pressModK();
    await type("mile");
    const row = screen.getByRole("option", { name: /Milestones/ });
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith("/acme/projects/p1/milestones");
  });

  it("lists nothing at all for a query nothing matches", async () => {
    mount();
    pressModK();
    await type("tungsten");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});

describe("ProjectsCommandPalette — opening a hit", () => {
  it("NAVIGATES to a hit on a board that is not on screen", async () => {
    searchWorkItems.mockResolvedValue(page([hit({ projectId: "p2", projectName: "Mobile app" })]));
    mount({ activeProjectId: "p1", activeTopic: "work-items" });
    pressModK();
    await type("land");
    fireEvent.click(screen.getByRole("option", { name: /Design the landing page/ }));

    expect(push).toHaveBeenCalledWith("/acme/projects/p2/work-items/list?item=w1");
    expect(window.location.search).toBe("");
  });

  it("navigates when the right board is open on ANOTHER topic", async () => {
    searchWorkItems.mockResolvedValue(page([hit()]));
    mount({ activeProjectId: "p1", activeTopic: "milestones" });
    pressModK();
    await type("land");
    fireEvent.click(screen.getByRole("option", { name: /Design the landing page/ }));
    expect(push).toHaveBeenCalledWith("/acme/projects/p1/work-items/list?item=w1");
  });

  it("writes the PARAM when that board's work items are already mounted — no remount", async () => {
    searchWorkItems.mockResolvedValue(page([hit()]));
    mount({ activeProjectId: "p1", activeTopic: "work-items" });
    pressModK();
    await type("land");
    fireEvent.click(screen.getByRole("option", { name: /Design the landing page/ }));

    expect(push).not.toHaveBeenCalled();
    // The surface reads exactly this — see work-item-link.ts.
    expect(new URLSearchParams(window.location.search).get(WORK_ITEM_PARAM)).toBe("w1");
  });

  it("closes on its way out, whichever branch ran", async () => {
    searchWorkItems.mockResolvedValue(page([hit()]));
    mount({ activeProjectId: "p1", activeTopic: "work-items" });
    pressModK();
    await type("land");
    fireEvent.click(screen.getByRole("option", { name: /Design the landing page/ }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
