// @vitest-environment jsdom
//
// Component test for AssigneePicker — the work-item assignment control. It is a
// pure Field+Select over the project's participants, so nothing is mocked: the
// test drives the native <select> and asserts the composite-key ↔ {assigneeKind,
// assigneeId} mapping (and the Unassigned → null sentinel). Only a TYPE is pulled
// from @agentic-toolkit/data/projects (erased at runtime), so the real api module never loads.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { AssigneePicker } from "./AssigneePicker";
import type { ProjectParticipant } from "@agentic-toolkit/data/projects";

const PARTICIPANTS: ProjectParticipant[] = [
  {
    id: "pp1",
    projectId: "p1",
    participantKind: "customer",
    participantId: "cust-1",
    role: "member",
    addedBy: null,
    addedAt: "2026-07-03T00:00:00Z",
  },
  {
    id: "pp2",
    projectId: "p1",
    participantKind: "persona",
    participantId: "agent-9",
    role: "member",
    addedBy: null,
    addedAt: "2026-07-03T00:00:00Z",
  },
];

// The hub vitest config has no global afterEach, so tear down each render explicitly.
afterEach(cleanup);

describe("AssigneePicker", () => {
  it("renders Unassigned plus one option per participant", () => {
    render(<AssigneePicker participants={PARTICIPANTS} value={null} onChange={() => {}} />);

    const select = screen.getByLabelText("Assignee") as HTMLSelectElement;
    expect(select.options).toHaveLength(3); // Unassigned + 2 participants
    expect(screen.getByRole("option", { name: "Unassigned" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "customer · cust-1" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "persona · agent-9" })).not.toBeNull();
  });

  it("calls onChange with the {assigneeKind, assigneeId} of the picked participant", () => {
    const onChange = vi.fn();
    render(<AssigneePicker participants={PARTICIPANTS} value={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Assignee"), {
      target: { value: "persona:agent-9" },
    });

    expect(onChange).toHaveBeenCalledWith({ assigneeKind: "persona", assigneeId: "agent-9" });
  });

  it("calls onChange(null) when Unassigned is picked", () => {
    const onChange = vi.fn();
    render(
      <AssigneePicker
        participants={PARTICIPANTS}
        value={{ assigneeKind: "customer", assigneeId: "cust-1" }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
