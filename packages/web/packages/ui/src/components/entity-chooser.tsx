"use client"

import * as React from "react"

import { ListChooser, type ListChooserItem } from "./list-chooser"
import { RemovableChip } from "./removable-chip"
import { cn } from "../lib/utils"

interface EntityChooserCommonProps {
  /** Options to browse/filter/select (e.g. the account's categories or tags). */
  options: readonly string[]
  /** Required; labels the trigger button, the browser listbox, and (multi) the chip group. */
  ariaLabel: string
  /** Trigger button text (also the in-browser empty-filter placeholder fallback). */
  triggerLabel?: string
  /** Accessible label for the filter/add field inside the browser (defaults to `ariaLabel`). */
  inputLabel?: string
  /** Placeholder for the filter/add field. */
  placeholder?: string
  /** Allow accepting typed text matching no option as a brand-new entry (default true). */
  allowCreate?: boolean
  /** Builds the "add new" row label from the typed text. */
  createLabel?: (text: string) => string
  /** Shown in the browser when no option matches and creation is unavailable. */
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

export interface EntityChooserSingleProps extends EntityChooserCommonProps {
  multiple?: false
  /** The chosen value: an option, free text (when `allowCreate`), or null. */
  value: string | null
  onChange: (next: string | null) => void
}

export interface EntityChooserMultiProps extends EntityChooserCommonProps {
  multiple: true
  /** The selected set (order preserved). */
  value: string[]
  onChange: (next: string[]) => void
  /** Hint shown in place of the chips when the set is empty. */
  emptySelectionLabel?: string
  /**
   * WHERE the selected set is drawn.
   *
   * - `"inline"` (default): chips and the trigger flow together in one wrapping group — the
   *   tag-editor shape, right where the chooser is the row's whole control.
   * - `"host"`: this renders ONLY the trigger, sized by `className`, and the HOST draws the
   *   selection (see {@link EntitySelectionChips}). Use it where the chooser is one COLUMN of a
   *   wider row: a wrapping chip group inside a fixed-width column cannot both keep that width
   *   and hold its content, so it grows a second line and drags the trigger off the row's
   *   baseline — the trigger stops lining up with the one in the field above it the moment a
   *   chip is added. Handing the chips to the host keeps the column exactly one trigger wide.
   */
  selectionPlacement?: "inline" | "host"
}

export type EntityChooserProps = EntityChooserSingleProps | EntityChooserMultiProps

/**
 * `EntityChooser` is a browse / filter / select / add surface for a list of string
 * entities — the account's categories or tags. It is a thin composition over
 * {@link ListChooser} (the list + roving-keyboard + add-new engine), adding only the
 * selection semantics: SINGLE mode is a one-value picker; MULTI mode maintains a set,
 * rendering it as removable chips beside (or, with `selectionPlacement="host"`, apart from) a
 * "Choose…" trigger whose browser stays open
 * across accepts, so one open adds as many entries as you like (already-selected
 * options are hidden from it). It never re-implements the list or keyboard logic —
 * that all lives in `ListChooser`.
 */
export function EntityChooser(props: EntityChooserProps): React.ReactElement {
  const {
    options,
    ariaLabel,
    triggerLabel = "Choose…",
    inputLabel,
    placeholder,
    allowCreate = true,
    createLabel,
    emptyLabel,
    disabled = false,
    className,
  } = props

  const itemsOf = (values: readonly string[]): ListChooserItem[] =>
    values.map((v) => ({ value: v, label: v }))

  // Shared ListChooser config so single + multi stay visually and behaviorally identical.
  const shared = {
    allowCreate,
    ariaLabel,
    inputLabel,
    placeholder,
    triggerPlaceholder: triggerLabel,
    createLabel,
    emptyLabel,
    disabled,
  }

  if (props.multiple) {
    const { value, onChange, selectionPlacement = "inline" } = props
    const add = (v: string): void => {
      if (!value.includes(v)) onChange([...value, v])
    }
    const remove = (v: string): void => onChange(value.filter((x) => x !== v))
    // The browser only offers options not already chosen (you can't add a tag twice).
    const available = itemsOf(options.filter((o) => !value.includes(o)))

    // value=null on the inner ListChooser keeps the trigger reading "Choose…"; each accept ADDS one.
    //
    // WHO SIZES THE TRIGGER depends on where the chips are. Inline, the trigger is one more item
    // flowing among them, so it hugs its content (`w-auto`) and `className` sizes the GROUP. With
    // the chips handed to the host, the trigger IS the whole control this renders — so `className`
    // reaches it, which is what lets a caller give it the same `w-44` as the field above and have
    // the two right edges line up.
    //
    // `keepOpenOnCommit`: a set is built one entry at a time, so the browser stays up after each
    // accept and Shift+Enter dismisses it — adding three tags is three Enters, not three trips
    // through the trigger. The buttons say what they now do: OK adds another, Cancel is how you
    // leave.
    const chooser = (
      <ListChooser
        items={available}
        value={null}
        onChange={(v) => add(v)}
        keepOpenOnCommit
        okLabel="Add"
        cancelLabel="Done"
        {...shared}
        className={selectionPlacement === "host" ? className : "w-auto"}
      />
    )

    if (selectionPlacement === "host") return chooser

    // Chips + the "Choose…" trigger flow together (a tag-editor shape).
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn("flex flex-wrap items-center gap-1.5", className)}
      >
        {value.length === 0 && (
          <span className="text-sm text-apt-text-dim">
            {props.emptySelectionLabel ?? "Nothing selected yet"}
          </span>
        )}
        {selectionChips(value, disabled, remove)}
        {chooser}
      </div>
    )
  }

  const { value, onChange } = props
  return (
    <ListChooser
      items={itemsOf(options)}
      value={value}
      onChange={(v) => onChange(v)}
      className={className}
      {...shared}
    />
  )
}

