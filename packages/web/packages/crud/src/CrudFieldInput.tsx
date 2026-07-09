'use client'

import { Checkbox } from '@agentic-toolkit/ui/components/checkbox'
import { Input } from '@agentic-toolkit/ui/components/input'
import { Select } from '@agentic-toolkit/ui/components/select'
import { Textarea } from '@agentic-toolkit/ui/components/textarea'
import type { CrudColumn } from './types'

/** Columns edited as JSON text. 'unknown' is included: the spec types jsonb
 *  columns that way, and they must round-trip as JSON — the plain-text path
 *  would corrupt an object into "[object Object]". Shared by the form and the
 *  field input so both classify a column the same way. */
export function isJsonColumn(column: CrudColumn): boolean {
  return column.type === 'object' || column.type === 'array' || column.type === 'unknown'
}

export interface CrudFieldInputProps {
  column: CrudColumn
  /** Draft value: text for string/number/enum/json, boolean for a checkbox,
   *  `undefined` for an untouched create checkbox. */
  value: string | boolean | undefined
  /** DOM id for the rendered control, so a `<label htmlFor>` can address it. */
  id?: string
  disabled?: boolean
  onChange: (value: string | boolean) => void
}

/**
 * The bare, label-less control for one CRUD column, picked by type: enum →
 * Select, boolean → Checkbox, object/array/unknown → JSON Textarea, integer/
 * number → numeric Input, everything else → text Input. The single source of the
 * per-type field rendering shared by {@link CrudRecordForm} (wrapped in a Field)
 * and the row-details editor (CrudDataView). It owns no state — the caller owns
 * the draft value and the onChange.
 */
export function CrudFieldInput({ column, value, id, disabled, onChange }: CrudFieldInputProps) {
  const text = typeof value === 'string' ? value : ''
  if (column.type === 'boolean') {
    return (
      <Checkbox
        id={id}
        checked={value === true}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    )
  }
  if (column.enum) {
    return (
      <Select
        id={id}
        value={text}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{column.required ? 'Select…' : '(unset)'}</option>
        {column.enum.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    )
  }
  if (isJsonColumn(column)) {
    return (
      <Textarea
        id={id}
        value={text}
        rows={3}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  return (
    <Input
      id={id}
      type={column.type === 'integer' || column.type === 'number' ? 'number' : 'text'}
      value={text}
      maxLength={column.maxLength}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
