import { describe, expect, it } from "vitest";
import { readSlots, writeSlots, validateSlots, type FormSlot } from "../slots";

function doc(data: string) {
  const read = readSlots(data);
  if (!read.ok) throw new Error(`expected readable slots, got: ${read.reason}`);
  return read.doc;
}

describe("readSlots", () => {
  // Where an operator actually starts: a definition whose data has never been written.
  it("reads empty data as an empty form rather than an error", () => {
    expect(doc("")).toEqual({ slots: [], rest: {} });
    expect(doc("   ")).toEqual({ slots: [], rest: {} });
  });

  it("reads an object with no slots key as an empty form, keeping the rest", () => {
    expect(doc('{"title":"Sign the register"}')).toEqual({
      slots: [],
      rest: { title: "Sign the register" },
    });
  });

  it("reads slots, defaulting only the LABEL — never the input mode", () => {
    expect(doc('{"slots":[{"key":"a","label":"A","input":"curated"},{"key":"b"}]}').slots).toEqual([
      { key: "a", label: "A", input: "curated", extra: {}, hadLabel: true },
      { key: "b", label: "", input: null, extra: {}, hadLabel: false },
    ]);
  });

  // Three keys are this editor's; anything else on a slot belongs to the engine and is
  // carried, not summarised.
  it("carries a slot's other keys, and remembers whether it HAD a label", () => {
    const slots = doc('{"slots":[{"key":"a","hint":"pick one","min_rank":3}]}').slots;
    expect(slots.map((s) => s.extra)).toEqual([{ hint: "pick one", min_rank: 3 }]);
    expect(slots.map((s) => s.hadLabel)).toEqual([false]);
    expect(doc('{"slots":[{"key":"a","label":""}]}').slots.map((s) => s.hadLabel)).toEqual([true]);
  });

  // The rule is about TYPE, not name: a `label` this editor cannot show is not a label it
  // may replace. It used to be deleted from `extra` and re-written as `""`, which destroyed
  // it — a value lost because it sat under a key we happen to use.
  it("carries a label that is not a string instead of taking it", () => {
    const slots = doc('{"slots":[{"key":"a","label":42}]}').slots;
    expect(slots.map((s) => s.extra)).toEqual([{ label: 42 }]);
    expect(slots.map((s) => s.label)).toEqual([""]);
    // False, or the write would emit BOTH — ours empty, over theirs.
    expect(slots.map((s) => s.hadLabel)).toEqual([false]);
  });

  // An unrecognised mode must not pass for "curated": that is the path that skips screening.
  it("reads an unrecognised input mode as NOT CHOSEN, and keeps the value it did not understand", () => {
    const slots = doc('{"slots":[{"key":"a","input":"anything"}]}').slots;
    expect(slots.map((s) => s.input)).toEqual([null]);
    expect(slots.map((s) => s.extra)).toEqual([{ input: "anything" }]);
  });

  it("refuses unparseable data, and says nothing typed has been changed", () => {
    const read = readSlots("{");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toContain("nothing you typed has been changed");
  });

  it("refuses data that is not a JSON object, or a slots key that is not a list", () => {
    expect(readSlots("[1,2]").ok).toBe(false);
    expect(readSlots('{"slots":{}}').ok).toBe(false);
    expect(readSlots('{"slots":[1]}').ok).toBe(false);
    expect(readSlots('{"slots":[{"label":"no key"}]}').ok).toBe(false);
  });
});

