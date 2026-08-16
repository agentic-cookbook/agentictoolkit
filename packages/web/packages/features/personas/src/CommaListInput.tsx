// .../features/personas/src/CommaListInput.tsx
"use client";

import { Input } from "@agentic-toolkit/ui/components/input";
import { useState } from "react";

/** A string array edited as a raw comma-separated line.
 *
 *  Splitting on every keystroke and re-joining for display is a round trip that erases its own
 *  separator: typing "matrix," splits to ["matrix", ""], the blank is dropped, and the join
 *  hands back "matrix" — the comma disappears from under the caret, and so does the space after
 *  it. The array is the stored form, not the edited one, so the raw text is what lives in state
 *  while the box is focused; the parse still runs on every keystroke so the row is saveable
 *  without blurring first. */
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
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? value.join(", ")}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
