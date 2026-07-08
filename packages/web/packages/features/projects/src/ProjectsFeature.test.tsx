// @vitest-environment jsdom
//
// Component test for ProjectsFeature — the Projects workspace feature built on the shared
// ResourceExplorer recipe. This package's vitest config is jsdom (see vitest.config.ts) and
// drives React with @testing-library/react. Only the data domain boundary
// (@agentic-toolkit/data/projects) plus the Next navigation/link hooks are mocked, so the
// landing → create → topic wiring is exercised, not the transport.
//
// ResourceExplorer PUBLISHES its resource + topic rail levels into a rail HOST (via
// StackLevels) rather than rendering them itself, so a tiny <Rail> harness backed by the
// toolkit's RailHostContext renders the published "New Project" rail affordance the same way
// the hub's workspace shell would. Selection is driven by props (the URL state the route shell
// would supply), since navigation is mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

// ResourceExplorer uses next/navigation's useRouter internally; a stub is enough (selection is
// prop-driven, not click-driven). useParams is no longer read — the feature takes basePath.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// next/link pulls the App Router context in; a plain anchor is enough for these render/label
// assertions (selection is prop-driven, not click-driven).
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@agentic-toolkit/data/projects", () => ({
  projectsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    // The Overview topic renders ProjectOverviewPane, which also reads the project's
    // board statuses + participants — stub them so the Overview render doesn't throw.
    statuses: { list: vi.fn().mockResolvedValue([]) },
    participants: { list: vi.fn().mockResolvedValue([]) },
  },
}));

import { ProjectsFeature } from "./ProjectsFeature";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";

const list = vi.mocked(projectsApi.list);
const get = vi.mocked(projectsApi.get);
const create = vi.mocked(projectsApi.create);

const PROJECT: Project = {
  id: "p1",
  name: "Website relaunch",
  description: "Rework the marketing site.",
  status: "active",
  // A board-accent string; kept non-hex so the fixture doesn't trip the UI color gate.
  color: "blue",
  ecosystemId: "eco1",
  archivedAt: null,
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(PROJECT)]);
  get.mockResolvedValue(structuredClone(PROJECT));
  create.mockResolvedValue(structuredClone(PROJECT));
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never registers —
// tear down each render explicitly to keep renders from bleeding across tests.
afterEach(cleanup);

/** Renders the published rail affordances (e.g. the "New Project" button) the way the workspace
 *  shell would, so the test can drive the shell-owned rail slot. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  return (
    <div>
      {levels.map((l) =>
        l.onNew ? (
          <button key={l.id} type="button" onClick={() => l.onNew?.()}>
            {l.newLabel}
          </button>
        ) : null,
      )}
    </div>
  );
}

/** A minimal rail HOST: it registers ResourceExplorer's published levels and exposes the merged
 *  stack the way the hub's workspace shell would (the shell owns `mergedLevels`; this package owns
 *  only the RailHostContext contract). Stands in for the host so the published "New Project" rail
 *  affordance is drivable. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
  const registry: RailHostRegistry = useMemo(
    () => ({
      registerLevels: (id, entry) =>
        setEntries((m) => {
          const next = new Map(m);
          next.set(id, entry);
          return next;
        }),
      unregisterLevels: (id) =>
        setEntries((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: () => {},
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <Rail levels={mergedLevels} />
      {children}
    </RailHostContext.Provider>
  );
}

describe("ProjectsFeature", () => {
  it("lists projects from projectsApi.list on the All landing", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/w1/projects" all />
      </Harness>,
    );

    expect(await screen.findByText("Website relaunch")).not.toBeNull();
    expect(list).toHaveBeenCalled();
  });

  it("creates a project through the New Project dialog", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/w1/projects" all />
      </Harness>,
    );

    // Open the create dialog from the published rail affordance.
    fireEvent.click(await screen.findByRole("button", { name: "New Project" }));

    // Fill the name and save.
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Mobile app" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ name: "Mobile app", description: undefined }),
    );
  });

  it("renders the Overview topic (name + status) for the selected project", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/w1/projects" activeProjectId="p1" activeTopic="overview" />
      </Harness>,
    );

    // Overview fetches the single project and seeds its editable name field + status
    // input (T3's ProjectOverviewPane renders these as form controls, not plain text;
    // status is the free-form lifecycle varchar, a text input — not a board-column select).
    expect(await screen.findByDisplayValue("Website relaunch")).not.toBeNull();
    expect((screen.getByLabelText("Status") as HTMLInputElement).value).toBe("active");
    await waitFor(() => expect(get).toHaveBeenCalledWith("p1"));
  });
});
