// @vitest-environment jsdom
//
// Component test for ProjectOverviewPane — the full project Overview (editable
// settings + participants). The hub's vitest config is node-only, so this file
// opts into jsdom via the docblock above and drives React with
// @testing-library/react. Only the api-client boundary (@agentic-toolkit/data/projects) is mocked,
// so the load → edit → save and the participant add/remove wiring are exercised,
// not the transport. The pane renders its content inline (it does not publish a
// stack level), so a plain render is enough — no rail-host harness.
//
// The 409 case uses a real AuthHttpError(409) so the pane's real isConflict path
// (via @agentic-toolkit/data) turns it into a friendly inline message, not a raw throw.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { AuthHttpError } from "@agentic-toolkit/auth/client";

vi.mock("@agentic-toolkit/data/projects", () => ({
  projectsApi: {
    get: vi.fn(),
    update: vi.fn(),
    participants: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
  },
}));

import { ProjectOverviewPane } from "./ProjectOverviewPane";
import {
  projectsApi,
  type Project,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";

const get = vi.mocked(projectsApi.get);
const update = vi.mocked(projectsApi.update);
const participantsList = vi.mocked(projectsApi.participants.list);
const add = vi.mocked(projectsApi.participants.add);
const remove = vi.mocked(projectsApi.participants.remove);

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

const PARTICIPANT: ProjectParticipant = {
  id: "pp1",
  projectId: "p1",
  participantKind: "customer",
  participantId: "cust-1",
  role: "member",
  addedBy: null,
  addedAt: "2026-07-03T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(structuredClone(PROJECT));
  participantsList.mockResolvedValue([structuredClone(PARTICIPANT)]);
  update.mockImplementation((id, patch) =>
    Promise.resolve({ ...structuredClone(PROJECT), ...patch }),
  );
  add.mockResolvedValue(structuredClone(PARTICIPANT));
  remove.mockResolvedValue(undefined);
});

// Explicit and redundant, deliberately: this package's vitest runs with `globals: true`
// (packages/web/packages/features/vitest.preset.ts:16), so RTL 16.3.2's own shipped
// `afterEach(cleanup)` DOES register (@testing-library/react/dist/index.js:23-30), and cleanup
// is idempotent. An earlier version of this comment asserted the opposite — no global afterEach,
// auto-cleanup never registers — and both halves were false. Keep the call if you like it as a
// local statement of intent; do not "fix" the config to match the claim that was here.
afterEach(cleanup);

