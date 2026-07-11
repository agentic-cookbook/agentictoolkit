// @vitest-environment jsdom
//
// Component test for ItemAccessPanel — the per-item share panel. This package's
// vitest config is jsdom (see vitest.config.ts) and drives React with
// @testing-library/react. Only the data boundary (@agentic-toolkit/data/access) and
// the host-injected subjectsDirectory are mocked, so the mode row, assignment rows +
// role selects, add flow, the M-gate quiet state, and the explainer are exercised —
// not the transport. Unlike TeamMembersPane the panel publishes NO stack level (it
// renders inline), so no Rail/RailHost harness is needed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/access", () => ({
  accessApi: {
    listAssignments: vi.fn(),
    listRoles: vi.fn(),
    putAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    restrictItem: vi.fn(),
    restoreItem: vi.fn(),
    effective: vi.fn(),
  },
}));

import { ItemAccessPanel, type AccessSubject } from "./ItemAccessPanel";
import {
  accessApi,
  type AccessAssignmentRow,
  type AccessRoleRow,
  type EffectiveAccessRow,
} from "@agentic-toolkit/data/access";

const listAssignments = vi.mocked(accessApi.listAssignments);
const listRoles = vi.mocked(accessApi.listRoles);
const putAssignment = vi.mocked(accessApi.putAssignment);
const restrictItem = vi.mocked(accessApi.restrictItem);
const effective = vi.mocked(accessApi.effective);

const ROLES: AccessRoleRow[] = [
  { id: "role-user", slug: "user", name: "User", description: "", isSystem: true, defaultFor: "customer", grants: [] },
  { id: "role-reviewer", slug: "reviewer", name: "Reviewer", description: "", isSystem: false, defaultFor: "", grants: [] },
];

const ASSIGN_CUSTOMER: AccessAssignmentRow = {
  id: "a1",
  subjectKind: "customer",
  subjectId: "c1",
  scopeFeature: "projects",
  scopeItemId: "item-1",
  roleId: "role-user",
  roleName: "User",
  roleSlug: "user",
};

const DIR: AccessSubject[] = [
  { kind: "customer", id: "c1", label: "Ada Lovelace" },
  { kind: "persona", id: "p1", label: "Bitbag" },
  { kind: "team", id: "t1", label: "Platform" },
];

// The host directory seam — a fresh clone per call so tests can't mutate the fixture.
const directory = () => Promise.resolve(structuredClone(DIR));

function renderPanel() {
  return render(
    <ItemAccessPanel
      workspaceSlug="ws"
      feature="projects"
      itemId="item-1"
      itemLabel="Apollo"
      subjectsDirectory={directory}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listAssignments.mockResolvedValue({ assignments: [], restricted: false });
  listRoles.mockResolvedValue(structuredClone(ROLES));
  putAssignment.mockResolvedValue(structuredClone(ASSIGN_CUSTOMER));
  restrictItem.mockResolvedValue(undefined);
  effective.mockResolvedValue({
    itemVerbs: "",
    subitemVerbs: "",
    restricted: false,
    decidedBy: {},
  } as EffectiveAccessRow);
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never
// registers — tear down each render explicitly (mirrors TeamMembersPane.test).
afterEach(cleanup);

describe("ItemAccessPanel", () => {
  it("renders the inherited mode and restricts the item on flip", async () => {
    renderPanel();

    expect(await screen.findByText(/Inherited from workspace/i)).not.toBeNull();
    // The flip button restricts (only its explicit list will apply thereafter).
    fireEvent.click(screen.getByRole("button", { name: "Restrict" }));
    await waitFor(() => expect(restrictItem).toHaveBeenCalledWith("ws", "projects", "item-1"));
  });

  it("renders an assignment with a role select bound to its current role", async () => {
    listAssignments.mockResolvedValue({
      assignments: [structuredClone(ASSIGN_CUSTOMER)],
      restricted: true,
    });
    renderPanel();

    // Restricted mode surfaces the "only people listed here" copy.
    expect(await screen.findByText(/only people listed here/i)).not.toBeNull();
    // The row: subject label + a customer icon + a role select showing its role.
    const row = (await screen.findByText("Ada Lovelace")).closest("li");
    expect(row?.querySelector(".lucide-user-round")).not.toBeNull();
    const select = (await screen.findByLabelText(/role for ada/i)) as HTMLSelectElement;
    expect(select.value).toBe("role-user");
  });

  it("shares the item with a not-yet-listed subject", async () => {
    listAssignments.mockResolvedValue({ assignments: [], restricted: false });
    renderPanel();

    fireEvent.change(await screen.findByLabelText(/choose someone/i), {
      target: { value: "persona:p1" },
    });
    fireEvent.change(screen.getByLabelText(/role to grant/i), {
      target: { value: "role-reviewer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(putAssignment).toHaveBeenCalledWith("ws", {
        subjectKind: "persona",
        subjectId: "p1",
        feature: "projects",
        itemId: "item-1",
        roleId: "role-reviewer",
      }),
    );
  });

  it("shows a quiet no-access state when the list is M-gated (403)", async () => {
    listAssignments.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    renderPanel();

    expect(await screen.findByText(/manage access for this item/i)).not.toBeNull();
    // No management chrome leaks through the quiet state.
    expect(screen.queryByText(/Inherited from workspace/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Restrict" })).toBeNull();
  });

  it("explains a subject's effective verbs with per-verb provenance", async () => {
    listAssignments.mockResolvedValue({
      assignments: [structuredClone(ASSIGN_CUSTOMER)],
      restricted: false,
    });
    effective.mockResolvedValue({
      itemVerbs: "R,U",
      subitemVerbs: "R",
      restricted: false,
      decidedBy: {
        R: { kind: "grant", roleSlug: "user", via: "default" },
        U: { kind: "grant", roleSlug: "reviewer", via: "direct", scopeItemId: "item-1" },
        "sub:R": { kind: "grant", roleSlug: "user", via: "default" },
      },
    });
    renderPanel();

    // Clicking the subject label opens the "Why" panel for that subject.
    fireEvent.click(await screen.findByRole("button", { name: "Ada Lovelace" }));

    expect(await screen.findByText(/via user \(default role\)/i)).not.toBeNull();
    expect(screen.getByText(/direct grant on this item \(reviewer\)/i)).not.toBeNull();
    await waitFor(() =>
      expect(effective).toHaveBeenCalledWith("ws", {
        feature: "projects",
        subjectKind: "customer",
        subjectId: "c1",
        itemId: "item-1",
      }),
    );
  });
});
