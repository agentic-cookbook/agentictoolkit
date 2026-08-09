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
    // The Overview topic renders ProjectOverviewPane, which summarises five lists it does not
    // own — stub every one, or the pane's reads reject on an undefined client and the topic
    // renders its zero states for a reason that has nothing to do with this file.
    statuses: { list: vi.fn().mockResolvedValue([]) },
    participants: { list: vi.fn().mockResolvedValue([]) },
  },
  projectWorkItemsApi: { listForProject: vi.fn().mockResolvedValue([]) },
  projectArtifactsApi: { list: vi.fn().mockResolvedValue([]) },
  projectActivityApi: {
    projectActivity: vi.fn().mockResolvedValue({ rows: [], nextBefore: null }),
  },
  projectProgramsApi: { list: vi.fn().mockResolvedValue([]) },
  // Plain data, but `./vocabulary` imports them from this module — a whole-module mock that omits
  // them breaks the import chain, not just the value.
  DEFAULT_ITEM_NOUN: "work item",
  DEFAULT_ITEM_NOUN_PLURAL: "work items",
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
  keyPrefix: "WEB",
  ecosystemId: "eco1",
  archivedAt: null,
  // The three board settings, each at its default. Always present on a Project — `toProject`
  // fills them in — so a fixture without them is a shape the client never hands out.
  estimateScale: "none",
  priorityScale: "standard",
  itemNoun: "work item",
  itemNounPlural: "work items",
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(PROJECT)]);
  get.mockResolvedValue(structuredClone(PROJECT));
  create.mockResolvedValue(structuredClone(PROJECT));
});

// Explicit and redundant, deliberately: this package's vitest runs with `globals: true`
// (packages/web/packages/features/vitest.preset.ts:16), so RTL 16.3.2's own shipped
// `afterEach(cleanup)` DOES register (@testing-library/react/dist/index.js:23-30), and cleanup
// is idempotent. An earlier version of this comment asserted the opposite — no global afterEach,
// auto-cleanup never registers — and both halves were false. Keep the call if you like it as a
// local statement of intent; do not "fix" the config to match the claim that was here.
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
      expect(create).toHaveBeenCalledWith(
        { name: "Mobile app", description: undefined },
        // No workspaceSlug prop in this harness → creator-owned (workspace undefined).
        { workspace: undefined },
      ),
    );
  });

  it("renders the Overview topic for the selected project", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/w1/projects" activeProjectId="p1" activeTopic="overview" />
      </Harness>,
    );

    // Overview fetches the single project and leads with what it IS — its description and its
    // lifecycle status, read-only. (The editable name/status fields are still there, but behind
    // a closed "Project settings" disclosure; ProjectOverviewPane.test.tsx owns that form.)
    expect(await screen.findByText("Rework the marketing site.")).not.toBeNull();
    expect(screen.getByText("active")).not.toBeNull();
    await waitFor(() => expect(get).toHaveBeenCalledWith("p1"));
  });

  it("scopes the list to the workspace prop, which is now the shell's to supply", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/home/mine" workspaceSlug="mine" all />
      </Harness>,
    );

    // The site's shape after the refactor: basePath already carries the workspace, and the
    // slug arrives as a prop — no leading Workspaces level, no waiting on a list the feature
    // fetches itself. Previously this call was gated behind `scopePending`.
    expect(await screen.findByText("Website relaunch")).not.toBeNull();
    await waitFor(() => expect(list).toHaveBeenCalledWith({ workspace: "mine" }));
  });

  it("links a project at /home/<ws>/<id>, not just /home/<id>", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/home/mine" workspaceSlug="mine" all />
      </Harness>,
    );

    // The landing card's href is built from `basePath` (ResourceExplorer's
    // `cardHref`), so this pins that `basePath` is the FULL base — workspace
    // included — rather than a bare `/home` a caller might pass by mistake. A
    // wrong base here means a project click resolves to the wrong workspace
    // segment and SiteHomeShell bounces the user back to their default workspace.
    const link = (await screen.findByText("Website relaunch")).closest("a");
    expect(link?.getAttribute("href")).toBe("/home/mine/p1");
  });

  it("creates a project scoped to the given workspace, not the creator", async () => {
    render(
      <Harness>
        <ProjectsFeature basePath="/home/acme" workspaceSlug="acme" all />
      </Harness>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "New Project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Mobile app" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // Distinct from the no-slug case above: an org workspace's create must carry
    // that org's slug, or the project is created creator-owned and invisible to
    // the rest of the org.
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        { name: "Mobile app", description: undefined },
        { workspace: "acme" },
      ),
    );
  });
});
