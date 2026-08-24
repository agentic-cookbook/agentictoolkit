import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "../lib/utils";
import { Input } from "./input";
import { Select } from "./select";

/** The search field of a {@link SearchFilterBar}. */
export interface SearchFieldConfig {
  /** Controlled text value. */
  value: string;
  /** Called with the new text on every keystroke. */
  onChange: (value: string) => void;
  /** Accessible label — the field is icon-only, so this is its only name. */
  label: string;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /**
   * Optional key handler on the search input — e.g. to commit a search
   * immediately on Enter (flushing a debounce) on top of the live `onChange`.
   */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * One option of a {@link FilterSelectConfig}, when what is stored differs from what
 * is read — an axis over RECORDS (a status, an iteration, an owner) filters by id and
 * shows a name. A bare string is the shorthand for the case where they coincide.
 *
 * The pair exists so a caller filtering by id does not have to keep a label↔id codec
 * of its own: two ids can share a display name and two names can share an id, so any
 * such codec is a lossy guess about data the caller already has correctly.
 */
export interface FilterSelectOption {
  /** What the axis stores and reports through `onChange`. */
  value: string;
  /** What the option reads as. */
  label: string;
}

/**
 * One filter `<select>` axis in a {@link SearchFilterBar}. An empty `value`
 * selects the leading all-pass option (no filter on this axis).
 */
export interface FilterSelectConfig {
  /** Stable identity for the React key and for distinguishing axes. */
  name: string;
  /** Accessible label for the control, e.g. `"Filter by category"`. */
  label: string;
  /** Selected option value; `""` selects the all-pass entry. */
  value: string;
  /** The options: a bare string is both the value and the visible text; a
   *  {@link FilterSelectOption} separates them. The two may be mixed. */
  options: readonly (string | FilterSelectOption)[];
  /** Label for the leading all-pass option, e.g. `"All categories"`. */
  allLabel: string;
  /** Called with the newly selected value (`""` for the all-pass entry). */
  onChange: (value: string) => void;
}

/** A filter option in its full form, whichever shorthand the caller used. */
function asOption(option: string | FilterSelectOption): FilterSelectOption {
  return typeof option === "string" ? { value: option, label: option } : option;
}

/**
 * How the search field and the filter row are arranged.
 *
 * - `"stacked"` (the default) — filters sit in a row UNDER the search field. This
 *   is the shape for a sidebar or a narrow column beside a result list.
 * - `"inline"` — one wrapping row, the search field taking the slack. This is the
 *   shape for a bar spanning the page under a header, where a second line of
 *   controls would push the content it filters below the fold.
 */
export type SearchFilterBarOrientation = "stacked" | "inline";

export interface SearchFilterBarProps {
  /** The (required) search field configuration. */
  search: SearchFieldConfig;
  /** Zero or more filter dropdowns, rendered in a row with the search field. */
  filters?: FilterSelectConfig[];
  /** Row layout — see {@link SearchFilterBarOrientation}. Defaults to `"stacked"`. */
  orientation?: SearchFilterBarOrientation;
  /**
   * Extra filter controls, rendered in the filter row after any `filters`.
   *
   * `filters` covers the single-select axis, which is most of them. An axis that
   * is genuinely a different control — a multi-select, a date range, a toggle
   * group — arrives here instead of growing a config union that has to describe
   * every control the platform will ever filter with. The caller composes; the
   * bar supplies the landmark, the field and the row.
   */
  children?: React.ReactNode;
  /**
   * Render the root as a `<form>` that submits nothing, instead of a `<div>`.
   *
   * This is an autofill fix, not a submission mechanism — every axis is already
   * live through `onChange`, and the form's `onSubmit` is cancelled. A field with
   * no `<form>` ancestor is scoped for autofill against the whole DOCUMENT, so a
   * page that also carries name/email/address content can offer "AutoFill
   * Contact" over a search box. Measured on iOS 26 in the chat composer: stripping
   * every attribute off the input did not move it, and giving the field a form of
   * its own did. The attribute bag {@link Input} already applies is the other half
   * of the fix and is not sufficient alone.
   *
   * Off by default, because a bar rendered inside a host's own `<form>` would
   * nest one — which the HTML parser resolves by dropping it.
   */
  asForm?: boolean;
  /** Extra classes on the `role="search"` root. */
  className?: string;
  /**
   * Accessible name for the `role="search"` landmark. Recommended when a page has
   * more than one search region so assistive tech can tell them apart.
   */
  "aria-label"?: string;
}

/**
 * A search field plus a configurable row of filters, wrapped in a `role="search"`
 * region. Every axis is fully controlled by the caller (value + onChange); the
 * option sets are supplied by the caller so a narrowed result list can never empty
 * its own dropdowns. Composes the shared {@link Input} and {@link Select}
 * primitives — the single home for the "search + filters over a list" pattern
 * across the platform.
 */
export function SearchFilterBar({
  search,
  filters = [],
  orientation = "stacked",
  children,
  asForm = false,
  className,
  "aria-label": ariaLabel,
}: SearchFilterBarProps): React.ReactElement {
  const inline = orientation === "inline";
  // `children` may legitimately be `false`/`null` from a host's own conditional, so
  // the row is drawn for what React would actually render, not for whether the prop
  // was passed.
  const hasControls = filters.length > 0 || Boolean(children);
  const rootProps = {
    role: "search",
    "aria-label": ariaLabel,
    className: cn(
      inline ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-2",
      className,
    ),
  };
  const body = (
    <>
      {/* `min-w-48` rather than a bare `flex-1`: a flex item's floor is its content
          width, and an empty search field has none, so on a narrow bar the field
          would collapse to the icon and hand every spare pixel to the controls. */}
      <div className={cn("relative", inline && "min-w-48 flex-1")}>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apt-text-muted"
        />
        <Input
          type="search"
          value={search.value}
          aria-label={search.label}
          placeholder={search.placeholder}
          className="pl-8"
          onChange={(e) => search.onChange(e.target.value)}
          onKeyDown={search.onKeyDown}
        />
      </div>
      {hasControls && (
        <div className="flex gap-2">
          {filters.map((f) => (
            <Select
              key={f.name}
              aria-label={f.label}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
            >
              <option value="">{f.allLabel}</option>
              {f.options.map(asOption).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
          {children}
        </div>
      )}
    </>
  );
  // `role="search"` rides on whichever element is the root: a `<form>` is a
  // landmark only once it is named, so the two shapes read identically to
  // assistive tech.
  return asForm ? (
    <form {...rootProps} onSubmit={(e) => e.preventDefault()}>
      {body}
    </form>
  ) : (
    <div {...rootProps}>{body}</div>
  );
}
