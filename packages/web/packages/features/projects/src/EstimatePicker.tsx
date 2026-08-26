"use client";

import { type ReactElement } from "react";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import type { EstimateScale } from "@agentic-toolkit/data/projects";
import { estimateOptions } from "./helpers";

/**
 * How big a card is, in whatever units its project's scale names: a Field + native Select over
 * that scale's values, plus a "No estimate" option (→ null).
 *
 * It renders NOTHING when the project's scale is `none`, and that is the component's job rather
 * than each call site's. A project that does not estimate should not show an estimate control,
 * and there are three forms that would otherwise each repeat the same branch — the editor, the
 * new-card dialog, and the bulk-edit sheet — which is three places for it to be got wrong once.
 *
 * The value is a STRING, like every other draft field: "" is unestimated, and any other value is
 * the integer as text. The editor compares its draft fields with `Object.is`, so a field carried
 * as a number would be fine and one carried as an object would read as dirty forever; keeping
 * every field a string is what makes that rule easy to hold.
 */

/** The unestimated option's value. Distinct from `"0"`, which is a real size: a card estimated at
 *  zero has been looked at and judged free, and a card with no estimate has not been looked at. */
export const NO_ESTIMATE = "";

/** Parse a picker value back to what the API stores — `null` for unestimated. Exported so a
 *  caller building a patch shares the one codec rather than re-deriving `Number("")` is 0. */
export function fromEstimateValue(raw: string): number | null {
  if (raw === NO_ESTIMATE) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Encode a stored estimate as its picker value. */
export function toEstimateValue(estimate: number | null): string {
  return estimate === null ? NO_ESTIMATE : String(estimate);
}

export function EstimatePicker({
  scale,
  value,
  onChange,
  label = "Estimate",
}: {
  /** the owning project's scale; `none` renders nothing. */
  scale: EstimateScale;
  /** the picker value — {@link toEstimateValue} of the card's estimate. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
}): ReactElement | null {
  const options = estimateOptions(scale);
  if (options.length === 0) return null;

  // A size the scale no longer offers still has to be selectable, or opening the editor on a
  // card sized under the board's previous scale would quietly un-estimate it on save.
  const orphan =
    value !== NO_ESTIMATE && !options.some((o) => String(o.value) === value) ? value : null;

  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NO_ESTIMATE}>No estimate</option>
        {orphan ? <option value={orphan}>{orphan}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
