// @vitest-environment jsdom
//
// Component tests for TeamsFeature's HOST-SCOPING states — the seam this branch's reviews
// worked hardest on. Only the data subpaths (teams, ecosystems) and next/navigation are
// mocked; the list/landing wiring (useResourceList + ResourceExplorer + the rail-host
// publish path) runs for real inside the same minimal host harness the sibling features'
// tests use.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@agentic-toolkit/data/teams", () => ({
  teamsApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  teamMembersApi: {
    counts: vi.fn(),
  },
}));

vi.mock("@agentic-toolkit/data/ecosystems", () => ({
  ecosystemsApi: {
    ecosystemIdForSlug: vi.fn(),
  },
}));

import { TeamsFeature } from "./TeamsFeature";
import { teamsApi, teamMembersApi, type Team } from "@agentic-toolkit/data/teams";
import { ecosystemsApi } from "@agentic-toolkit/data/ecosystems";

const listMock = vi.mocked(teamsApi.list);
const countsMock = vi.mocked(teamMembersApi.counts);
const idForSlugMock = vi.mocked(ecosystemsApi.ecosystemIdForSlug);

const TEAM: Team = {
  id: "t1",
  identifier: "team.acme.core",
  displayName: "Core Team",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
} as Team;

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([structuredClone(TEAM)]);
  countsMock.mockResolvedValue(new Map());
  idForSlugMock.mockResolvedValue("eco1");
});

afterEach(cleanup);

function Rail({ levels }: { levels: TopicLevel[] }) {
  return (
    <div>
      {levels.map((l) => (
        <div key={l.id}>
          {l.items.map((item) => (
            <button key={item.id} type="button" onClick={() => l.onSelect(item.id)}>
              {item.label}
            </button>
          ))}
          {l.onNew && (
            <button type="button" onClick={() => l.onNew?.()}>
              {l.newLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

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
      popStack: () => {},
      reportMissing: () => {},
      reportBusy: () => {},
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

describe("TeamsFeature host-scoping states", () => {
  it("unscoped host (no workspaceSlug): defined empty state, creation suppressed, no data fetches", async () => {
    render(
      <Harness>
        <TeamsFeature basePath="/home" all />
      </Harness>,
    );
    // A DEFINED explanation — not an eternal spinner.
    expect(
      await screen.findByText(/teams aren't available on this site yet/i),
    ).toBeTruthy();
    // The create affordance is suppressed (its create could never succeed here).
    expect(screen.queryByText(/new team/i)).toBeNull();
    // The scoping posture is consistent: neither the list nor the sibling counts fetch fires.
    expect(listMock).not.toHaveBeenCalled();
    expect(countsMock).not.toHaveBeenCalled();
    expect(idForSlugMock).not.toHaveBeenCalled();
  });

  it("scoped host: resolves the workspace ecosystem, lists its teams, offers creation", async () => {
    render(
      <Harness>
        <TeamsFeature basePath="/acme/teams" workspaceSlug="acme" all />
      </Harness>,
    );
    // Renders in BOTH the published rail row and the "All teams" landing card.
    expect((await screen.findAllByText("Core Team")).length).toBeGreaterThan(0);
    expect(idForSlugMock).toHaveBeenCalledWith("acme");
    await waitFor(() => expect(listMock).toHaveBeenCalledWith("eco1"));
    expect(screen.getByText(/new team/i)).toBeTruthy();
  });

  it("scoped host whose slug resolves to NO ecosystem: defined empty state, creation suppressed", async () => {
    idForSlugMock.mockResolvedValue(null);
    render(
      <Harness>
        <TeamsFeature basePath="/acme/teams" workspaceSlug="acme" all />
      </Harness>,
    );
    expect(
      await screen.findByText(/no ecosystem to hold teams yet/i),
    ).toBeTruthy();
    expect(screen.queryByText(/new team/i)).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("scoped host whose lookup FAILS: defined retry message instead of an eternal spinner", async () => {
    idForSlugMock.mockRejectedValue(new Error("network"));
    render(
      <Harness>
        <TeamsFeature basePath="/acme/teams" workspaceSlug="acme" all />
      </Harness>,
    );
    expect(
      await screen.findByText(/couldn't load this workspace/i),
    ).toBeTruthy();
    expect(screen.queryByText(/new team/i)).toBeNull();
  });
});
