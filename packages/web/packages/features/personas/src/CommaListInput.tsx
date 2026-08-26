// .../features/personas/src/CommaListInput.tsx
"use client";

import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { useState } from "react";

/** A string array edited as a raw comma-separated line.
 *
 *  Splitting on every keystroke and re-joining for display is a round trip that erases its own
 *  separator: typing "matrix," splits to ["matrix", ""], the blank is dropped, and the join
 *  hands back "matrix" — the comma disappears from under the caret, and so does the space after
 *  it. The array is the stored form, not the edited one, so the raw text is what lives in state
 *  while the box is focused; the parse still runs on every keystroke so the row is saveable
 *  without blurring first. */
const parseList = (text: string): string[] =>
  text.split(",").map((s) => s.trim()).filter(Boolean);

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function CommaListInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  /* The draft is remembered ALONGSIDE the array it parsed to, and shown only while the two still
     agree. `RowsField` keys its rows by index, so removing a row hands the NEXT row's value to
     this same mounted input — and a draft carried across that swap paints the deleted row's text
     over the survivor, then commits it on the next keystroke. Clearing on blur is not enough:
     in WebKit, clicking a button does not focus it, so `onBlur` never fires and the swap happens
     with the stale draft still live. Comparing against the incoming array makes it self-healing
     instead — any array this input did not itself produce wins. */
  const [draft, setDraft] = useState<{ text: string; parsed: string[] } | null>(null);
  const mine = draft !== null && sameList(draft.parsed, value);
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      value={mine ? draft.text : value.join(", ")}
      onChange={(e) => {
        const parsed = parseList(e.target.value);
        setDraft({ text: e.target.value, parsed });
        onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
