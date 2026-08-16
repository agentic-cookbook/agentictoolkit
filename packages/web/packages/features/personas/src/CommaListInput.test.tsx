// .../features/personas/src/CommaListInput.test.tsx
// Colocated beside the source, like every other suite in this package (see RowsField.test.tsx).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommaListInput } from "./CommaListInput";

afterEach(cleanup);

describe("CommaListInput", () => {
  it("keeps the separator the user typed, which the array cannot represent", () => {
    const onChange = vi.fn();
    render(<CommaListInput label="Tags" value={["matrix"]} onChange={onChange} />);
    const box = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "matrix, " } });
    // The parse drops the empty trailing member, so a naive re-join would erase the comma and the
    // space from under the caret. The draft is what keeps them.
    expect(onChange).toHaveBeenCalledWith(["matrix"]);
    expect(box.value).toBe("matrix, ");
  });

  it("drops a stale draft when the parent hands it a different array", () => {
    // This is the row-removal case. `RowsField` keys rows by index, so deleting a row hands the
    // NEXT row's value to this same mounted input. Blur does not save us: in WebKit, clicking a
    // button does not focus it, so `onBlur` never fires and the draft is still live at the swap.
    const onChange = vi.fn();
    const { rerender } = render(
      <CommaListInput label="Tags" value={["matrix"]} onChange={onChange} />,
    );
    const box = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "matrix, " } });
    expect(box.value).toBe("matrix, ");

    rerender(<CommaListInput label="Tags" value={["neo"]} onChange={onChange} />);
    expect(box.value).toBe("neo");
  });

  it("keeps the draft when the parent echoes back the array it just parsed", () => {
    // The ordinary controlled round trip: the array comes straight back, so the in-progress text
    // must survive it — otherwise the resync above would eat every keystroke.
    const onChange = vi.fn();
    const { rerender } = render(
      <CommaListInput label="Tags" value={[]} onChange={onChange} />,
    );
    const box = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "matrix, " } });
    rerender(<CommaListInput label="Tags" value={["matrix"]} onChange={onChange} />);
    expect(box.value).toBe("matrix, ");
  });
});
