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
}

export type EntityChooserProps = EntityChooserSingleProps | EntityChooserMultiProps

/**
 * `EntityChooser` is a browse / filter / select / add surface for a list of string
 * entities — the account's categories or tags. It is a thin composition over
 * {@link ListChooser} (the list + roving-keyboard + add-new engine), adding only the
 * selection semantics: SINGLE mode is a one-value picker; MULTI mode maintains a set,
 * rendering it as removable chips beside a "Choose…" trigger whose browser stays open
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
    const { value, onChange } = props
    const add = (v: string): void => {
      if (!value.includes(v)) onChange([...value, v])
    }
    const remove = (v: string): void => onChange(value.filter((x) => x !== v))
    // The browser only offers options not already chosen (you can't add a tag twice).
    const available = itemsOf(options.filter((o) => !value.includes(o)))

    // Chips + the "Choose…" trigger flow together (a tag-editor shape). value=null on
    // the inner ListChooser keeps the trigger reading "Choose…"; each accept ADDS one.
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
        {value.map((v) => (
          <RemovableChip
            key={v}
            removeLabel={`Remove ${v}`}
            disabled={disabled}
            onRemove={() => remove(v)}
          >
            {v}
          </RemovableChip>
        ))}
        {/* `keepOpenOnCommit`: a set is built one entry at a time, so the browser stays up
            after each accept and Shift+Enter dismisses it — adding three tags is three
            Enters, not three trips through the trigger. The buttons say what they now do:
            OK adds another, Cancel is how you leave. */}
        <ListChooser
          items={available}
          value={null}
          onChange={(v) => add(v)}
          keepOpenOnCommit
          okLabel="Add"
          cancelLabel="Done"
          {...shared}
          className="w-auto"
        />
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
