"use client"

import * as React from "react"

import { Input } from "@agenticdevelopertoolkit/ui/components/input"
import { FieldFootnote } from "@agenticdevelopertoolkit/ui/components/field-footnote"
import { fieldCaptionClass } from "@agenticdevelopertoolkit/ui/lib/typography"

export interface RdidEditorProps {
  /** Uppercase-mono caption above the control. */
  label: React.ReactNode
  /**
   * The fixed, inherited prefix shown as static <code> before the input, e.g. "app.my-eco."
   * or "persona.". An empty string renders a single full-width input (the whole value is edited).
   */
  prefix: string
  /** The editable leaf when `prefix` is set; the whole rdid when `prefix` is "". */
  value: string
  /** Called with the lowercased next value (leaf, or whole rdid when prefix is ""). */
  onChange: (next: string) => void
  placeholder?: string
  hint?: React.ReactNode
  /** Inline error, shown in place of `hint`. */
  error?: React.ReactNode
  disabled?: boolean
  id?: string
}

/**
 * The one control for editing a type-prefixed rdid: the fixed `<prefix>` (type + inherited
 * scope, never user-edited) as static text, plus an input for the leaf — mirroring how the
 * backend rejects any type/scope change. Backend-agnostic: the caller derives `prefix` (e.g. via
 * @agentic-toolkit/adh/rdid `prefixFor`) and `error` (via `validateLeaf`). Input is lowercased.
 */
export function RdidEditor({
  label, prefix, value, onChange, placeholder, hint, error, disabled, id,
}: RdidEditorProps) {
  const reactId = React.useId()
  const inputId = id ?? reactId
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.toLowerCase())
  return (
    <div className="flex flex-col items-start gap-1.5">
      <label htmlFor={inputId} className={fieldCaptionClass}>{label}</label>
      {prefix ? (
        <div className="flex w-full items-center gap-1">
          <code className="shrink-0 text-sm text-apt-text-muted">{prefix}</code>
          <Input
            id={inputId}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            onChange={onInput}
          />
        </div>
      ) : (
        <Input
          id={inputId}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={onInput}
        />
      )}
      <FieldFootnote hint={hint} error={error} />
    </div>
  )
}