/** The one chip rendering for a chosen SET — used by `EntityChooser`'s inline layout and by
 *  {@link EntitySelectionChips}, so a chip means the same thing wherever the set is drawn. */
function selectionChips(
  values: readonly string[],
  disabled: boolean,
  onRemove: (value: string) => void,
): React.ReactElement[] {
  return values.map((v) => (
    <RemovableChip
      key={v}
      removeLabel={`Remove ${v}`}
      disabled={disabled}
      onRemove={() => onRemove(v)}
    >
      {v}
    </RemovableChip>
  ))
}

/**
 * The selected set of an `EntityChooser` rendered by its HOST — the other half of
 * `selectionPlacement="host"`.
 *
 * It exists so that moving the chips out of the chooser's column does not fork what a chip is:
 * the markup, the remove affordance and its accessible name all still come from one place. The
 * group carries `ariaLabel` because it is now the only thing naming the selection — the chooser
 * it came from no longer wraps it.
 *
 * With an empty set and no `emptySelectionLabel` it renders NOTHING rather than an empty row, so
 * a field that has no selection yet costs no height (the same rule `CategoryField`'s breadcrumb
 * row follows).
 */
export function EntitySelectionChips({
  values,
  ariaLabel,
  onRemove,
  emptySelectionLabel,
  disabled = false,
  className,
}: {
  /** The selected set, in order. */
  values: readonly string[]
  /** Names the group — the plural noun the set is of ("Tags"). */
  ariaLabel: string
  onRemove: (value: string) => void
  /** Shown in place of the chips when the set is empty. Omit to render nothing at all. */
  emptySelectionLabel?: string
  disabled?: boolean
  className?: string
}): React.ReactElement | null {
  if (values.length === 0 && emptySelectionLabel == null) return null
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      {values.length === 0 ? (
        <span className="text-sm text-apt-text-dim">{emptySelectionLabel}</span>
      ) : (
        selectionChips(values, disabled, onRemove)
      )}
    </div>
  )
}
