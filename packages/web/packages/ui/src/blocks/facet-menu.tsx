"use client";

import type { ReactElement } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/popover";

export interface FacetMenuProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  labelOf?: (value: string) => string;
}

/**
 * A multi-select filter behind a popup menu, with All and None.
 *
 * THE COUNT IN THE TRIGGER IS NOT DECORATION. A filter whose entire UI is hidden behind a click
 * is a filter the operator forgets is on — and then reads a short list as "these are all the rows
 * there are", which on a list with a Release or a Delete button in the bar above it is the
 * prelude to acting on the wrong set. The trigger says how many values are narrowing the list
 * whether the menu is open or not.
 *
 * "All" ticks every option and "None" ticks none, and the two narrow the list IDENTICALLY — an
 * empty selection means "not filtering", so a facet with everything ticked and one with nothing
 * ticked show the same rows. That is not a redundancy to collapse: "All" is the start of
 * "everything except this one", which is how an operator excludes a single value, and it needs
 * the boxes actually ticked to be that. "None" is the way back to no filter at all, which is why
 * the trigger's count reads 0 afterwards and reads N after All — the number says how many boxes
 * are ticked, which is what the menu shows when it is opened.
 */
export function FacetMenu({
  label,
  options,
  selected,
  onChange,
  labelOf,
}: FacetMenuProps): ReactElement {
  const toggle = (value: string): void => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="ghost" disabled={options.length === 0}>
            {label}
            {selected.size > 0 ? ` (${selected.size})` : ""}
            <ChevronDown className="ml-1 size-3.5" aria-hidden />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(new Set(options))}
              disabled={options.every((o) => selected.has(o))}
            >
              All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(new Set())}
              disabled={selected.size === 0}
            >
              None
            </Button>
          </div>
          <div className="max-h-64 overflow-auto pr-1">
            {options.map((option) => (
              // No `aria-label` on the checkbox: the wrapping `<label>` already names it (base-ui
              // points `aria-labelledby` at it), and adding one on top makes the computed
              // accessible name the value TWICE.
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-sm"
              >
                <Checkbox checked={selected.has(option)} onCheckedChange={() => toggle(option)} />
                {labelOf ? labelOf(option) : option}
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