describe("writeSlots", () => {
  // The whole point of the typed view being a VIEW: `data` is the escape hatch, and an
  // editor over one of its keys must not cost the operator the others.
  it("preserves every other key of data", () => {
    const before = '{"title":"Register","version":3,"slots":[{"key":"a","label":"A","input":"curated"}]}';
    const slots: FormSlot[] = [{ key: "b", label: "B", input: "free-text" }];
    const after = JSON.parse(writeSlots(before, slots));
    expect(after.title).toBe("Register");
    expect(after.version).toBe(3);
    expect(after.slots).toEqual([{ key: "b", label: "B", input: "free-text" }]);
  });

  it("adds slots to data that had none, and to empty data", () => {
    const slots: FormSlot[] = [{ key: "a", label: "A", input: "curated" }];
    expect(JSON.parse(writeSlots('{"title":"T"}', slots))).toEqual({ title: "T", slots });
    expect(JSON.parse(writeSlots("", slots))).toEqual({ slots });
  });

  // A placeholder would read back as a choice on the next load.
  it("omits the input key entirely for a slot with no choice made, and round-trips as null", () => {
    const out = writeSlots("", [{ key: "a", label: "A", input: null }]);
    expect(JSON.parse(out).slots).toEqual([{ key: "a", label: "A" }]);
    expect(doc(out).slots.map((s) => s.input)).toEqual([null]);
  });

  // The same promise one level down: a key adh does not own is carried, and one adh did
  // not find is not invented. `label: ""` on a slot that never had a label is a key we
  // would have minted, and an engine is free to read absent and empty as different answers.
  it("carries a slot's other keys through a write", () => {
    const before = '{"slots":[{"key":"a","hint":"pick one","input":"curated"}]}';
    const slots = doc(before).slots;
    expect(JSON.parse(writeSlots(before, slots)).slots).toEqual([
      { key: "a", hint: "pick one", input: "curated" },
    ]);
  });

  it("survives a non-string label through an edit to another slot's key", () => {
    const before = '{"slots":[{"key":"a","label":42},{"key":"b","label":"B","input":"curated"}]}';
    const slots = doc(before).slots;
    const edited: FormSlot[] = [{ ...slots[0]!, key: "renamed" }, slots[1]!];
    expect(JSON.parse(writeSlots(before, edited)).slots).toEqual([
      { key: "renamed", label: 42 },
      { key: "b", label: "B", input: "curated" },
    ]);
  });

  // Answering the box IS the operator overwriting it, which is the one thing that may.
  it("replaces a non-string label once the operator types one", () => {
    const before = '{"slots":[{"key":"a","label":42}]}';
    const slots = doc(before).slots;
    const edited: FormSlot[] = [{ ...slots[0]!, label: "A" }];
    expect(JSON.parse(writeSlots(before, edited)).slots).toEqual([{ key: "a", label: "A" }]);
  });

  it("does not mint an empty label on a slot that never had one", () => {
    const out = JSON.parse(writeSlots("", [{ key: "a", label: "", input: "curated" }]));
    expect(out.slots).toEqual([{ key: "a", input: "curated" }]);
    expect("label" in out.slots[0]).toBe(false);
  });

  it("keeps a label that WAS there, even when it is empty", () => {
    const before = '{"slots":[{"key":"a","label":"","input":"curated"}]}';
    expect(JSON.parse(writeSlots(before, doc(before).slots)).slots).toEqual([
      { key: "a", label: "", input: "curated" },
    ]);
  });

  it("returns unreadable data UNCHANGED rather than clobbering what was typed", () => {
    expect(writeSlots("{oops", [{ key: "a", label: "A", input: "curated" }])).toBe("{oops");
  });

  // The write has to agree with the gate that let it through: `validateSlots` judges the
  // TRIMMED key, so writing the untrimmed one persisted a key the operator never approved —
  // and made two slots the validator called duplicates land as distinct rows.
  it("writes the trimmed key validateSlots approved, not the raw one", () => {
    const out = JSON.parse(writeSlots("", [{ key: "  hp  ", label: "HP", input: "curated" }]));
    expect(out.slots).toEqual([{ key: "hp", label: "HP", input: "curated" }]);
  });

  it("makes the duplicate validateSlots rejects a duplicate on disk too", () => {
    const slots: FormSlot[] = [
      { key: "hp", label: "A", input: "curated" },
      { key: " hp", label: "B", input: "curated" },
    ];
    expect(validateSlots(slots)).toBe("Two form slots share the key “hp”.");
    // And had it been written anyway, both rows would carry the SAME key — the collision the
    // validator named, rather than two rows that only looked alike in the editor.
    expect(JSON.parse(writeSlots("", slots)).slots.map((s: { key: string }) => s.key)).toEqual([
      "hp",
      "hp",
    ]);
  });
});

describe("validateSlots", () => {
  // The rule this module exists for: an explicit per-slot choice, never a default.
  it("fails a slot with no input chosen, and names it", () => {
    expect(validateSlots([{ key: "name", label: "Name", input: null }])).toBe(
      "Choose free text or curated for the “name” slot — there is no default.",
    );
  });

  it("requires a key, and rejects two slots sharing one", () => {
    expect(validateSlots([{ key: "  ", label: "", input: "curated" }])).toBe(
      "Every form slot needs a key.",
    );
    expect(
      validateSlots([
        { key: "a", label: "", input: "curated" },
        { key: "a", label: "", input: "free-text" },
      ]),
    ).toBe("Two form slots share the key “a”.");
  });

  it("accepts a form with no slots at all, and one where every slot was answered", () => {
    expect(validateSlots([])).toBeNull();
    expect(
      validateSlots([
        { key: "a", label: "A", input: "curated" },
        { key: "b", label: "B", input: "free-text" },
      ]),
    ).toBeNull();
  });
});
