// @vitest-environment jsdom
//
// Component test for AssigneePicker — the work-item assignment control. It is a Field over the
// shared ListChooser typeahead, so nothing is mocked: the test opens the chooser, drives its
// filter field, and asserts the composite-key ↔ {assigneeKind, assigneeId} mapping (and the
// Unassigned → null sentinel). Only a TYPE is pulled from @agentic-toolkit/data/projects (erased
// at runtime), so the real api module never loads.
//
// What is worth pinning here beyond the codec: that the typeahead actually NARROWS (the reason
// this stopped being a <select> — a participant list you cannot search is a list you scroll),
// and that "Unassigned" is reachable as an ordinary entry rather than being spelled by clearing
// the field, which a chooser gives you no way to do.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

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

/** Open the chooser and hand back its listbox. */
function openChooser(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Assignee" }));
  return screen.getByRole("listbox", { name: "Assignee" });
}

describe("AssigneePicker", () => {
  it("offers Unassigned plus one entry per participant", () => {
    render(<AssigneePicker participants={PARTICIPANTS} value={null} onChange={() => {}} />);
    // Closed, the trigger reads the committed value — Unassigned, not an empty box.
    expect(screen.getByRole("button", { name: "Assignee" }).textContent).toContain("Unassigned");

    const list = openChooser();
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Unassigned",
      "customer · cust-1",
      "persona · agent-9",
    ]);
  });

  it("calls onChange with the {assigneeKind, assigneeId} of the picked participant", () => {
    const onChange = vi.fn();
    render(<AssigneePicker participants={PARTICIPANTS} value={null} onChange={onChange} />);

    const list = openChooser();
    fireEvent.click(within(list).getByRole("option", { name: "persona · agent-9" }));

    expect(onChange).toHaveBeenCalledWith({ assigneeKind: "persona", assigneeId: "agent-9" });
  });

  it("narrows the list as you type, and cannot invent a participant", () => {
    render(<AssigneePicker participants={PARTICIPANTS} value={null} onChange={() => {}} />);
    const list = openChooser();
    const field = screen.getByRole("combobox", { name: "Find a participant" });

    fireEvent.change(field, { target: { value: "agent" } });
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "persona · agent-9",
    ]);

    // Someone who is not on the project has no entry to pick and no row to create — assigning
    // work to a name nobody can resolve is not an option this control offers.
    fireEvent.change(field, { target: { value: "nobody" } });
    expect(within(list).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching participant")).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "Assignee" }).textContent).toContain(
      "customer · cust-1",
    );

    const list = openChooser();
    fireEvent.click(within(list).getByRole("option", { name: "Unassigned" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
