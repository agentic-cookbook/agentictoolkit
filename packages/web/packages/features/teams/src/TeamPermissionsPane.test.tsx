// @vitest-environment jsdom
//
// Component + helper tests for TeamPermissionsPane — the workspace roles editor. Mirrors the
// TeamMembersPane test style: jsdom + @testing-library/react, mocking only the data boundary
// (@agentic-toolkit/data/access). The roles LIST is published to a rail HOST via
// useMasterDetailLevel (not rendered by the pane itself), so a tiny <Rail> harness backed by the
// toolkit's RailHostContext renders the published rows + the "New role" affordance — the same path
// the hub's workspace shell uses. The editor's ButtonBar portals into the (null) toolbar slot,
// which ToolbarPortal renders inline, so Save/Delete are drivable here too.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
  type PaneExitGuard,
} from "@agentic-toolkit/resource";

vi.mock("@agentic-toolkit/data/access", () => ({
  ACCESS_FEATURES: [
    { key: "projects", label: "Projects" },
    { key: "personas", label: "Personas" },
  ],
  accessApi: {
    listRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
  },
}));

import {
  TeamPermissionsPane,
  parseVerbs,
  formatVerbs,
} from "./TeamPermissionsPane";
import { accessApi, type AccessRoleRow } from "@agentic-toolkit/data/access";

const listRoles = vi.mocked(accessApi.listRoles);
const updateRole = vi.mocked(accessApi.updateRole);

/** Build a role fixture with sensible defaults (custom, non-default). */
function role(
  over: Partial<AccessRoleRow> & { id: string; slug: string; name: string },
): AccessRoleRow {
  return { description: "", isSystem: false, defaultFor: "", grants: [], ...over } as AccessRoleRow;
}

