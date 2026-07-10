// @vitest-environment jsdom
//
// Component test for DashboardsFeature — the Dashboards (Site Monitoring) feature built on the
// shared StackGroupDetail / master-detail substrate. This package's vitest config is jsdom (see
// vitest.config.ts) and drives React with @testing-library/react. Only the data domain boundary
// (@agentic-toolkit/data/monitored-sites) plus next/navigation's router are mocked, so the
// section → row → editor wiring is exercised, not the transport.
//
// DashboardsFeature PUBLISHES its rail levels into a rail HOST (via StackGroupDetail /
// useMasterDetailLevel, both built on StackLevels/useStackLevel) rather than rendering them
// itself, so a tiny <Rail> harness backed by the toolkit's RailHostContext renders the published
// levels' rows AND "New …" affordances the same way the hub's workspace shell would. Unlike the
// Projects exemplar (whose rail only ever publishes a "New Project" button), Dashboards' TOP level
// (Groups / Sites) is itself the section picker, so the harness also renders each level's `items`
// as clickable rows.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

// DashboardsFeature uses next/navigation's useRouter internally (via useBasePathRoute); a stub is
// enough (selection is prop-driven, not click-driven, in these assertions).
const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@agentic-toolkit/data/monitored-sites", () => ({
  listGroups: vi.fn(),
  listSites: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  createSite: vi.fn(),
  updateSite: vi.fn(),
  deleteSite: vi.fn(),
  listEndpoints: vi.fn().mockResolvedValue([]),
  createEndpoint: vi.fn(),
  updateEndpoint: vi.fn(),
  deleteEndpoint: vi.fn(),
  ENDPOINT_KINDS: ["http", "tcp", "icmp"],
}));

import { DashboardsFeature } from "./DashboardsFeature";
import {
  listGroups,
  listSites,
  createGroup,
  createSite,
  type SiteGroupView,
  type SiteView,
} from "@agentic-toolkit/data/monitored-sites";

const listGroupsMock = vi.mocked(listGroups);
const listSitesMock = vi.mocked(listSites);
const createGroupMock = vi.mocked(createGroup);
const createSiteMock = vi.mocked(createSite);

const GROUP: SiteGroupView = {
  id: "g1",
  slug: "core-apis",
  name: "Core APIs",
  retentionDays: 30,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

const SITE: SiteView = {
  id: "s1",
  slug: "marketing-site",
  name: "Marketing Site",
  groupId: "g1",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  listGroupsMock.mockResolvedValue([structuredClone(GROUP)]);
  listSitesMock.mockResolvedValue([structuredClone(SITE)]);
  createGroupMock.mockResolvedValue(structuredClone(GROUP));
  createSiteMock.mockResolvedValue(structuredClone(SITE));
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never registers —
// tear down each render explicitly to keep renders from bleeding across tests.
afterEach(cleanup);

/** Renders the published rail affordances the way the workspace shell would: each level's rows as
 *  clickable buttons (so the Groups/Sites section picker and a group/site list are drivable),
 *  plus its "New …" button when published. */
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

/** A minimal rail HOST: it registers the published levels and exposes the merged stack the way the
 *  hub's workspace shell would (the shell owns `mergedLevels`; this package owns only the
 *  RailHostContext contract). Stands in for the host so the published section/row rail is drivable. */
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

describe("DashboardsFeature", () => {
  it("shows the empty hint when nothing is selected, with Groups/Sites in the rail", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" />
      </Harness>,
    );

    expect(await screen.findByText("Select Groups or Sites.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Groups" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sites" })).not.toBeNull();
  });

  it("renders the Groups section's list + editor when section='groups'", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" section="groups" />
      </Harness>,
    );

    // The group is published as a deeper rail row, and the editor's empty placeholder shows
    // since no row is selected yet.
    expect(await screen.findByRole("button", { name: "Core APIs" })).not.toBeNull();
    expect(screen.getByText("Select a group to edit, or create a new one.")).not.toBeNull();
    expect(listGroupsMock).toHaveBeenCalled();
  });

  it("opens the group editor when a row is selected (section + rowId)", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" section="groups" rowId="g1" />
      </Harness>,
    );

    expect(await screen.findByDisplayValue("Core APIs")).not.toBeNull();
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("core-apis");
  });

  it("renders the Sites section's list + editor when section='sites'", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" section="sites" />
      </Harness>,
    );

    expect(await screen.findByRole("button", { name: "Marketing Site" })).not.toBeNull();
    expect(listSitesMock).toHaveBeenCalled();
  });

  it("creates a group through the New group dialog", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" section="groups" />
      </Harness>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "New group" }));

    const dialog = await screen.findByRole("dialog", { name: "New group" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Payments" },
    });
    fireEvent.change(within(dialog).getByLabelText("Slug"), {
      target: { value: "payments" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(createGroupMock).toHaveBeenCalledWith(
        {
          name: "Payments",
          slug: "payments",
          retentionDays: 30,
        },
        // No workspaceSlug prop in this harness → creator-owned (workspace undefined).
        { workspace: undefined },
      ),
    );
  });

  it("creates a site through the New site dialog", async () => {
    render(
      <Harness>
        <DashboardsFeature basePath="/w1/dashboards" section="sites" />
      </Harness>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "New site" }));

    const dialog = await screen.findByRole("dialog", { name: "New site" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Docs Site" },
    });
    fireEvent.change(within(dialog).getByLabelText("Slug"), {
      target: { value: "docs-site" },
    });
    // The group field starts blank (`siteBlank`) — a group must be picked explicitly.
    fireEvent.change(within(dialog).getByLabelText("Group"), {
      target: { value: "g1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(createSiteMock).toHaveBeenCalledWith(
        {
          name: "Docs Site",
          slug: "docs-site",
          groupId: "g1",
        },
        { workspace: undefined },
      ),
    );
  });
});

describe("DashboardsFeature embedded mode (no basePath)", () => {
  it("selects Groups IN PLACE — no router navigation away from the host surface", async () => {
    render(
      <Harness>
        <DashboardsFeature />
      </Harness>,
    );
    // The section picker publishes into the host rail; picking Groups must stay internal
    // (the pre-extraction SiteMonitoringTab contract the ecosystem rail depends on).
    fireEvent.click(await screen.findByRole("button", { name: "Groups" }));
    expect(await screen.findByText("Core APIs")).toBeTruthy();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
