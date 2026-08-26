"use client";

import { useId, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@agenticdevelopertoolkit/ui/components/radio";
import type { FormSlot, SlotInputMode } from "./slots";

/**
 * The slots of a `kind = 'form'` definition — the one place this authoring surface reads
 * into a game's opaque `data`, and the reason is a safety property rather than a
 * convenience (see `slots.ts`).
 *
 * The free-text / curated choice is rendered as an unset radio pair on purpose: a new
 * slot has NEITHER selected, and the definition cannot be saved until a human picks. The
 * consequence line under the pair is not decoration — it is the whole reason the control
 * exists, and a reader who cannot see it cannot make the choice knowingly.
 */
export function SlotsEditor({
  slots,
  onChange,
}: {
  slots: FormSlot[];
  onChange: (next: FormSlot[]) => void;
}) {
  const uid = useId();

  // React identity for rows that have none of their own. A slot's own fields cannot supply
  // it: `key` is the thing being typed, so keying on it remounts the row at every keystroke
  // and the caret leaves the field. Nor can it be minted during render — these slots are
  // re-parsed out of `data` on every render, so a fresh id each time is worse than an index.
  // So the ids live in a ref, and the two operations that MOVE rows keep them in step:
  // removing slot 1 of 3 drops id 1, and the survivors keep theirs (with `key={index}` they
  // were all re-keyed, and focus landed on the wrong row).
  const ids = useRef<string[]>([]);
  const minted = useRef(0);
  while (ids.current.length < slots.length) ids.current.push(`slot-${minted.current++}`);
  // A shrink from OUTSIDE (the raw JSON editor below) has no index to go on; truncating is
  // the honest fallback, and it costs a remount of rows an external edit just rewrote anyway.
  if (ids.current.length > slots.length) ids.current.length = slots.length;

  function patch(index: number, next: Partial<FormSlot>) {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...next } : slot)));
  }

  function removeSlot(index: number) {
    ids.current.splice(index, 1);
    onChange(slots.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Form slots</Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            // A new slot starts with NO input mode. That is the requirement, not an
            // oversight: "an explicit per-slot choice — never a default, never inferred."
            onChange([...slots, { key: "", label: "", input: null }])
          }
        >
          <Plus data-icon="inline-start" />
          Add slot
        </Button>
      </div>

      {slots.length === 0 ? (
        <p className="text-xs text-apt-text-muted">
          No slots yet. A form&rsquo;s slots are the blanks a player fills in.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {slots.map((slot, index) => {
            const keyId = `${uid}-${index}-key`;
            const labelId = `${uid}-${index}-label`;
            return (
              <li
                key={ids.current[index] ?? index}
                className="flex flex-col gap-3 rounded-md border border-apt-border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor={keyId}>Key</Label>
                    <Input
                      id={keyId}
                      placeholder="creature"
                      value={slot.key}
                      onChange={(e) => patch(index, { key: e.target.value })}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor={labelId}>Label</Label>
                    <Input
                      id={labelId}
                      placeholder="A creature"
                      value={slot.label}
                      onChange={(e) => patch(index, { label: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>How it is filled</Label>
                  <RadioGroup
                    aria-label={`How the ${slot.key || "new"} slot is filled`}
                    value={slot.input}
                    onValueChange={(value) => patch(index, { input: value as SlotInputMode })}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <label className="flex items-center gap-2 text-sm text-apt-text">
                      <RadioGroupItem value="free-text" />
                      Free text
                    </label>
                    <label className="flex items-center gap-2 text-sm text-apt-text">
                      <RadioGroupItem value="curated" />
                      Curated
                    </label>
                  </RadioGroup>
                  <p className="text-xs text-apt-text-muted">
                    Values typed into a free-text slot are screened before they can mint a term
                    or be published; curated slots are filled from <code>term</code> definitions
                    the player picks. Neither is chosen for you.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="destructive-ghost"
                    onClick={() => removeSlot(index)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove slot
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
