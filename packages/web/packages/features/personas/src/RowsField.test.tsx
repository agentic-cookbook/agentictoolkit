// .../features/personas/src/RowsField.test.tsx
// Tests in THIS package are colocated beside the source (unlike packages/data, which uses
// __tests__/). AbilitiesPanel.test.tsx, AssistantsPanel.test.tsx, PermissionsPanel.test.tsx
// and PersonaEditor.test.tsx are all colocated — follow them.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RowsField } from "./RowsField";

// REQUIRED: this package's vitest config has no global afterEach, so RTL's auto-cleanup never
// runs. Without this, every `harness()` render stacks up in the same document and the singular
// queries below ("Add" button, /none yet/) throw "found multiple elements" from test 2 onward —
// failing against a perfectly correct component. All four sibling tests carry this same line.
afterEach(cleanup);

function harness(value: string[], onChange = vi.fn()) {
  render(
    <RowsField
      label="Intro"
      value={value}
      onChange={onChange}
      blankRow={() => ""}
      renderRow={(row, set) => <input aria-label="row" value={row} onChange={(e) => set(e.target.value)} />}
    />,
  );
  return onChange;
}

describe("RowsField", () => {
  it("renders one control per row", () => {
    harness(["a", "b"]);
    expect(screen.getAllByLabelText("row")).toHaveLength(2);
  });

  it("appends a blank row on add", () => {
    const onChange = harness(["a"]);
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onChange).toHaveBeenCalledWith(["a", ""]);
  });

  it("removes the right row", () => {
    const onChange = harness(["a", "b", "c"]);
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[1]);
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  it("edits a row in place without touching its neighbours", () => {
    const onChange = harness(["a", "b"]);
    fireEvent.change(screen.getAllByLabelText("row")[0], { target: { value: "z" } });
    expect(onChange).toHaveBeenCalledWith(["z", "b"]);
  });

  it("shows an empty state when there are no rows", () => {
    harness([]);
    expect(screen.getByText(/none yet/i)).toBeTruthy();
  });
});
