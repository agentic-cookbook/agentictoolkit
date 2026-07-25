// .../features/personas/src/RowsField.tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";

/**
 * A repeatable add/remove list held in the caller's draft. Unlike GroupGrantsEditor —
 * whose rows each persist through their own API call — nothing here touches the network;
 * the array is just another draft field, saved with the rest of the persona.
 */
export function RowsField<T>({
  label,
  hint,
  value,
  onChange,
  blankRow,
  renderRow,
  addLabel = "Add",
}: {
  label: string;
  hint?: string;
  value: T[];
  onChange: (next: T[]) => void;
  blankRow: () => T;
  renderRow: (row: T, set: (next: T) => void, index: number) => ReactNode;
  addLabel?: string;
}) {
  const setAt = (i: number, next: T) => onChange(value.map((r, j) => (j === i ? next : r)));
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Deliberately NOT the `Field` block: it wraps its children in a <Label>, and nesting
          the Add/Remove buttons inside a label makes clicking one also drive label focus. This
          is a control GROUP, not a single labelled control — so it uses the package's section
          caption treatment directly (AssistantsPanel.tsx:196). */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
          {label}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, blankRow()])}
        >
          {addLabel}
        </Button>
      </div>
      {hint ? <p className="font-mono text-[0.7rem] text-apt-text-dim">{hint}</p> : null}
      {value.length === 0 ? (
        <p className="text-sm text-apt-text-muted">None yet.</p>
      ) : (
        <List>
          {value.map((row, i) => (
            <ListItem key={i} className="items-start">
              <div className="min-w-0 flex-1">{renderRow(row, (next) => setAt(i, next), i)}</div>
              <Button
                type="button"
                variant="destructive-ghost"
                size="sm"
                aria-label={`Remove row ${i + 1}`}
                onClick={() => removeAt(i)}
              >
                Remove
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
}
