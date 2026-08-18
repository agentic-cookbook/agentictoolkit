import { describe, expect, it, vi } from "vitest";
import { inlineUrlSelection } from "../inlineSelection";

interface Row {
  id: string;
}
const getId = (row: Row) => row.id;
const rows: Row[] = [{ id: "eff-1" }, { id: "eff-2" }];

function leafFor(leafId: string | null) {
  const onSelect = vi.fn();
  return { leaf: { leafId, onSelect }, onSelect };
}

// Two inline lists hang off one open definition and share ONE url segment. The bug this
// guards: `useMasterDetailForm` routes cancel and delete through `onSelect(null)`, so an
// unguarded share meant cancelling a NEW connection cleared the segment that was holding
// the effects list's open, dirty editor — and that edit was gone with no warning.
describe("inlineUrlSelection", () => {
  it("opens a row the list actually has", () => {
    const { leaf } = leafFor("eff-2");
    expect(inlineUrlSelection(leaf, rows, getId)?.selectedId).toBe("eff-2");
  });

  it("ignores a selection that belongs to the OTHER list", () => {
    const { leaf } = leafFor("map-9");
    expect(inlineUrlSelection(leaf, rows, getId)?.selectedId).toBeNull();
  });

  // Loading is UNDECIDED, not "not mine". Answering "not mine" is a positive statement:
  // `useMasterDetailForm` clears the draft for a null selectedId, where an unchanged id
  // falls into its own `selectedId && !row` guard and holds the draft instead. So the
  // segment passes through untouched and that guard decides.
  it("leaves the segment alone while the rows are still loading", () => {
    const { leaf } = leafFor("eff-1");
    expect(inlineUrlSelection(leaf, null, getId)?.selectedId).toBe("eff-1");
    // Including an id that will turn out to be the sibling's — it cannot open a row it
    // does not have, so passing it through costs nothing and clearing it costs a draft.
    const foreign = leafFor("map-9");
    expect(inlineUrlSelection(foreign.leaf, null, getId)?.selectedId).toBe("map-9");
  });

  it("has no selection while loading if the segment is empty", () => {
    const { leaf } = leafFor(null);
    expect(inlineUrlSelection(leaf, null, getId)?.selectedId).toBeNull();
  });

  // The other half of "undecided": holding the segment is not the same as OWNING it.
  // Clearing is a positive claim, and a list that has loaded nothing cannot make one —
  // otherwise the round-one defect survives inside the window before the rows arrive.
  it("does NOT clear the segment while the rows are still loading", () => {
    const { leaf, onSelect } = leafFor("eff-1");
    inlineUrlSelection(leaf, null, getId)?.onSelect(null);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does NOT clear a segment that belongs to the other list", () => {
    const { leaf, onSelect } = leafFor("map-9");
    inlineUrlSelection(leaf, rows, getId)?.onSelect(null);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clears the segment when it is pointing at one of its own rows", () => {
    const { leaf, onSelect } = leafFor("eff-1");
    inlineUrlSelection(leaf, rows, getId)?.onSelect(null);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  // A non-null id is always this list's: the row it just selected, or the one its create
  // just saved. Claiming the segment for it is what makes the child deep-linkable.
  it("always claims the segment for a row of its own", () => {
    const { leaf, onSelect } = leafFor("map-9");
    inlineUrlSelection(leaf, rows, getId)?.onSelect("eff-1");
    expect(onSelect).toHaveBeenCalledWith("eff-1");
  });

  it("is absent entirely when the topic gave no leaf, leaving selection internal", () => {
    expect(inlineUrlSelection(undefined, rows, getId)).toBeUndefined();
  });
});
