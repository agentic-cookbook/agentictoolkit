import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntegerInput, OptionalIntegerInput } from "../IntegerInput";

// The defect this file exists for: a controlled `type="number"` box cannot hold the lone
// `-` of a half-typed `-30`. The DOM reports it as "", the old control parsed that as the
// column default and wrote "0" back, and the minus was gone — silently, and validly, so
// the operator saved a spell that HEALED 30 where the schema's own canonical effect is
// `hp / add / -30`. The assertion is therefore about what the box still says mid-typing.

function IntegerHarness({ start = 0 }: { start?: number }) {
  const [value, setValue] = useState<number>(start);
  return (
    <>
      <label htmlFor="v">Value</label>
      <IntegerInput id="v" value={value} fallback={0} onChange={setValue} />
      <output data-testid="parsed">{Number.isNaN(value) ? "NaN" : String(value)}</output>
    </>
  );
}

function DurationHarness() {
  const [value, setValue] = useState<number | null>(null);
  return (
    <>
      <label htmlFor="d">Duration</label>
      <OptionalIntegerInput id="d" value={value} onChange={setValue} />
      <output data-testid="parsed">
        {value === null ? "null" : Number.isNaN(value) ? "NaN" : String(value)}
      </output>
    </>
  );
}

describe("IntegerInput", () => {
  it("keeps a minus sign on screen while the number is still being typed", () => {
    render(<IntegerHarness start={30} />);
    const box = screen.getByLabelText("Value") as HTMLInputElement;

    fireEvent.change(box, { target: { value: "" } });
    fireEvent.change(box, { target: { value: "-" } });
    expect(box.value).toBe("-");

    fireEvent.change(box, { target: { value: "-30" } });
    expect(box.value).toBe("-30");
    expect(screen.getByTestId("parsed").textContent).toBe("-30");
  });

  // What stops the half-typed state being SAVED as some other number: it is not a number
  // at all, and the validators refuse NaN by name.
  it("parses an unfinished number as NaN rather than as the fallback", () => {
    render(<IntegerHarness start={30} />);
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "-" } });
    expect(screen.getByTestId("parsed").textContent).toBe("NaN");
  });

  // The same defect at half the radius: the raw-text box no longer self-corrects, so a
  // value `Number()` would happily rewrite — 1.9 to 1, 1e3 to 1000 — would otherwise be
  // SAVED while the box went on showing what was typed. It is NaN, and Save is blocked.
  it("refuses a decimal, an exponent and an int4 overflow while showing what was typed", () => {
    render(<IntegerHarness start={30} />);
    const box = screen.getByLabelText("Value") as HTMLInputElement;

    for (const typed of ["1.9", "1e3", "99999999999999999999"]) {
      fireEvent.change(box, { target: { value: typed } });
      expect(box.value).toBe(typed);
      expect(screen.getByTestId("parsed").textContent).toBe("NaN");
    }
  });

  it("reads an emptied box as the column's default, which IS an answer", () => {
    render(<IntegerHarness start={30} />);
    const box = screen.getByLabelText("Value") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "" } });
    expect(box.value).toBe("");
    expect(screen.getByTestId("parsed").textContent).toBe("0");
  });
});

describe("OptionalIntegerInput", () => {
  it("keeps an empty box empty and reads it as null, never 0", () => {
    render(<DurationHarness />);
    const box = screen.getByLabelText("Duration") as HTMLInputElement;
    expect(box.value).toBe("");
    expect(screen.getByTestId("parsed").textContent).toBe("null");

    fireEvent.change(box, { target: { value: "0" } });
    expect(screen.getByTestId("parsed").textContent).toBe("0");

    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByTestId("parsed").textContent).toBe("null");
  });

  it("lets a negative duration be typed too", () => {
    render(<DurationHarness />);
    const box = screen.getByLabelText("Duration") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "-" } });
    expect(box.value).toBe("-");
    fireEvent.change(box, { target: { value: "-2" } });
    expect(screen.getByTestId("parsed").textContent).toBe("-2");
  });
});
