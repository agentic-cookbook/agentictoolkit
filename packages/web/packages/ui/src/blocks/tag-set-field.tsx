"use client"

import * as React from "react"

import { Field } from "./field"
import { Combobox } from "../components/combobox"
import { EntityChooser } from "../components/entity-chooser"

/**
 * The family's TAG-SET editor: one form row for "this thing carries a set of short labels,
 * drawn from a vocabulary that grows by use".
 *
 * The arrangement is `[Combobox autocomplete] over [Choose… browser]`, and it is a pair rather
 * than either half alone because the two answer different questions. The Combobox is for the
 * label you already know the name of — type three characters, pick it, it is on. The
 * `EntityChooser` is for the one you don't: it opens a browsable list of everything the
 * vocabulary holds, and is also where a genuinely NEW label is minted (`allowCreate`). The
 * selected set renders as removable chips inside the chooser, which is what makes the row read
 * as a tag editor and not as two unrelated controls.
 *
 * Extracted when the second consumer appeared. The two — a research document's tags and a work
 * item's labels — are the same thing in the same tagging system (`content.keywords`), so a user
 * who learns the affordance once should not meet a different one on the next screen, and a fix
 * to the commit rule below should not have to be found twice.
 *
 * WORDS ARE THE HOST'S. `label` names the row and the chip group; `noun` (singular, lowercase)
 * builds the microcopy the two controls need — nothing here hardcodes "tag".
 */
export function TagSetField({
  label,
  noun,
  hint,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: {
  /** The row's caption and the chip group's accessible name — the PLURAL noun ("Tags"). */
  label: string
  /** The singular, lowercase noun for the controls' microcopy ("tag"). */
  noun: string
  hint?: React.ReactNode
  /** The vocabulary to offer. A SUGGESTION list, never a closed set — `value` may hold a label
   *  that is not in it (one just created, or one another surface added). */
  options: readonly string[]
  /** The selected set, in order. */
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  className?: string
}): React.ReactElement {
  // Local text for the autocomplete only. It is NOT part of the set: a half-typed label is a
  // search, and committing it would put fragments on the record every time focus moved.
  const [text, setText] = React.useState("")

  // Never re-offer a label that is already on. (The chooser hides them too, for the same reason.)
  const suggestions = React.useMemo(
    () => options.filter((o) => !value.includes(o)),
    [options, value],
  )

  // Base UI's Autocomplete fires `onValueChange` with the WHOLE option string when a suggestion
  // is accepted (click, or Enter on a highlight), and with the partial text on every keystroke.
  // An exact match against the vocabulary is therefore the acceptance signal: add it and clear
  // the field. Anything else is still being typed, so it just narrows the list.
  //
  // A consequence worth stating rather than discovering: typing a label the vocabulary does not
  // have and pressing Enter does NOT create it here — minting a new label is the chooser's
  // `allowCreate` row, which asks for the intent explicitly instead of inferring it from a
  // keystroke that is far more often a typo.
  function onText(next: string): void {
    if (next && options.includes(next) && !value.includes(next)) {
      onChange([...value, next])
      setText("")
      return
    }
    setText(next)
  }

  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex w-full flex-col gap-2">
        <Combobox
          items={suggestions}
          value={text}
          onValueChange={onText}
          ariaLabel={`Add a ${noun}`}
          placeholder={`Add a ${noun}…`}
          disabled={disabled}
          className="w-full"
        />
        <EntityChooser
          multiple
          options={options}
          value={value}
          onChange={onChange}
          ariaLabel={label}
          triggerLabel="Choose…"
          inputLabel={`Filter or add a ${noun}`}
          placeholder={`Filter or add a ${noun}…`}
          emptySelectionLabel={`No ${label.toLowerCase()} yet`}
          disabled={disabled}
        />
      </div>
    </Field>
  )
}