const REVIEWER = role({
  id: "r1",
  slug: "reviewer",
  name: "Reviewer",
  grants: [
    { feature: "projects", itemVerbs: "R", subitemVerbs: "" },
    { feature: "personas", itemVerbs: "", subitemVerbs: "" },
  ],
});
const USER_SYS = role({
  id: "r2",
  slug: "user",
  name: "User",
  isSystem: true,
  defaultFor: "customer",
  grants: [
    { feature: "projects", itemVerbs: "R", subitemVerbs: "R" },
    { feature: "personas", itemVerbs: "R", subitemVerbs: "" },
  ],
});
const ADMIN = role({
  id: "r3",
  slug: "admin",
  name: "Admin",
  isSystem: true,
  grants: [
    { feature: "projects", itemVerbs: "C,R,U,D,M", subitemVerbs: "C,R,U,D" },
    { feature: "personas", itemVerbs: "C,R,U,D,M", subitemVerbs: "C,R,U,D" },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  listRoles.mockResolvedValue([]);
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never registers —
// tear down each render explicitly to keep renders from bleeding across tests.
afterEach(cleanup);

/** Renders the published roles level (its rows + the "New role" affordance + empty label) the way
 *  the workspace shell would, so the test can see and drive the shell-owned master list. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  const level = levels[0];
  const rows = levels.flatMap((l) => l.items);
  return (
    <div>
      {level?.onNew && level.newLabel && (
        <button type="button" onClick={() => level.onNew?.()}>
          {level.newLabel}
        </button>
      )}
      {rows.length === 0 && level?.emptyLabel && <p>{level.emptyLabel}</p>}
      <ul>
        {rows.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => level?.onSelect(it.id)}>
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A minimal rail HOST: registers pane-published levels/guards the way the hub's shell does, so the
 *  published master list is drivable. toolbarSlot is null, so the pane's ButtonBar renders inline. */
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
          if (!m.has(id)) return m;
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: (_id: string, _guard: PaneExitGuard | null) => {},
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

// `workspaceSlug` defaults to "acme" when omitted; pass `null` to drive the no-workspace path
// (a plain `undefined` would trip the default-parameter value instead).
function TestHarness({ workspaceSlug = "acme" }: { workspaceSlug?: string | null }) {
  const [leafId, setLeafId] = useState<string | null>(null);
  return (
    <Harness>
      <TeamPermissionsPane
        workspaceSlug={workspaceSlug ?? undefined}
        leaf={{ leafId, onSelect: setLeafId }}
      />
    </Harness>
  );
}

describe("TeamPermissionsPane", () => {
  it("renders the workspace roles and badges the system ones", async () => {
    listRoles.mockResolvedValue([structuredClone(REVIEWER), structuredClone(USER_SYS)]);
    render(<TestHarness />);

    // Both roles appear as master rows; the custom one carries no System badge until selected.
    await screen.findByRole("button", { name: "Reviewer" });
    expect(screen.getByRole("button", { name: "User" })).not.toBeNull();

    // Selecting the system role surfaces its "System" badge in the detail header.
    fireEvent.click(screen.getByRole("button", { name: "User" }));
    expect(await screen.findByText("System")).not.toBeNull();

    // The custom role has no System badge.
    fireEvent.click(screen.getByRole("button", { name: "Reviewer" }));
    await screen.findByDisplayValue("Reviewer"); // detail re-hydrated to the custom role
    expect(screen.queryByText("System")).toBeNull();
  });

  it("renders the admin role fully disabled with the immutable note and no save/delete", async () => {
    listRoles.mockResolvedValue([structuredClone(ADMIN)]);
    render(<TestHarness />);

    fireEvent.click(await screen.findByRole("button", { name: "Admin" }));

    // The note is shown, the identity fields are disabled, and there are no editing affordances.
    expect(await screen.findByText("The admin role is immutable.")).not.toBeNull();
    const nameInput = screen.getByDisplayValue("Admin") as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("toggling the M verb and saving PATCHes the role with the canonical verb string", async () => {
    listRoles.mockResolvedValue([structuredClone(REVIEWER)]);
    updateRole.mockResolvedValue(structuredClone(REVIEWER));
    render(<TestHarness />);

    fireEvent.click(await screen.findByRole("button", { name: "Reviewer" }));
    await screen.findByDisplayValue("Reviewer");

    // Scope to the Projects feature row (both features render an M chip) and add M to its item verbs.
    const projectsRow = screen.getByText("Projects").closest("div") as HTMLElement;
    fireEvent.click(within(projectsRow).getByRole("button", { name: "M" }));

    // Save is enabled once the draft is dirty; it drives updateRole via the shared button bar.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    // R + M resolve to canonical 'R,M' (M is always last), and personas stays untouched.
    expect(updateRole).toHaveBeenCalledWith(
      "acme",
      "r1",
      expect.objectContaining({
        grants: expect.arrayContaining([
          expect.objectContaining({ feature: "projects", itemVerbs: "R,M", subitemVerbs: "" }),
          expect.objectContaining({ feature: "personas", itemVerbs: "", subitemVerbs: "" }),
        ]),
      }),
    );
  });

  it("shows the defined empty state (never a spinner) with no workspaceSlug", async () => {
    render(<TestHarness workspaceSlug={null} />);

    // The pane resolves to a DEFINED empty message rather than an eternal "Loading…"; it never
    // calls the roles API without a workspace.
    const hits = await screen.findAllByText("Open Teams from your hub workspace to manage roles.");
    expect(hits.length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(listRoles).not.toHaveBeenCalled();
  });
});

describe("parseVerbs / formatVerbs", () => {
  it("parses an empty string to no verbs", () => {
    expect(parseVerbs("")).toEqual({
      crud: { create: false, read: false, update: false, delete: false },
      manage: false,
    });
  });

  it("parses a mixed-case string and drops unknown letters", () => {
    // lowercase accepted, 'x'/'z' are garbage and dropped, M sets manage.
    expect(parseVerbs("c,r,x,z,M")).toEqual({
      crud: { create: true, read: true, update: false, delete: false },
      manage: true,
    });
  });

  it("parses the full set", () => {
    expect(parseVerbs("C,R,U,D,M")).toEqual({
      crud: { create: true, read: true, update: true, delete: true },
      manage: true,
    });
  });

  it("formats in canonical C,R,U,D,M order regardless of enabled subset", () => {
    expect(formatVerbs({ create: false, read: true, update: false, delete: false }, true)).toBe(
      "R,M",
    );
    expect(formatVerbs({ create: true, read: true, update: true, delete: true }, true)).toBe(
      "C,R,U,D,M",
    );
    expect(formatVerbs({ create: false, read: false, update: false, delete: false }, false)).toBe(
      "",
    );
  });

  it("round-trips a reordered string to canonical order", () => {
    const { crud, manage } = parseVerbs("M,R");
    expect(formatVerbs(crud, manage)).toBe("R,M");
  });

  it("drops M from a sub-item format (CRUD-only)", () => {
    const { crud } = parseVerbs("R,M");
    expect(formatVerbs(crud, false)).toBe("R");
  });
});