describe("ProjectOverviewPane", () => {
  it("renders the project's name and lifecycle status", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    // Name + Status populate free-text inputs; Status is the free-form lifecycle
    // varchar (a text input, NOT a select over the board columns).
    expect(await screen.findByDisplayValue("Website relaunch")).not.toBeNull();
    const statusInput = screen.getByLabelText("Status") as HTMLInputElement;
    expect(statusInput.tagName).toBe("INPUT");
    expect(statusInput.value).toBe("active");
    await waitFor(() => expect(get).toHaveBeenCalledWith("p1"));
  });

  it("saves an edited name via projectsApi.update (only the changed field)", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("p1", { name: "Marketing revamp" }),
    );
  });

  it("saves an edited lifecycle status as the typed free-text string", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "on hold" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("p1", { status: "on hold" }),
    );
  });

  it("adds a participant with the chosen kind + id", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByDisplayValue("Website relaunch");

    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "persona" } });
    fireEvent.change(screen.getByLabelText("Participant id"), {
      target: { value: "agent-9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("p1", {
        participantKind: "persona",
        participantId: "agent-9",
      }),
    );
  });

  it("removes a participant with its (participantId, kind)", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    const removeBtn = await screen.findByRole("button", { name: "Remove cust-1" });
    fireEvent.click(removeBtn);

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("p1", "cust-1", "customer"),
    );
  });

  it("guards loadParticipants against a stale reload clobbering a newer one (reqSeq)", async () => {
    const P2: ProjectParticipant = {
      ...structuredClone(PARTICIPANT),
      id: "pp2",
      participantId: "cust-2",
    };
    participantsList.mockResolvedValueOnce([structuredClone(PARTICIPANT), structuredClone(P2)]);

    // Two overlapping reloads (fired by the two removes below), resolved OUT OF ORDER — the
    // newer one (from removing cust-2) settles first, the stale one (from removing cust-1,
    // issued before cust-2 was even removed) settles last.
    let resolveReload1!: (rows: ProjectParticipant[]) => void;
    let resolveReload2!: (rows: ProjectParticipant[]) => void;
    let call = 0;
    participantsList.mockImplementation(
      () =>
        new Promise((res) => {
          call += 1;
          if (call === 1) resolveReload1 = res;
          else resolveReload2 = res;
        }),
    );

    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByText("cust-2");

    fireEvent.click(screen.getByRole("button", { name: "Remove cust-1" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1", "cust-1", "customer"));

    fireEvent.click(screen.getByRole("button", { name: "Remove cust-2" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1", "cust-2", "customer"));

    // The newer reload (from removing cust-2) resolves first, correctly showing empty…
    await act(async () => {
      resolveReload2([]);
    });
    expect(screen.getByText("No participants yet.")).not.toBeNull();

    // …then the STALE reload resolves late with a list that still includes cust-2 — this
    // must be a no-op (guarded by reqSeq), not clobber the newer, correct empty list.
    await act(async () => {
      resolveReload1([structuredClone(P2)]);
    });
    expect(screen.getByText("No participants yet.")).not.toBeNull();
    expect(screen.queryByText("cust-2")).toBeNull();
  });

  it("surfaces a friendly message when an add returns 409 (already a participant)", async () => {
    add.mockRejectedValueOnce(new AuthHttpError(409, "participant already exists"));
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);
    await screen.findByDisplayValue("Website relaunch");

    fireEvent.change(screen.getByLabelText("Participant id"), {
      target: { value: "cust-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // The 409 is caught and shown inline (no unhandled throw), naming the kind.
    expect(await screen.findByText(/already a participant/i)).not.toBeNull();
  });
});

/* ── The host-injected Transfer Ownership seam ────────────────────────────── */

// Echoes back what the seam was handed, so "called with the LOADED project" is directly
// assertable rather than inferred from the node merely existing. Same idiom as ecosystems'
// EcosystemSettingsPane.test.tsx.
const seam = (p: { id: string; name: string }) => (
  <div data-testid="transfer" data-id={p.id} data-name={p.name} />
);

describe("ProjectOverviewPane transfer seam", () => {
  it("renders the host's seam, handed the loaded project", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const node = await screen.findByTestId("transfer");
    expect(node.getAttribute("data-id")).toBe("p1");
    expect(node.getAttribute("data-name")).toBe("Website relaunch");
  });

  it("renders nothing where the host injects no seam", async () => {
    render(<ProjectOverviewPane projectId="p1" title="Overview" />);

    await screen.findByDisplayValue("Website relaunch");
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  it("renders nothing when the project does not load", async () => {
    get.mockResolvedValue(null);
    render(
      <ProjectOverviewPane projectId="gone" title="Overview" renderTransferOwnership={seam} />,
    );

    expect(await screen.findByText("Project not found.")).not.toBeNull();
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  // The pane hands over `project` (the loaded row), NOT the `name` draft above it. Swapping to
  // the draft would compile and pass every other test in this file, and would name the
  // confirmation dialog after a rename the server has never seen.
  it("keeps naming the SAVED project while a rename is unsaved", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });

    // The field took the edit…
    expect(screen.getByDisplayValue("Marketing revamp")).not.toBeNull();
    // …and the seam still names the row the server knows.
    expect(screen.getByTestId("transfer").getAttribute("data-name")).toBe("Website relaunch");
  });

  it("adopts the new name once the rename is saved", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const nameInput = await screen.findByDisplayValue("Website relaunch");
    fireEvent.change(nameInput, { target: { value: "Marketing revamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByTestId("transfer").getAttribute("data-name")).toBe("Marketing revamp"),
    );
  });

  // Position, not mere presence: the seam is documented as the pane's LAST section, and both it
  // and Participants render either way, so a presence assertion would pass with them swapped.
  it("places the seam AFTER the participants list", async () => {
    render(
      <ProjectOverviewPane projectId="p1" title="Overview" renderTransferOwnership={seam} />,
    );

    const transfer = await screen.findByTestId("transfer");
    const participants = screen.getByText("Participants");
    expect(
      participants.compareDocumentPosition(transfer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
