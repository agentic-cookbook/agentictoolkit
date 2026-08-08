// @vitest-environment jsdom
//
// Component test for WorkItemFilterBar. The axes themselves are the filter model's business
// (filters.test.ts) and the bar-to-views wiring is the surface's (WorkItemsSurface.test.tsx), so
// what is left here is the one thing this component decides on its own: WHICH axes are always
// visible, and what happens to the ones it folds away.
//
// That fold is the only place a filter bar can go properly wrong. A control that is hidden while
// it is still narrowing the list produces a board that looks broken — fewer cards than there are,
// with nothing on screen explaining why — so the rule this file exists to hold is: the disclosure
// may hide an axis nobody is using, and never one that someone is.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Iteration, ProjectParticipant, ProjectStatus } from "@agentic-toolkit/data/projects";
import { WorkItemFilterBar } from "./WorkItemFilterBar";
import { EMPTY_FILTER, type WorkItemFilter } from "./filters";

afterEach(cleanup);

const STATUSES: ProjectStatus[] = [
  {
    id: "s1",
    projectId: "p1",
    key: "todo",
    label: "To do",
    category: "todo",
    position: 0,
    createdAt: "2026-07-03T00:00:00Z",
  },
];
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
];
const ITERATIONS: Iteration[] = [
  {
    id: "it1",
    name: "Sprint 7",
    description: "",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    state: "active",
    ownerKind: "customer",
    ownerId: "cust-1",
    ecosystemId: "eco-1",
    createdAt: "2026-06-30T00:00:00Z",
    updatedAt: "2026-06-30T00:00:00Z",
  },
];

function renderBar(filter: Partial<WorkItemFilter> = {}) {
  const onChange = vi.fn();
  render(
    <WorkItemFilterBar
      filter={{ ...EMPTY_FILTER, ...filter }}
      onChange={onChange}
      statuses={STATUSES}
      participants={PARTICIPANTS}
      iterations={ITERATIONS}
      labelOptions={["bug", "ui"]}
    />,
  );
  return onChange;
}

const more = () => screen.getByRole("button", { name: /More filters/ });

describe("WorkItemFilterBar", () => {
  it("keeps the everyday axes on screen and folds the occasional ones away", () => {
    renderBar();
    // Always visible: text, status, priority, iteration, assignee.
    expect(screen.getByRole("searchbox", { name: "Search work items" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Filter by status" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Filter by priority" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Filter by iteration" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Filter by assignee" })).not.toBeNull();
    // Folded until asked for.
    expect(screen.queryByLabelText("Due on or after")).toBeNull();
    expect(more()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(more());
    expect(screen.getByLabelText("Due on or after")).not.toBeNull();
    expect(screen.getByLabelText("Due on or before")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Filter by labels" })).not.toBeNull();
  });

  it("opens the fold by itself for a filter that arrived already narrowed", () => {
    // A saved view or a pasted URL sets the axes without touching the bar. If the section stayed
    // shut, the list would be narrowed by controls the user cannot see.
    renderBar({ dueTo: "2026-08-01", labels: ["bug"] });
    expect(more()).toHaveAttribute("aria-expanded", "true");
    expect((screen.getByLabelText("Due on or before") as HTMLInputElement).value).toBe(
      "2026-08-01",
    );
    // …and it says how many of the folded axes are doing the narrowing.
    expect(screen.getByText("2 of these are narrowing the list.")).not.toBeNull();
  });

  it("refuses to fold an axis away while it is still narrowing the list", () => {
    renderBar({ labels: ["bug"] });
    fireEvent.click(more());
    expect(more()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Filter by labels" })).not.toBeNull();
  });

  it("reports a due-date window through the native date inputs", () => {
    const onChange = renderBar();
    fireEvent.click(more());
    fireEvent.change(screen.getByLabelText("Due on or after"), {
      target: { value: "2026-08-01" },
    });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTER, dueFrom: "2026-08-01" });
  });

  it("offers only labels the project actually uses, and adds one to the set", () => {
    const onChange = renderBar({ labels: ["bug"] });
    const group = screen.getByRole("group", { name: "Filter by labels" });
    // The chosen one shows as a chip; the browser offers what is left.
    expect(within(group).getByRole("button", { name: "Remove bug" })).not.toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "Filter by labels" }));
    const list = screen.getByRole("listbox", { name: "Filter by labels" });
    expect(within(list).getByRole("option", { name: "ui" })).not.toBeNull();
    expect(within(list).queryByRole("option", { name: "bug" })).toBeNull();

    // A label nothing carries cannot be invented here: filtering by one would empty the list with
    // no way to tell that from "nothing matches". (Checked before the commit below, which closes
    // the browser.)
    const field = screen.getByRole("combobox", { name: "Filter by labels" });
    fireEvent.change(field, { target: { value: "nonexistent" } });
    expect(screen.queryByText(/Add “nonexistent”/)).toBeNull();
    expect(screen.getByText("No matching label")).not.toBeNull();

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(within(list).getByRole("option", { name: "ui" }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTER, labels: ["bug", "ui"] });
  });

  it("shows the clear-all action only while something is narrowed", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    cleanup();

    const onChange = renderBar({ text: "login" });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTER);
  });

  it("leads the iteration axis with the backlog, valued as its own answer", () => {
    const onChange = renderBar();
    const axis = screen.getByRole("combobox", { name: "Filter by iteration" });
    const options = within(axis).getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.textContent)).toEqual(["All iterations", "Backlog", "Sprint 7"]);
    expect(options[2]!.value).toBe("it1");

    fireEvent.change(axis, { target: { value: "none" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTER, iterationId: "none" });
  });
});
